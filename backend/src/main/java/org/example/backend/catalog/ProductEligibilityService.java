package org.example.backend.catalog;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProductEligibilityService {

    private final ProductOccasionRepository occasionRepository;

    public ProductEligibilityService(ProductOccasionRepository occasionRepository) {
        this.occasionRepository = occasionRepository;
    }

    /**
     * Filters a list of products to only those eligible for the given age and partyType.
     * Hard constraints only — no scoring.
     */
    public List<Product> filterEligible(int age, PartyType partyType, List<Product> candidates) {
        if (candidates.isEmpty()) {
            return List.of();
        }

        Set<Long> candidateIds = candidates.stream()
                .map(Product::getId)
                .collect(Collectors.toSet());

        List<ProductOccasion> occasions = occasionRepository.findAllByProductIdIn(candidateIds);

        Map<Long, Set<String>> occasionsByProductId = occasions.stream()
                .collect(Collectors.groupingBy(
                        ProductOccasion::getProductId,
                        Collectors.mapping(ProductOccasion::getOccasion, Collectors.toSet())
                ));

        return candidates.stream()
                .filter(p -> isEligible(p, age, partyType, occasionsByProductId))
                .toList();
    }

    /**
     * Checks eligibility using pre-loaded occasion map (avoids repeated DB calls).
     */
    public boolean isEligible(Product product, int age, PartyType partyType,
                               Map<Long, Set<String>> occasionsByProductId) {
        if (!product.isActive()) return false;
        if (age < product.getMinAge() || age > product.getMaxAge()) return false;
        if (product.getInventoryQuantity() <= 0) return false;

        Set<String> productOccasions = occasionsByProductId.getOrDefault(product.getId(), Set.of());
        return productOccasions.contains(partyType.name());
    }

    /**
     * Returns true if the product is compatible with the requested audience preference.
     * Products with no audience affinity (empty list) are neutral — always compatible.
     * Only affinities with weight > 0 are treated as active.
     * MASCULINE     -> must have MASCULINE or UNIVERSAL affinity (weight > 0).
     * FEMININE      -> must have FEMININE  or UNIVERSAL affinity (weight > 0).
     * NO_PREFERENCE -> must have UNIVERSAL affinity (weight > 0); FEMININE-only and MASCULINE-only are excluded.
     */
    public boolean isAudienceCompatible(Long productId, AudiencePreference preference,
                                         Map<Long, List<ProductAudienceAffinity>> audienceByProduct) {
        List<ProductAudienceAffinity> affinities = audienceByProduct.getOrDefault(productId, List.of());
        if (affinities.isEmpty()) return true;

        boolean hasFeminine  = affinities.stream().anyMatch(a -> AudienceAffinity.FEMININE.name().equals(a.getAudience())  && a.getWeight() > 0);
        boolean hasMasculine = affinities.stream().anyMatch(a -> AudienceAffinity.MASCULINE.name().equals(a.getAudience()) && a.getWeight() > 0);
        boolean hasUniversal = affinities.stream().anyMatch(a -> AudienceAffinity.UNIVERSAL.name().equals(a.getAudience()) && a.getWeight() > 0);

        return switch (preference) {
            case MASCULINE     -> hasMasculine || hasUniversal;
            case FEMININE      -> hasFeminine  || hasUniversal;
            case NO_PREFERENCE -> hasUniversal;
        };
    }

    /**
     * Single-product eligibility check — performs its own DB call for occasions.
     */
    public boolean isEligible(Product product, int age, PartyType partyType) {
        if (!product.isActive()) return false;
        if (age < product.getMinAge() || age > product.getMaxAge()) return false;
        if (product.getInventoryQuantity() <= 0) return false;

        List<ProductOccasion> occasions = occasionRepository.findAllByProductIdIn(
                List.of(product.getId()));
        return occasions.stream().anyMatch(o -> o.getOccasion().equals(partyType.name()));
    }
}
