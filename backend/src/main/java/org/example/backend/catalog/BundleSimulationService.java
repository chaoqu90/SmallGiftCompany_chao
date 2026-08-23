package org.example.backend.catalog;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

/**
 * Runs bundle selection logic in-memory (no DB writes) for analytics simulation.
 * Mirrors PATH 2 slot-selection and upgrade logic from BundleGenerationService.
 */
@Service
public class BundleSimulationService {

    private final ProductEligibilityService eligibilityService;
    private final ProductScoringService scoringService;
    private final UpgradeGenerationService upgradeGenerationService;

    public BundleSimulationService(
            ProductEligibilityService eligibilityService,
            ProductScoringService scoringService,
            UpgradeGenerationService upgradeGenerationService) {
        this.eligibilityService = eligibilityService;
        this.scoringService = scoringService;
        this.upgradeGenerationService = upgradeGenerationService;
    }

    /**
     * Simulates one bundle generation combination in-memory (no DB writes).
     *
     * Returns the IDs of all selected products (4 slot items + standard upgrade + premium upgrade)
     * or empty Optional if the combination is infeasible for any reason.
     *
     * Uses PATH 2 (constrained) logic with request.maxRetailPrice() as the ceiling.
     *
     * @param request   generation request (age, audience, interest, partyType, budgetTierCode, maxRetailPrice)
     * @param slots     pre-loaded and initialized template slots for this age/interest combination
     * @param allActive all active products (unfiltered)
     */
    public Optional<Set<Long>> simulate(
            BundleGenerationRequest request,
            List<BundleTemplateSlot> slots,
            List<Product> allActive,
            Map<Long, List<ProductInterestAffinity>> interestByProduct,
            Map<Long, List<ProductAudienceAffinity>> audienceByProduct,
            Map<Long, Set<String>> occasionsByProduct,
            Map<Long, List<ProductRoleAffinity>> roleByProduct) {

        try {
            BigDecimal ceiling = request.maxRetailPrice();
            if (ceiling == null || slots == null || slots.isEmpty()) return Optional.empty();

            // 1. Age + party type eligibility
            List<Product> eligible = allActive.stream()
                    .filter(p -> eligibilityService.isEligible(
                            p, request.age(), request.partyType(), occasionsByProduct))
                    .toList();

            // 2. Hard audience filter
            eligible = eligible.stream()
                    .filter(p -> eligibilityService.isAudienceCompatible(
                            p.getId(), request.audiencePreference(), audienceByProduct))
                    .toList();
            final List<Product> audienceCompatible = allActive.stream()
                    .filter(p -> eligibilityService.isAudienceCompatible(
                            p.getId(), request.audiencePreference(), audienceByProduct))
                    .toList();

            if (eligible.isEmpty()) return Optional.empty();

            // 3. Constrained slot selection (PATH 2)
            // Phase A: reserve standard upgrade retail price
            Optional<Product> reserveStd = eligible.stream()
                    .filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD)
                    .max(Comparator.comparingInt((Product p) ->
                            interestScore(p.getId(), request.interest(), interestByProduct))
                            .thenComparing(Comparator.comparing(Product::getRetailPrice).reversed()));

            BigDecimal upgradeReserve = reserveStd.map(Product::getRetailPrice).orElse(BigDecimal.ZERO);
            BigDecimal slotBudget = ceiling.subtract(upgradeReserve);
            if (slotBudget.compareTo(BigDecimal.ZERO) <= 0) slotBudget = ceiling;

            BigDecimal remainingBudget = slotBudget;
            Set<Long> selectedIds = new HashSet<>();
            BigDecimal baseRetail = BigDecimal.ZERO;

            for (int i = 0; i < slots.size(); i++) {
                BundleTemplateSlot slot = slots.get(i);
                final BigDecimal currentRemaining = remainingBudget;
                List<BundleTemplateSlot> remainingSlots = slots.subList(i + 1, slots.size());

                List<Product> candidates = eligible.stream()
                        .filter(p -> !selectedIds.contains(p.getId()))
                        .filter(p -> p.getRetailPrice().compareTo(currentRemaining) <= 0)
                        .filter(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct))
                        .toList();

                final boolean fallback;
                if (candidates.isEmpty()) {
                    candidates = audienceCompatible.stream()
                            .filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD)
                            .filter(p -> !selectedIds.contains(p.getId()))
                            .filter(p -> p.getRetailPrice().compareTo(currentRemaining) <= 0)
                            .filter(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct))
                            .toList();
                    fallback = true;
                } else {
                    fallback = false;
                }

                if (candidates.isEmpty()) return Optional.empty();

                List<Product> feasibilityPool = fallback
                        ? audienceCompatible.stream().filter(p -> p.getUpgradeTier() == UpgradeTier.STANDARD).toList()
                        : eligible;

                List<Product> scored = candidates.stream()
                        .sorted((a, b) -> Integer.compare(
                                scoringService.score(b, slot, request,
                                        interestByProduct.getOrDefault(b.getId(), List.of()),
                                        audienceByProduct.getOrDefault(b.getId(), List.of()),
                                        roleByProduct.getOrDefault(b.getId(), List.of())),
                                scoringService.score(a, slot, request,
                                        interestByProduct.getOrDefault(a.getId(), List.of()),
                                        audienceByProduct.getOrDefault(a.getId(), List.of()),
                                        roleByProduct.getOrDefault(a.getId(), List.of()))))
                        .toList();

                Product chosen = null;
                for (Product candidate : scored) {
                    BigDecimal costAfter = currentRemaining.subtract(candidate.getRetailPrice());
                    if (isFeasible(costAfter, remainingSlots, feasibilityPool, selectedIds,
                            candidate.getId(), roleByProduct)) {
                        chosen = candidate;
                        break;
                    }
                }

                if (chosen == null) return Optional.empty();

                selectedIds.add(chosen.getId());
                remainingBudget = remainingBudget.subtract(chosen.getRetailPrice());
                baseRetail = baseRetail.add(chosen.getRetailPrice());
            }

            // 4. Upgrade selection (ceiling path)
            BigDecimal remainingForUpgrades = ceiling.subtract(baseRetail);
            UpgradeGenerationService.UpgradeSelection upgrades =
                    upgradeGenerationService.selectUpgradesForCeilingPath(
                            eligible, selectedIds, remainingForUpgrades, request.interest(), interestByProduct);

            Set<Long> result = new HashSet<>(selectedIds);
            upgrades.standardProduct().ifPresent(p -> result.add(p.getId()));
            upgrades.premiumProduct().ifPresent(p -> result.add(p.getId()));

            return Optional.of(result);

        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private boolean hasAnyRole(Long productId, Set<String> allowedRoles,
                                Map<Long, List<ProductRoleAffinity>> roleByProduct) {
        return roleByProduct.getOrDefault(productId, List.of()).stream()
                .anyMatch(r -> allowedRoles.contains(r.getRole()));
    }

    private boolean isFeasible(BigDecimal remaining, List<BundleTemplateSlot> remainingSlots,
                                List<Product> pool, Set<Long> selected, Long candidateId,
                                Map<Long, List<ProductRoleAffinity>> roleByProduct) {
        Set<Long> projected = new HashSet<>(selected);
        projected.add(candidateId);
        for (BundleTemplateSlot slot : remainingSlots) {
            final Set<Long> taken = new HashSet<>(projected);
            boolean anyFit = pool.stream()
                    .filter(p -> !taken.contains(p.getId()))
                    .filter(p -> p.getRetailPrice().compareTo(remaining) <= 0)
                    .anyMatch(p -> hasAnyRole(p.getId(), slot.getAllowedRoles(), roleByProduct));
            if (!anyFit) return false;
        }
        return true;
    }

    private int interestScore(Long productId, Interest interest,
                               Map<Long, List<ProductInterestAffinity>> interestByProduct) {
        return interestByProduct.getOrDefault(productId, List.of()).stream()
                .filter(a -> a.getInterest().equals(interest.name()))
                .mapToInt(ProductInterestAffinity::getWeight)
                .findFirst()
                .orElse(0);
    }
}
