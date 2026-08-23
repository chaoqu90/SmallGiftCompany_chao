package org.example.backend.catalog;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.OptionalInt;
import java.util.Set;

@Service
public class ProductScoringService {

    /**
     * Scores a product for a given slot and generation request.
     *
     * Formula:
     *   interestScore  = interest affinity weight for request.interest (0 if absent)
     *   audienceAdj    = audienceAdjustment(request.audiencePreference, audienceAffinities)
     *   roleScore      = bestRoleAffinity(slot.allowedRoles, roleAffinities) * 20 / 100
     *   total          = interestScore + audienceAdj + roleScore
     */
    public int score(Product product,
                     BundleTemplateSlot slot,
                     BundleGenerationRequest request,
                     List<ProductInterestAffinity> interestAffinities,
                     List<ProductAudienceAffinity> audienceAffinities,
                     List<ProductRoleAffinity> roleAffinities) {

        int interestScore = interestAffinities.stream()
                .filter(a -> a.getProductId().equals(product.getId())
                        && a.getInterest().equals(request.interest().name()))
                .mapToInt(a -> a.getWeight())
                .findFirst()
                .orElse(0);

        int audienceAdj = audienceAdjustment(request.audiencePreference(), product.getId(), audienceAffinities);

        int roleScore = bestRoleScore(slot.getAllowedRoles(), product.getId(), roleAffinities);

        return interestScore + audienceAdj + roleScore;
    }

    /**
     * Computes audience adjustment for a specific product from pre-loaded affinities.
     *
     * Rules:
     * - FEMININE user + product has FEMININE affinity → +15
     * - MASCULINE user + product has MASCULINE affinity → +15
     * - Any user + product has UNIVERSAL affinity → +8
     * - NO_PREFERENCE user: only universal bonus applies
     * - FEMININE user + product MASCULINE only (no UNIVERSAL) → -5
     * - MASCULINE user + product FEMININE only (no UNIVERSAL) → -5
     * - Use max of applicable adjustments to avoid double-adding UNIVERSAL
     */
    int audienceAdjustment(AudiencePreference preference, Long productId,
                           List<ProductAudienceAffinity> audienceAffinities) {
        boolean hasFeminine = false;
        boolean hasMasculine = false;
        boolean hasUniversal = false;

        for (ProductAudienceAffinity aff : audienceAffinities) {
            if (!aff.getProductId().equals(productId)) continue;
            if (aff.getWeight() <= 0) continue;
            String audience = aff.getAudience();
            if (AudienceAffinity.FEMININE.name().equals(audience))  hasFeminine = true;
            if (AudienceAffinity.MASCULINE.name().equals(audience)) hasMasculine = true;
            if (AudienceAffinity.UNIVERSAL.name().equals(audience)) hasUniversal = true;
        }

        int universalBonus = hasUniversal ? 8 : 0;

        return switch (preference) {
            case FEMININE -> {
                if (hasFeminine) yield Math.max(15, universalBonus);
                if (hasMasculine && !hasUniversal) yield -5;
                yield universalBonus;
            }
            case MASCULINE -> {
                if (hasMasculine) yield Math.max(15, universalBonus);
                if (hasFeminine && !hasUniversal) yield -5;
                yield universalBonus;
            }
            case NO_PREFERENCE -> universalBonus;
        };
    }

    /**
     * Returns 0-20 role score: highest matching role weight / 5.
     */
    int bestRoleScore(Set<String> allowedRoles, Long productId,
                      List<ProductRoleAffinity> roleAffinities) {
        OptionalInt max = roleAffinities.stream()
                .filter(r -> r.getProductId().equals(productId)
                        && allowedRoles.contains(r.getRole()))
                .mapToInt(r -> r.getWeight())
                .max();
        return max.isPresent() ? max.getAsInt() * 20 / 100 : 0;
    }
}
