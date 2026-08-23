package org.example.backend.catalog;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BundleGenerationService {


    private final BudgetTierRepository budgetTierRepository;
    private final ProductRepository productRepository;
    private final ProductInterestAffinityRepository interestAffinityRepository;
    private final ProductAudienceAffinityRepository audienceAffinityRepository;
    private final ProductOccasionRepository occasionRepository;
    private final ProductRoleAffinityRepository roleAffinityRepository;
    private final ProductEligibilityService eligibilityService;
    private final ProductScoringService scoringService;
    private final BundleTemplateSelector templateSelector;
    private final UpgradeGenerationService upgradeGenerationService;
    private final GiftBagOptionRepository giftBagOptionRepository;
    private final GeneratedBundleRepository generatedBundleRepository;

    public BundleGenerationService(
            BudgetTierRepository budgetTierRepository,
            ProductRepository productRepository,
            ProductInterestAffinityRepository interestAffinityRepository,
            ProductAudienceAffinityRepository audienceAffinityRepository,
            ProductOccasionRepository occasionRepository,
            ProductRoleAffinityRepository roleAffinityRepository,
            ProductEligibilityService eligibilityService,
            ProductScoringService scoringService,
            BundleTemplateSelector templateSelector,
            UpgradeGenerationService upgradeGenerationService,
            GiftBagOptionRepository giftBagOptionRepository,
            GeneratedBundleRepository generatedBundleRepository) {
        this.budgetTierRepository = budgetTierRepository;
        this.productRepository = productRepository;
        this.interestAffinityRepository = interestAffinityRepository;
        this.audienceAffinityRepository = audienceAffinityRepository;
        this.occasionRepository = occasionRepository;
        this.roleAffinityRepository = roleAffinityRepository;
        this.eligibilityService = eligibilityService;
        this.scoringService = scoringService;
        this.templateSelector = templateSelector;
        this.upgradeGenerationService = upgradeGenerationService;
        this.giftBagOptionRepository = giftBagOptionRepository;
        this.generatedBundleRepository = generatedBundleRepository;
    }

    /**
     * Generates and persists a complete bundle snapshot atomically.
     *
     * Three selection paths:
     *
     * PATH 1 — Unconstrained (maxRetailPrice == null, slider at max):
     *   Pick the highest-scoring eligible product for each slot with no budget ceiling.
     *   Upgrades: highest-scoring STANDARD + highest-scoring PREMIUM from the eligible pool.
     *
     * PATH 2 — Constrained (maxRetailPrice != null, slider below max):
     *   Phase A: Identify the best STANDARD and PREMIUM upgrade candidates from the eligible
     *            pool (by interest score) and reserve their retail prices.
     *   Phase B: Greedy slot selection within (maxRetailPrice − upgradeReserve), using the
     *            preference-filtered eligible pool.  Per-slot fallback to all active STANDARD
     *            products if no preference-filtered candidate fits the remaining budget.
     *   Phase C: Final upgrade selection — STANDARD chosen to bring total closest to ceiling
     *            (highest retail ≤ remaining); PREMIUM chosen as the cheapest available.
     *
     * PATH 3 — Tight (fallback within PATH 2):
     *   Triggered per-slot when no eligible product fits even after reserving upgrade budget.
     *   Falls back to all active STANDARD products for that slot (drops preference filters).
     */
    @Transactional
    public GeneratedBundle generate(BundleGenerationRequest request) {
        // 1. Load and validate BudgetTier
        BudgetTier budgetTier = budgetTierRepository.findByCodeAndActiveTrue(request.budgetTierCode())
                .orElseThrow(() -> new BundleGenerationException(
                        BundleGenerationException.FailureCode.BUDGET_TIER_NOT_FOUND,
                        "Budget tier not found or inactive: " + request.budgetTierCode()));

        // 2. Select BundleTemplate
        BundleTemplate template = templateSelector.selectTemplate(request.age(), request.interest());

        // Eagerly initialize slots (EAGER fetch on allowedRoles is set on BundleTemplateSlot)
        List<BundleTemplateSlot> slots = template.getSlots();
        slots.forEach(s -> s.getAllowedRoles().size());

        // 3. Load all active products
        List<Product> allActive = productRepository.findAllByActiveTrue();

        // 4. Pre-load all affinities in batch
        Set<Long> allProductIds = allActive.stream().map(Product::getId).collect(Collectors.toSet());

        List<ProductInterestAffinity> allInterestAffinities =
                interestAffinityRepository.findAllByProductIdIn(allProductIds);
        List<ProductAudienceAffinity> allAudienceAffinities =
                audienceAffinityRepository.findAllByProductIdIn(allProductIds);
        List<ProductOccasion> allOccasions =
                occasionRepository.findAllByProductIdIn(allProductIds);
        List<ProductRoleAffinity> allRoleAffinities =
                roleAffinityRepository.findAllByProductIdIn(allProductIds);

        // Build lookup maps
        Map<Long, List<ProductInterestAffinity>> interestByProduct = allInterestAffinities.stream()
                .collect(Collectors.groupingBy(ProductInterestAffinity::getProductId));
        Map<Long, List<ProductAudienceAffinity>> audienceByProduct = allAudienceAffinities.stream()
                .collect(Collectors.groupingBy(ProductAudienceAffinity::getProductId));
        Map<Long, Set<String>> occasionsByProduct = allOccasions.stream()
                .collect(Collectors.groupingBy(
                        ProductOccasion::getProductId,
                        Collectors.mapping(ProductOccasion::getOccasion, Collectors.toSet())));
        Map<Long, List<ProductRoleAffinity>> roleByProduct = allRoleAffinities.stream()
                .collect(Collectors.groupingBy(ProductRoleAffinity::getProductId));

        // 5. Filter eligible products (age + party type)
        List<Product> eligible = allActive.stream()
                .filter(p -> eligibilityService.isEligible(p, request.age(),
                        request.partyType(), occasionsByProduct))
                .toList();

        // 5b. Hard audience filter: remove items incompatible with the gender preference.
        //     MASCULINE     → keep MASCULINE or UNIVERSAL (products with no affinity are neutral).
        //     FEMININE      → keep FEMININE  or UNIVERSAL.
        //     NO_PREFERENCE → keep UNIVERSAL only (drop FEMININE-only and MASCULINE-only items).
        //     Applied to both the preference-filtered eligible pool AND the broader allActive pool
        //     used by the PATH 3 per-slot fallback, so gender is always the first hard filter.
        eligible = eligible.stream()
                .filter(p -> eligibilityService.isAudienceCompatible(p.getId(), request.audiencePreference(), audienceByProduct))
                .toList();
        final List<Product> allActiveAudienceCompatible = allActive.stream()
                .filter(p -> eligibilityService.isAudienceCompatible(p.getId(), request.audiencePreference(), audienceByProduct))
                .toList();

        if (eligible.isEmpty()) {
            throw new BundleGenerationException(
                    BundleGenerationException.FailureCode.NO_ELIGIBLE_PRODUCTS,
                    "No eligible products for request");
        }

        // 6. Slot selection — branches on whether a retail price ceiling is set
        final boolean isConstrained = request.maxRetailPrice() != null;

        Set<Long> selectedIds = new HashSet<>();
        List<SlotSelection> slotSelections = new ArrayList<>();

        if (!isConstrained) {
            // ── PATH 1: Unconstrained ─────────────────────────────────────────────
            // No budget ceiling: pick the highest-scoring eligible product per slot.
            for (BundleTemplateSlot slot : slots) {
                List<Product> candidates = eligible.stream()
                        .filter(p -> !selectedIds.contains(p.getId()))
                        .filter(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct))
                        .toList();

                if (candidates.isEmpty()) {
                    throw new BundleGenerationException(
                            BundleGenerationException.FailureCode.INSUFFICIENT_ROLE_COVERAGE,
                            "No candidates for slot: " + slot.getSlotCode());
                }

                final BundleTemplateSlot currentSlot = slot;
                Product chosen = candidates.stream()
                        .max(Comparator.comparingInt(p -> scoringService.score(p, currentSlot, request,
                                interestByProduct.getOrDefault(p.getId(), List.of()),
                                audienceByProduct.getOrDefault(p.getId(), List.of()),
                                roleByProduct.getOrDefault(p.getId(), List.of()))))
                        .orElseThrow();

                slotSelections.add(new SlotSelection(slot, chosen));
                selectedIds.add(chosen.getId());
            }

        } else {
            // ── PATH 2/3: Constrained ─────────────────────────────────────────────
            // Phase A: Find the best-scoring STANDARD upgrade to reserve its retail
            // price from the ceiling.  Premium is NOT reserved here — it is an
            // explicit opt-in that can exceed the ceiling.
            Optional<Product> reserveStd = eligible.stream()
                    .filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD)
                    .max(Comparator.comparingInt((Product p) ->
                                    interestScore(p.getId(), request.interest(), interestByProduct))
                            .thenComparing(Comparator.comparing(Product::getRetailPrice).reversed()));

            // Phase B: Slot budget = ceiling − standard upgrade reserve only
            BigDecimal upgradeReserve = reserveStd.map(Product::getRetailPrice).orElse(BigDecimal.ZERO);
            BigDecimal slotBudget = request.maxRetailPrice().subtract(upgradeReserve);

            // If the upgrade reserve already exceeds the ceiling, give all budget to slots
            // (no upgrade reserve); the per-slot fallback will handle the tight scenario.
            if (slotBudget.compareTo(BigDecimal.ZERO) <= 0) {
                slotBudget = request.maxRetailPrice();
            }

            BigDecimal remainingBudget = slotBudget;

            for (int slotIdx = 0; slotIdx < slots.size(); slotIdx++) {
                BundleTemplateSlot slot = slots.get(slotIdx);
                final BigDecimal currentRemaining = remainingBudget;
                List<BundleTemplateSlot> remainingSlots = slots.subList(slotIdx + 1, slots.size());

                // Preference-filtered candidates within remaining slot budget
                List<Product> candidates = eligible.stream()
                        .filter(p -> !selectedIds.contains(p.getId()))
                        .filter(p -> p.getRetailPrice().compareTo(currentRemaining) <= 0)
                        .filter(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct))
                        .toList();

                // PATH 3 per-slot fallback: drop preference filters, use all active STANDARD
                //   (audience filter still applies via allActiveAudienceCompatible)
                final boolean usedFallback;
                if (candidates.isEmpty()) {
                    candidates = allActiveAudienceCompatible.stream()
                            .filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD)
                            .filter(p -> !selectedIds.contains(p.getId()))
                            .filter(p -> p.getRetailPrice().compareTo(currentRemaining) <= 0)
                            .filter(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct))
                            .toList();
                    usedFallback = true;
                } else {
                    usedFallback = false;
                }

                if (candidates.isEmpty()) {
                    throw new BundleGenerationException(
                            BundleGenerationException.FailureCode.INSUFFICIENT_ROLE_COVERAGE,
                            "No candidates for slot: " + slot.getSlotCode());
                }

                // Score descending (preference scoring still applied even in fallback)
                final List<Product> finalCandidates = candidates;
                List<Product> scored = finalCandidates.stream()
                        .sorted((a, b) -> {
                            int scoreA = scoringService.score(a, slot, request,
                                    interestByProduct.getOrDefault(a.getId(), List.of()),
                                    audienceByProduct.getOrDefault(a.getId(), List.of()),
                                    roleByProduct.getOrDefault(a.getId(), List.of()));
                            int scoreB = scoringService.score(b, slot, request,
                                    interestByProduct.getOrDefault(b.getId(), List.of()),
                                    audienceByProduct.getOrDefault(b.getId(), List.of()),
                                    roleByProduct.getOrDefault(b.getId(), List.of()));
                            return Integer.compare(scoreB, scoreA);
                        })
                        .toList();

                // Feasibility pool: eligible for normal path, all active STANDARD for fallback
                //   (audience filter already applied in allActiveAudienceCompatible)
                List<Product> feasibilityPool = usedFallback
                        ? allActiveAudienceCompatible.stream().filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD).toList()
                        : eligible;

                // Find first feasible choice
                Product chosen = null;
                for (Product candidate : scored) {
                    BigDecimal costAfter = currentRemaining.subtract(candidate.getRetailPrice());
                    if (isFeasible(costAfter, remainingSlots, feasibilityPool, selectedIds,
                            candidate.getId(), roleByProduct)) {
                        chosen = candidate;
                        break;
                    }
                }

                if (chosen == null) {
                    throw new BundleGenerationException(
                            BundleGenerationException.FailureCode.NO_BUDGET_FEASIBLE,
                            "Cannot satisfy budget constraint for slot: " + slot.getSlotCode());
                }

                slotSelections.add(new SlotSelection(slot, chosen));
                selectedIds.add(chosen.getId());
                remainingBudget = remainingBudget.subtract(chosen.getRetailPrice());
            }
        }

        // Calculate total COGS and base retail price
        BigDecimal totalCogs = slotSelections.stream()
                .map(s -> s.product().getCost())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal baseRetailPrice = slotSelections.stream()
                .map(s -> s.product().getRetailPrice())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 7. Select upgrades
        UpgradeGenerationService.UpgradeSelection upgradeSelection;
        if (!isConstrained) {
            // PATH 1: highest-scoring STANDARD + PREMIUM from eligible pool
            upgradeSelection = upgradeGenerationService.selectUpgrades(
                    eligible, selectedIds, request, interestByProduct);
        } else {
            // PATH 2: STANDARD = highest interest score, then cheapest; PREMIUM = highest interest score, then cheapest
            BigDecimal remainingForUpgrades = request.maxRetailPrice().subtract(baseRetailPrice);
            upgradeSelection = upgradeGenerationService.selectUpgradesForCeilingPath(
                    eligible, selectedIds, remainingForUpgrades, request.interest(), interestByProduct);
        }

        // 8. Select default gift bag
        GiftBagOption giftBagOption = giftBagOptionRepository.findByIsDefaultTrue()
                .orElseThrow(() -> new BundleGenerationException(
                        BundleGenerationException.FailureCode.NO_GIFT_BAG_CONFIGURED,
                        "No default gift bag option configured"));

        // 9. Persist the full snapshot atomically
        String publicId = "gb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        GeneratedBundle bundle = new GeneratedBundle(
                publicId,
                request.age().shortValue(),
                request.audiencePreference(),
                request.interest(),
                request.partyType(),
                budgetTier,
                template,
                totalCogs
        );

        // Set base retail price (computed above)
        bundle.setBaseRetailPrice(baseRetailPrice);

        // Save bundle first to get its PK
        final GeneratedBundle savedBundle = generatedBundleRepository.save(bundle);

        // Build and save items
        List<GeneratedBundleItem> items = new ArrayList<>();
        for (SlotSelection selection : slotSelections) {
            items.add(new GeneratedBundleItem(
                    savedBundle, selection.slot().getSlotCode(),
                    selection.product(), selection.slot().getDisplayOrder()));
        }

        // Build upgrade based on which products were selected
        Optional<Product> standardOpt = upgradeSelection.standardProduct();
        Optional<Product> premiumOpt = upgradeSelection.premiumProduct();

        GeneratedBundleUpgrade upgrade;
        if (standardOpt.isPresent() && premiumOpt.isPresent()) {
            BigDecimal standardRetailPrice = standardOpt.get().getRetailPrice();
            BigDecimal upgradeDelta = premiumOpt.get().getRetailPrice().subtract(standardRetailPrice);
            upgrade = new GeneratedBundleUpgrade(
                    savedBundle,
                    standardOpt.get(), standardRetailPrice,
                    premiumOpt.get(), upgradeDelta);
        } else if (standardOpt.isPresent()) {
            upgrade = new GeneratedBundleUpgrade(
                    savedBundle, standardOpt.get(), standardOpt.get().getRetailPrice());
        } else {
            upgrade = new GeneratedBundleUpgrade(savedBundle);
        }

        GeneratedBundleGiftBag giftBag = new GeneratedBundleGiftBag(savedBundle, giftBagOption);

        // Attach children — cascade will persist them on next save
        savedBundle.setItems(items);
        savedBundle.setUpgrade(upgrade);
        savedBundle.setGiftBag(giftBag);

        // Re-save to cascade-persist children
        generatedBundleRepository.save(savedBundle);

        // Return fully-loaded entity
        return generatedBundleRepository.findByPublicId(publicId).orElseThrow();
    }

    private boolean hasAnyRole(Long productId, Set<String> allowedRoles,
                                Map<Long, List<ProductRoleAffinity>> roleByProduct) {
        List<ProductRoleAffinity> roles = roleByProduct.getOrDefault(productId, List.of());
        return roles.stream().anyMatch(r -> allowedRoles.contains(r.getRole()));
    }

    /**
     * Returns the interest affinity weight for the given product and interest (0 if absent).
     * Used to score upgrade candidates during budget reservation.
     */
    private int interestScore(Long productId, Interest interest,
                               Map<Long, List<ProductInterestAffinity>> interestByProduct) {
        return interestByProduct.getOrDefault(productId, List.of()).stream()
                .filter(a -> a.getInterest().equals(interest.name()))
                .mapToInt(ProductInterestAffinity::getWeight)
                .findFirst()
                .orElse(0);
    }

    /**
     * Feasibility check: after picking a candidate, can each remaining slot still be satisfied
     * within the remaining retail budget?
     */
    private boolean isFeasible(BigDecimal remainingAfterChoice,
                                List<BundleTemplateSlot> remainingSlots,
                                List<Product> pool,
                                Set<Long> currentSelectedIds,
                                Long candidateId,
                                Map<Long, List<ProductRoleAffinity>> roleByProduct) {
        Set<Long> projectedSelected = new HashSet<>(currentSelectedIds);
        projectedSelected.add(candidateId);

        for (BundleTemplateSlot remainingSlot : remainingSlots) {
            final Set<Long> takenIds = new HashSet<>(projectedSelected);

            boolean anyFit = pool.stream()
                    .filter(p -> !takenIds.contains(p.getId()))
                    .filter(p -> p.getRetailPrice().compareTo(remainingAfterChoice) <= 0)
                    .anyMatch(p -> hasAnyRole(p.getId(), remainingSlot.getAllowedRoles(), roleByProduct));

            if (!anyFit) return false;
        }

        return true;
    }

    /** Simple value record to carry slot + chosen product together. */
    private record SlotSelection(BundleTemplateSlot slot, Product product) {}
}
