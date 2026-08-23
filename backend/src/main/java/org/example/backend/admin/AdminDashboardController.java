package org.example.backend.admin;

import org.example.backend.analytics.AnalyticsEventRepository;
import org.example.backend.catalog.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin/api/dashboard")
public class AdminDashboardController {

    private static final int[]              AGE_MIDPOINTS = {4, 7, 10};
    private static final String[]           AGE_LABELS    = {"3-5", "6-8", "9-12"};
    private static final Interest[]         INTERESTS     = Interest.values();
    private static final AudiencePreference[] AUDIENCES   = AudiencePreference.values();
    private static final PartyType[]        PARTY_TYPES   = PartyType.values();

    private final AnalyticsEventRepository         analyticsEventRepository;
    private final ProductRepository                productRepository;
    private final ProductInterestAffinityRepository interestAffinityRepository;
    private final ProductAudienceAffinityRepository audienceAffinityRepository;
    private final ProductOccasionRepository        occasionRepository;
    private final ProductRoleAffinityRepository    roleAffinityRepository;
    private final BundleTemplateRepository         bundleTemplateRepository;
    private final BudgetTierRepository             budgetTierRepository;
    private final BundleSimulationService          simulationService;

    public AdminDashboardController(
            AnalyticsEventRepository analyticsEventRepository,
            ProductRepository productRepository,
            ProductInterestAffinityRepository interestAffinityRepository,
            ProductAudienceAffinityRepository audienceAffinityRepository,
            ProductOccasionRepository occasionRepository,
            ProductRoleAffinityRepository roleAffinityRepository,
            BundleTemplateRepository bundleTemplateRepository,
            BudgetTierRepository budgetTierRepository,
            BundleSimulationService simulationService) {
        this.analyticsEventRepository  = analyticsEventRepository;
        this.productRepository         = productRepository;
        this.interestAffinityRepository = interestAffinityRepository;
        this.audienceAffinityRepository = audienceAffinityRepository;
        this.occasionRepository        = occasionRepository;
        this.roleAffinityRepository    = roleAffinityRepository;
        this.bundleTemplateRepository  = bundleTemplateRepository;
        this.budgetTierRepository      = budgetTierRepository;
        this.simulationService         = simulationService;
    }

    record DashboardDto(long finderCompletions, long bundleViews) {}

    record ProductSimulationDto(
            Long productId,
            String name,
            int appearanceCount,
            int totalCombinations,
            List<String> agesCovered,
            List<String> audiencesCovered,
            List<String> partyTypesCovered,
            List<String> interestsCovered,
            List<String> budgetsCovered
    ) {}

    @GetMapping("/")
    public DashboardDto getDashboard() {
        long finderCompletions = analyticsEventRepository.countByEventType("FINDER_COMPLETED");
        long bundleViews       = analyticsEventRepository.countByEventType("BUNDLE_VIEWED");
        return new DashboardDto(finderCompletions, bundleViews);
    }

    @GetMapping("/product-coverage")
    @Transactional(readOnly = true)
    public List<ProductSimulationDto> getProductCoverage() {
        // ── Load catalogue data (once) ────────────────────────────────────────
        List<Product> allActive = productRepository.findAllByActiveTrue();
        if (allActive.isEmpty()) return List.of();

        Set<Long> ids = allActive.stream().map(Product::getId).collect(Collectors.toSet());

        Map<Long, List<ProductInterestAffinity>> interestByProduct =
                interestAffinityRepository.findAllByProductIdIn(ids).stream()
                        .collect(Collectors.groupingBy(ProductInterestAffinity::getProductId));

        Map<Long, List<ProductAudienceAffinity>> audienceByProduct =
                audienceAffinityRepository.findAllByProductIdIn(ids).stream()
                        .collect(Collectors.groupingBy(ProductAudienceAffinity::getProductId));

        Map<Long, Set<String>> occasionsByProduct =
                occasionRepository.findAllByProductIdIn(ids).stream()
                        .collect(Collectors.groupingBy(
                                ProductOccasion::getProductId,
                                Collectors.mapping(ProductOccasion::getOccasion, Collectors.toSet())));

        Map<Long, List<ProductRoleAffinity>> roleByProduct =
                roleAffinityRepository.findAllByProductIdIn(ids).stream()
                        .collect(Collectors.groupingBy(ProductRoleAffinity::getProductId));

        // ── Load and initialize templates (slots are LAZY on BundleTemplate) ─
        Map<String, List<BundleTemplateSlot>> slotsByCode = new HashMap<>();
        for (BundleTemplate t : bundleTemplateRepository.findAllByActiveTrue()) {
            List<BundleTemplateSlot> slots = t.getSlots();
            slots.forEach(s -> s.getAllowedRoles().size()); // force-init allowedRoles (EAGER, but triggers slot proxy)
            slotsByCode.put(t.getCode(), List.copyOf(slots));
        }

        // ── Load active budget tiers ──────────────────────────────────────────
        List<BudgetTier> budgetTiers = budgetTierRepository.findAll().stream()
                .filter(BudgetTier::isActive)
                .toList();
        if (budgetTiers.isEmpty()) return List.of();

        // ── Per-product tracking structures ───────────────────────────────────
        Map<Long, Integer>     appearanceCount    = new HashMap<>();
        Map<Long, Set<String>> agesCovered        = new HashMap<>();
        Map<Long, Set<String>> audiencesCovered   = new HashMap<>();
        Map<Long, Set<String>> partyTypesCovered  = new HashMap<>();
        Map<Long, Set<String>> interestsCovered   = new HashMap<>();
        Map<Long, Set<String>> budgetsCovered     = new HashMap<>();

        for (Product p : allActive) {
            Long pid = p.getId();
            appearanceCount.put(pid, 0);
            agesCovered.put(pid,       new LinkedHashSet<>());
            audiencesCovered.put(pid,  new LinkedHashSet<>());
            partyTypesCovered.put(pid, new LinkedHashSet<>());
            interestsCovered.put(pid,  new LinkedHashSet<>());
            budgetsCovered.put(pid,    new LinkedHashSet<>());
        }

        int totalCombinations = AGE_MIDPOINTS.length * INTERESTS.length
                * AUDIENCES.length * PARTY_TYPES.length * budgetTiers.size();

        // ── Run simulation ────────────────────────────────────────────────────
        for (int ai = 0; ai < AGE_MIDPOINTS.length; ai++) {
            int age = AGE_MIDPOINTS[ai];
            String ageLabel = AGE_LABELS[ai];

            for (Interest interest : INTERESTS) {
                List<BundleTemplateSlot> slots = resolveSlots(age, interest, slotsByCode);
                if (slots == null || slots.isEmpty()) continue;

                for (AudiencePreference audience : AUDIENCES) {
                    for (PartyType partyType : PARTY_TYPES) {
                        for (BudgetTier tier : budgetTiers) {

                            BundleGenerationRequest req = new BundleGenerationRequest(
                                    age, audience, interest, partyType,
                                    tier.getCode(), tier.getTargetRetailPrice());

                            Optional<Set<Long>> result = simulationService.simulate(
                                    req, slots, allActive,
                                    interestByProduct, audienceByProduct,
                                    occasionsByProduct, roleByProduct);

                            if (result.isEmpty()) continue;

                            for (Long pid : result.get()) {
                                if (!appearanceCount.containsKey(pid)) continue; // inactive product snuck in
                                appearanceCount.merge(pid, 1, Integer::sum);
                                agesCovered.get(pid).add(ageLabel);
                                audiencesCovered.get(pid).add(audience.name());
                                partyTypesCovered.get(pid).add(partyType.name());
                                interestsCovered.get(pid).add(interest.name());
                                budgetsCovered.get(pid).add(tier.getCode());
                            }
                        }
                    }
                }
            }
        }

        // ── Build and sort result ─────────────────────────────────────────────
        List<ProductSimulationDto> result = new ArrayList<>();
        for (Product p : allActive) {
            Long pid = p.getId();
            result.add(new ProductSimulationDto(
                    pid,
                    p.getName(),
                    appearanceCount.get(pid),
                    totalCombinations,
                    new ArrayList<>(agesCovered.get(pid)),
                    new ArrayList<>(audiencesCovered.get(pid)),
                    new ArrayList<>(partyTypesCovered.get(pid)),
                    new ArrayList<>(interestsCovered.get(pid)),
                    new ArrayList<>(budgetsCovered.get(pid))
            ));
        }

        result.sort(Comparator.comparingInt(ProductSimulationDto::appearanceCount));
        return result;
    }

    /** Mirrors BundleTemplateSelector logic but uses pre-loaded slots (no DB call). */
    private List<BundleTemplateSlot> resolveSlots(int age, Interest interest,
                                                   Map<String, List<BundleTemplateSlot>> slotsByCode) {
        if (age <= 5) return slotsByCode.get("PRESCHOOL_4_ITEM");
        if (interest == Interest.READING_PUZZLE && slotsByCode.containsKey("READING_PUZZLE_4_ITEM")) {
            return slotsByCode.get("READING_PUZZLE_4_ITEM");
        }
        return slotsByCode.get("GENERAL_4_ITEM");
    }
}
