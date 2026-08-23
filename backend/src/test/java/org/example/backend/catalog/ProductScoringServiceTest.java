package org.example.backend.catalog;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ProductScoringServiceTest {

    private ProductScoringService scoringService;

    @BeforeEach
    void setUp() {
        scoringService = new ProductScoringService();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Product buildProduct(long id) {
        try {
            Product p = instantiate(Product.class);
            setField(p, "id", id);
            setField(p, "cost", BigDecimal.valueOf(0.50));
            setField(p, "category", ProductCategory.OTHER);
            setField(p, "formFactor", FormFactor.OTHER);
            setField(p, "upgradeTier", UpgradeTier.STANDARD);
            setField(p, "active", true);
            setField(p, "inventoryQuantity", 100);
            setField(p, "minAge", (short) 6);
            setField(p, "maxAge", (short) 12);
            return p;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BundleTemplateSlot buildSlot(Set<String> roles) {
        try {
            BundleTemplateSlot slot = instantiate(BundleTemplateSlot.class);
            setField(slot, "allowedRoles", roles);
            setField(slot, "slotCode", "UTILITY");
            setField(slot, "displayOrder", (short) 1);
            return slot;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private ProductInterestAffinity buildInterestAff(long productId, String interest, short weight) {
        try {
            ProductInterestAffinity a = instantiate(ProductInterestAffinity.class);
            setField(a, "productId", productId);
            setField(a, "interest", interest);
            setField(a, "weight", weight);
            return a;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private ProductAudienceAffinity buildAudienceAff(long productId, String audience, short weight) {
        try {
            ProductAudienceAffinity a = instantiate(ProductAudienceAffinity.class);
            setField(a, "productId", productId);
            setField(a, "audience", audience);
            setField(a, "weight", weight);
            return a;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private ProductRoleAffinity buildRoleAff(long productId, String role, short weight) {
        try {
            ProductRoleAffinity a = instantiate(ProductRoleAffinity.class);
            setField(a, "productId", productId);
            setField(a, "role", role);
            setField(a, "weight", weight);
            return a;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BundleGenerationRequest buildRequest(Interest interest, AudiencePreference audience) {
        return new BundleGenerationRequest(8, audience, interest, PartyType.CELEBRATION, "LOW", null);
    }

    private <T> T instantiate(Class<T> cls) throws Exception {
        var ctor = cls.getDeclaredConstructor();
        ctor.setAccessible(true);
        return ctor.newInstance();
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

    // ── Interest score tests ───────────────────────────────────────────────────

    @Test
    void interestScore_dominates_evenWithAudiencePenalty() {
        // Product A: high POP_MUSIC affinity (90), but FEMININE affinity → -5 for MASCULINE user
        // Product B: low POP_MUSIC affinity (20), UNIVERSAL affinity → +8 for MASCULINE user
        // Even with -5 penalty, A should score higher: 90-5=85 vs 20+8=28

        Product a = buildProduct(1L);
        Product b = buildProduct(2L);
        BundleTemplateSlot slot = buildSlot(Set.of("UTILITY"));
        BundleGenerationRequest request = buildRequest(Interest.POP_MUSIC, AudiencePreference.MASCULINE);

        List<ProductInterestAffinity> interestAffs = List.of(
                buildInterestAff(1L, "POP_MUSIC", (short) 90),
                buildInterestAff(2L, "POP_MUSIC", (short) 20)
        );
        List<ProductAudienceAffinity> audienceAffs = List.of(
                buildAudienceAff(1L, "FEMININE", (short) 80),
                buildAudienceAff(2L, "UNIVERSAL", (short) 80)
        );
        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "UTILITY", (short) 90),
                buildRoleAff(2L, "UTILITY", (short) 90)
        );

        int scoreA = scoringService.score(a, slot, request, interestAffs, audienceAffs, roleAffs);
        int scoreB = scoringService.score(b, slot, request, interestAffs, audienceAffs, roleAffs);

        assertThat(scoreA).isGreaterThan(scoreB);
    }

    // ── Audience adjustment tests ──────────────────────────────────────────────

    @Test
    void feminineUser_feminineProduct_gets15Adjustment() {
        int adj = scoringService.audienceAdjustment(
                AudiencePreference.FEMININE,
                1L,
                List.of(buildAudienceAff(1L, "FEMININE", (short) 80))
        );
        assertThat(adj).isEqualTo(15);
    }

    @Test
    void masculineUser_feminineOnlyProduct_gets_minus5Adjustment() {
        int adj = scoringService.audienceAdjustment(
                AudiencePreference.MASCULINE,
                1L,
                List.of(buildAudienceAff(1L, "FEMININE", (short) 80))
        );
        assertThat(adj).isEqualTo(-5);
    }

    @Test
    void masculineUser_masculineProduct_gets15Adjustment() {
        int adj = scoringService.audienceAdjustment(
                AudiencePreference.MASCULINE,
                1L,
                List.of(buildAudienceAff(1L, "MASCULINE", (short) 80))
        );
        assertThat(adj).isEqualTo(15);
    }

    @Test
    void anyUser_universalProduct_gets8Adjustment() {
        for (AudiencePreference pref : AudiencePreference.values()) {
            int adj = scoringService.audienceAdjustment(
                    pref,
                    1L,
                    List.of(buildAudienceAff(1L, "UNIVERSAL", (short) 80))
            );
            assertThat(adj).isGreaterThanOrEqualTo(8);
        }
    }

    // ── Role score tests ───────────────────────────────────────────────────────

    @Test
    void higherRoleWeight_scoresHigher() {
        // Product with 100 role weight should score higher than product with 30 role weight.
        // roleScore = weight * 20 / 100: 100→20, 30→6

        Product a = buildProduct(1L);
        Product b = buildProduct(2L);
        BundleTemplateSlot slot = buildSlot(Set.of("UTILITY"));
        BundleGenerationRequest request = buildRequest(Interest.POP_MUSIC, AudiencePreference.NO_PREFERENCE);

        // Same interest score for both (absent → 0)
        List<ProductInterestAffinity> interestAffs = List.of();
        List<ProductAudienceAffinity> audienceAffs = List.of(
                buildAudienceAff(1L, "UNIVERSAL", (short) 80),
                buildAudienceAff(2L, "UNIVERSAL", (short) 80)
        );
        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "UTILITY", (short) 100),
                buildRoleAff(2L, "UTILITY", (short) 30)
        );

        int scoreA = scoringService.score(a, slot, request, interestAffs, audienceAffs, roleAffs);
        int scoreB = scoringService.score(b, slot, request, interestAffs, audienceAffs, roleAffs);

        assertThat(scoreA).isGreaterThan(scoreB);
    }

    @Test
    void roleScore_noMatchingRole_returnsZero() {
        int roleScore = scoringService.bestRoleScore(
                Set.of("UTILITY"),
                1L,
                List.of(buildRoleAff(1L, "TACTILE", (short) 100))
        );
        assertThat(roleScore).isZero();
    }

    @Test
    void roleScore_matchingRole_scalesCorrectly() {
        // weight=100 → roleScore = 100 * 20 / 100 = 20
        int roleScore = scoringService.bestRoleScore(
                Set.of("UTILITY"),
                1L,
                List.of(buildRoleAff(1L, "UTILITY", (short) 100))
        );
        assertThat(roleScore).isEqualTo(20);
    }
}
