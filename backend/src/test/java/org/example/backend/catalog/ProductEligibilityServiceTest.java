package org.example.backend.catalog;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductEligibilityServiceTest {

    @Mock
    private ProductOccasionRepository occasionRepository;

    @InjectMocks
    private ProductEligibilityService eligibilityService;

    /** Builds a minimal Product via reflection to avoid needing setters on the entity. */
    private Product buildProduct(long id, short minAge, short maxAge, boolean active, int inventory) {
        try {
            Product p = instantiate(Product.class);
            setField(p, "id", id);
            setField(p, "minAge", minAge);
            setField(p, "maxAge", maxAge);
            setField(p, "active", active);
            setField(p, "inventoryQuantity", inventory);
            setField(p, "cost", BigDecimal.valueOf(0.50));
            setField(p, "category", ProductCategory.OTHER);
            setField(p, "formFactor", FormFactor.OTHER);
            setField(p, "upgradeTier", UpgradeTier.STANDARD);
            return p;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private ProductOccasion buildOccasion(long productId, String occasion) {
        try {
            ProductOccasion o = instantiate(ProductOccasion.class);
            setField(o, "productId", productId);
            setField(o, "occasion", occasion);
            return o;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private <T> T instantiate(Class<T> cls) throws Exception {
        var constructor = cls.getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }

    private void setField(Object obj, String fieldName, Object value) throws Exception {
        Field field = findField(obj.getClass(), fieldName);
        field.setAccessible(true);
        field.set(obj, value);
    }

    private Field findField(Class<?> cls, String name) throws NoSuchFieldException {
        try {
            return cls.getDeclaredField(name);
        } catch (NoSuchFieldException e) {
            if (cls.getSuperclass() != null) return findField(cls.getSuperclass(), name);
            throw e;
        }
    }

    // ── Age range tests ───────────────────────────────────────────────────────

    @Test
    void age8_withinRange6to9_isEligible() {
        Product p = buildProduct(1L, (short) 6, (short) 9, true, 10);
        ProductOccasion occ = buildOccasion(1L, "CELEBRATION");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.CELEBRATION, List.of(p));

        assertThat(result).containsExactly(p);
    }

    @Test
    void age5_belowMinAge6_isExcluded() {
        Product p = buildProduct(1L, (short) 6, (short) 9, true, 10);
        ProductOccasion occ = buildOccasion(1L, "CELEBRATION");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ));

        List<Product> result = eligibilityService.filterEligible(5, PartyType.CELEBRATION, List.of(p));

        assertThat(result).isEmpty();
    }

    @Test
    void age10_aboveMaxAge9_isExcluded() {
        Product p = buildProduct(1L, (short) 6, (short) 9, true, 10);
        ProductOccasion occ = buildOccasion(1L, "CELEBRATION");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ));

        List<Product> result = eligibilityService.filterEligible(10, PartyType.CELEBRATION, List.of(p));

        assertThat(result).isEmpty();
    }

    // ── Occasion tests ────────────────────────────────────────────────────────

    @Test
    void halloweenOnlyProduct_withCelebrationRequest_isExcluded() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        ProductOccasion halloweenOcc = buildOccasion(1L, "HALLOWEEN");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(halloweenOcc));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.CELEBRATION, List.of(p));

        assertThat(result).isEmpty();
    }

    @Test
    void celebrationOnlyProduct_withHalloweenRequest_isExcluded() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        ProductOccasion celebOcc = buildOccasion(1L, "CELEBRATION");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(celebOcc));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.HALLOWEEN, List.of(p));

        assertThat(result).isEmpty();
    }

    @Test
    void bothOccasionProduct_withCelebration_isEligible() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        ProductOccasion occ1 = buildOccasion(1L, "CELEBRATION");
        ProductOccasion occ2 = buildOccasion(1L, "HALLOWEEN");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ1, occ2));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.CELEBRATION, List.of(p));

        assertThat(result).containsExactly(p);
    }

    @Test
    void bothOccasionProduct_withHalloween_isEligible() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        ProductOccasion occ1 = buildOccasion(1L, "CELEBRATION");
        ProductOccasion occ2 = buildOccasion(1L, "HALLOWEEN");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ1, occ2));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.HALLOWEEN, List.of(p));

        assertThat(result).containsExactly(p);
    }

    // ── Active / inventory tests ───────────────────────────────────────────────

    @Test
    void inactiveProduct_isExcluded_regardlessOfAgeAndOccasion() {
        Product p = buildProduct(1L, (short) 6, (short) 12, false, 100);
        // No need to stub occasions — active check happens first
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());

        List<Product> result = eligibilityService.filterEligible(8, PartyType.CELEBRATION, List.of(p));

        assertThat(result).isEmpty();
    }

    @Test
    void zeroInventory_isExcluded() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 0);
        ProductOccasion occ = buildOccasion(1L, "CELEBRATION");
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of(occ));

        List<Product> result = eligibilityService.filterEligible(8, PartyType.CELEBRATION, List.of(p));

        assertThat(result).isEmpty();
    }

    // ── Pre-loaded map variant ────────────────────────────────────────────────

    @Test
    void isEligibleWithMap_activeInRangeWithMatchingOccasion_returnsTrue() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        Map<Long, Set<String>> occasions = Map.of(1L, Set.of("CELEBRATION"));

        assertThat(eligibilityService.isEligible(p, 8, PartyType.CELEBRATION, occasions)).isTrue();
    }

    @Test
    void isEligibleWithMap_noOccasionEntry_returnsFalse() {
        Product p = buildProduct(1L, (short) 6, (short) 12, true, 10);
        Map<Long, Set<String>> occasions = Map.of(); // no entry for product 1

        assertThat(eligibilityService.isEligible(p, 8, PartyType.CELEBRATION, occasions)).isFalse();
    }
}
