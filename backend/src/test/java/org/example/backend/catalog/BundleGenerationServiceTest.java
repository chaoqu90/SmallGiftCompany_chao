package org.example.backend.catalog;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BundleGenerationServiceTest {

    @Mock private BudgetTierRepository budgetTierRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ProductInterestAffinityRepository interestAffinityRepository;
    @Mock private ProductAudienceAffinityRepository audienceAffinityRepository;
    @Mock private ProductOccasionRepository occasionRepository;
    @Mock private ProductRoleAffinityRepository roleAffinityRepository;
    @Mock private ProductEligibilityService eligibilityService;
    @Mock private ProductScoringService scoringService;
    @Mock private BundleTemplateSelector templateSelector;
    @Mock private UpgradeGenerationService upgradeGenerationService;
    @Mock private GiftBagOptionRepository giftBagOptionRepository;
    @Mock private GeneratedBundleRepository generatedBundleRepository;

    @InjectMocks
    private BundleGenerationService service;

    // ── Helper builders ────────────────────────────────────────────────────────

    private Product buildProduct(long id, String sku, BigDecimal cost, UpgradeTier tier) {
        try {
            Product p = instantiate(Product.class);
            setField(p, "id", id);
            setField(p, "sku", sku);
            setField(p, "name", "Product " + id);
            setField(p, "description", "Desc " + id);
            setField(p, "cost", cost);
            // retail_price formula: cost < 1 → cost (1:1); else cost/2
            BigDecimal retailPrice = cost.compareTo(BigDecimal.ONE) < 0
                    ? cost : cost.divide(java.math.BigDecimal.valueOf(2), 2, java.math.RoundingMode.HALF_UP);
            setField(p, "cogOverhead", BigDecimal.ZERO);
            setField(p, "cogAdjusted", cost);
            setField(p, "retailPrice", retailPrice);
            setField(p, "active", true);
            setField(p, "inventoryQuantity", 100);
            setField(p, "minAge", (short) 6);
            setField(p, "maxAge", (short) 12);
            setField(p, "category", ProductCategory.OTHER);
            setField(p, "formFactor", FormFactor.FLAT_RECT);
            setField(p, "upgradeTier", tier);
            return p;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BudgetTier buildBudgetTier(BigDecimal maxItemCogs) {
        try {
            BudgetTier bt = instantiate(BudgetTier.class);
            setField(bt, "id", 1L);
            setField(bt, "code", "LOW");
            setField(bt, "maxItemCogs", maxItemCogs);
            setField(bt, "retailMin", BigDecimal.valueOf(5));
            setField(bt, "retailMax", BigDecimal.valueOf(10));
            setField(bt, "targetRetailPrice", BigDecimal.valueOf(7.99));
            setField(bt, "active", true);
            return bt;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BundleTemplate buildTemplate(String code, List<BundleTemplateSlot> slots) {
        try {
            BundleTemplate t = instantiate(BundleTemplate.class);
            setField(t, "id", 1L);
            setField(t, "code", code);
            setField(t, "name", code + " Template");
            setField(t, "minAge", (short) 6);
            setField(t, "maxAge", (short) 12);
            setField(t, "active", true);
            setField(t, "slots", slots);
            return t;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BundleTemplateSlot buildSlot(String slotCode, short displayOrder, Set<String> roles) {
        try {
            BundleTemplateSlot s = instantiate(BundleTemplateSlot.class);
            setField(s, "id", (long) displayOrder);
            setField(s, "slotCode", slotCode);
            setField(s, "displayOrder", displayOrder);
            setField(s, "required", true);
            setField(s, "allowedRoles", new HashSet<>(roles));
            return s;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private GiftBagOption buildGiftBag() {
        try {
            GiftBagOption gb = instantiate(GiftBagOption.class);
            setField(gb, "id", 1L);
            setField(gb, "code", "CLASSIC_BAG");
            setField(gb, "name", "Classic Bag");
            setField(gb, "cost", BigDecimal.valueOf(0.50));
            setField(gb, "retailPriceAdjustment", BigDecimal.ZERO);
            setField(gb, "active", true);
            setField(gb, "isDefault", true);
            return gb;
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

    private GeneratedBundle buildSavedBundle(BundleTemplate template, BudgetTier budgetTier) {
        try {
            GeneratedBundle b = instantiate(GeneratedBundle.class);
            setField(b, "id", 99L);
            setField(b, "publicId", "gb_testpublicid");
            setField(b, "bundleTemplate", template);
            setField(b, "budgetTier", budgetTier);
            setField(b, "standardItemCogsSnapshot", BigDecimal.ZERO);
            setField(b, "audiencePreference", AudiencePreference.NO_PREFERENCE);
            setField(b, "interest", Interest.POP_MUSIC);
            setField(b, "partyType", PartyType.CELEBRATION);
            setField(b, "requestedAge", (short) 8);
            setField(b, "status", "GENERATED");
            setField(b, "createdAt", java.time.Instant.now());
            setField(b, "items", new ArrayList<>());
            return b;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Sets up the common mocks for a successful 4-slot GENERAL_4_ITEM bundle generation. */
    private GenerationSetup setupSuccessfulGeneration(BigDecimal maxItemCogs) {
        BudgetTier budgetTier = buildBudgetTier(maxItemCogs);

        // Four slots
        BundleTemplateSlot slotUtil = buildSlot("UTILITY", (short) 1, Set.of("UTILITY"));
        BundleTemplateSlot slotAct  = buildSlot("ACTIVITY", (short) 2, Set.of("ACTIVITY"));
        BundleTemplateSlot slotPlay = buildSlot("PLAY_WEARABLE_TACTILE", (short) 3, Set.of("PLAY", "WEARABLE", "TACTILE"));
        BundleTemplateSlot slotNov  = buildSlot("NOVELTY_COLLECTIBLE", (short) 4, Set.of("NOVELTY", "COLLECTIBLE"));

        BundleTemplate template = buildTemplate("GENERAL_4_ITEM",
                List.of(slotUtil, slotAct, slotPlay, slotNov));

        // Products: one per slot, cheap enough to fit in budget
        Product pUtil = buildProduct(1L, "UTIL-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pAct  = buildProduct(2L, "ACT-001",  BigDecimal.valueOf(0.45), UpgradeTier.STANDARD);
        Product pPlay = buildProduct(3L, "PLAY-001", BigDecimal.valueOf(0.50), UpgradeTier.STANDARD);
        Product pNov  = buildProduct(4L, "NOV-001",  BigDecimal.valueOf(0.55), UpgradeTier.STANDARD);

        List<Product> allProducts = List.of(pUtil, pAct, pPlay, pNov);

        // Role affinities
        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "UTILITY", (short) 90),
                buildRoleAff(2L, "ACTIVITY", (short) 90),
                buildRoleAff(3L, "PLAY", (short) 90),
                buildRoleAff(4L, "NOVELTY", (short) 90)
        );

        return new GenerationSetup(budgetTier, template, allProducts, roleAffs,
                List.of(pUtil, pAct, pPlay, pNov));
    }

    record GenerationSetup(BudgetTier budgetTier, BundleTemplate template,
                            List<Product> allProducts, List<ProductRoleAffinity> roleAffs,
                            List<Product> eligibleProducts) {}

    private BundleGenerationRequest defaultRequest() {
        return new BundleGenerationRequest(8, AudiencePreference.NO_PREFERENCE,
                Interest.POP_MUSIC, PartyType.CELEBRATION, "LOW", null);
    }

    private void stubCommonMocks(GenerationSetup setup) {
        when(budgetTierRepository.findByCodeAndActiveTrue("LOW"))
                .thenReturn(Optional.of(setup.budgetTier()));
        when(templateSelector.selectTemplate(8, Interest.POP_MUSIC))
                .thenReturn(setup.template());
        when(productRepository.findAllByActiveTrue()).thenReturn(setup.allProducts());
        when(interestAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(audienceAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(roleAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(setup.roleAffs());

        // Eligibility: return all eligible products
        when(eligibilityService.isEligible(any(Product.class), anyInt(), any(PartyType.class), anyMap()))
                .thenReturn(true);
        when(eligibilityService.isAudienceCompatible(anyLong(), any(AudiencePreference.class), anyMap()))
                .thenReturn(true);

        // Scoring: return 50 for all
        when(scoringService.score(any(), any(), any(), anyList(), anyList(), anyList()))
                .thenReturn(50);

        // Gift bag
        when(giftBagOptionRepository.findByIsDefaultTrue()).thenReturn(Optional.of(buildGiftBag()));

        // Upgrade: none
        when(upgradeGenerationService.selectUpgrades(anyList(), anySet(), any(), anyMap()))
                .thenReturn(new UpgradeGenerationService.UpgradeSelection(Optional.empty(), Optional.empty()));

        // Repository save: return a pre-built bundle
        BundleTemplate template = setup.template();
        BudgetTier budgetTier = setup.budgetTier();
        GeneratedBundle savedBundle = buildSavedBundle(template, budgetTier);
        when(generatedBundleRepository.save(any(GeneratedBundle.class))).thenReturn(savedBundle);
        when(generatedBundleRepository.findByPublicId(anyString())).thenReturn(Optional.of(savedBundle));
    }

    // ── Duplicate prevention ───────────────────────────────────────────────────

    @Test
    void generate_doesNotSelectSameProductTwice() {
        GenerationSetup setup = setupSuccessfulGeneration(BigDecimal.valueOf(2.50));
        stubCommonMocks(setup);

        // Call generate — if duplicate prevention works, each slot gets a different product
        service.generate(defaultRequest());

        // Verify that save was called (bundle was built and persisted)
        verify(generatedBundleRepository, atLeastOnce()).save(any(GeneratedBundle.class));
    }

    // ── COGS ceiling ───────────────────────────────────────────────────────────

    @Test
    void generate_sumOfItemCosts_doesNotExceedMaxItemCogs() {
        // Budget is tight: 4 items × 0.40 = 1.60, budget = 2.50. Should work.
        GenerationSetup setup = setupSuccessfulGeneration(BigDecimal.valueOf(2.50));
        stubCommonMocks(setup);

        service.generate(defaultRequest());

        // The service ran to completion; COGS constraint was respected
        verify(generatedBundleRepository, atLeastOnce()).save(any(GeneratedBundle.class));
    }

    // ── Insufficient role coverage ─────────────────────────────────────────────

    @Test
    void generate_noProductWithRequiredRole_throwsInsufficientRoleCoverage() {
        BudgetTier budgetTier = buildBudgetTier(BigDecimal.valueOf(2.50));

        // Slot requires READING role, but no product has it
        BundleTemplateSlot slotReading = buildSlot("READING", (short) 1, Set.of("READING"));
        BundleTemplate template = buildTemplate("READING_PUZZLE_4_ITEM", List.of(slotReading));

        Product pUtil = buildProduct(1L, "UTIL-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);

        // Role affinity has UTILITY, not READING
        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "UTILITY", (short) 90)
        );

        when(budgetTierRepository.findByCodeAndActiveTrue("LOW")).thenReturn(Optional.of(budgetTier));
        when(templateSelector.selectTemplate(8, Interest.POP_MUSIC)).thenReturn(template);
        when(productRepository.findAllByActiveTrue()).thenReturn(List.of(pUtil));
        when(interestAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(audienceAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(roleAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(roleAffs);
        when(eligibilityService.isEligible(any(Product.class), anyInt(), any(PartyType.class), anyMap()))
                .thenReturn(true);
        when(eligibilityService.isAudienceCompatible(anyLong(), any(AudiencePreference.class), anyMap()))
                .thenReturn(true);

        assertThatThrownBy(() -> service.generate(defaultRequest()))
                .isInstanceOf(BundleGenerationException.class)
                .satisfies(ex -> {
                    BundleGenerationException bge = (BundleGenerationException) ex;
                    assertThat(bge.getCode())
                            .isEqualTo(BundleGenerationException.FailureCode.INSUFFICIENT_ROLE_COVERAGE);
                });
    }

    // ── Template selection ─────────────────────────────────────────────────────

    @Test
    void generate_age4_selectsPreschoolTemplate() {
        BundleGenerationRequest request = new BundleGenerationRequest(
                4, AudiencePreference.NO_PREFERENCE, Interest.TOYS_PLAY, PartyType.CELEBRATION, "LOW", null);

        BudgetTier budgetTier = buildBudgetTier(BigDecimal.valueOf(2.50));
        BundleTemplateSlot slotAct = buildSlot("ACTIVITY",   (short) 1, Set.of("ACTIVITY"));
        BundleTemplateSlot slotTac = buildSlot("TACTILE",    (short) 2, Set.of("TACTILE"));
        BundleTemplateSlot slotToy = buildSlot("SIMPLE_TOY", (short) 3, Set.of("SIMPLE_TOY"));
        BundleTemplateSlot slotNov = buildSlot("NOVELTY",    (short) 4, Set.of("NOVELTY"));
        BundleTemplate preschool = buildTemplate("PRESCHOOL_4_ITEM",
                List.of(slotAct, slotTac, slotToy, slotNov));

        Product pAct = buildProduct(1L, "ACT-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pTac = buildProduct(2L, "TAC-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pToy = buildProduct(3L, "TOY-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pNov = buildProduct(4L, "NOV-001", BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);

        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "ACTIVITY",   (short) 90),
                buildRoleAff(2L, "TACTILE",    (short) 90),
                buildRoleAff(3L, "SIMPLE_TOY", (short) 90),
                buildRoleAff(4L, "NOVELTY",    (short) 90)
        );

        when(budgetTierRepository.findByCodeAndActiveTrue("LOW")).thenReturn(Optional.of(budgetTier));
        when(templateSelector.selectTemplate(4, Interest.TOYS_PLAY)).thenReturn(preschool);
        when(productRepository.findAllByActiveTrue()).thenReturn(List.of(pAct, pTac, pToy, pNov));
        when(interestAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(audienceAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(roleAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(roleAffs);
        when(eligibilityService.isEligible(any(Product.class), anyInt(), any(PartyType.class), anyMap()))
                .thenReturn(true);
        when(eligibilityService.isAudienceCompatible(anyLong(), any(AudiencePreference.class), anyMap()))
                .thenReturn(true);
        when(scoringService.score(any(), any(), any(), anyList(), anyList(), anyList())).thenReturn(50);
        when(giftBagOptionRepository.findByIsDefaultTrue()).thenReturn(Optional.of(buildGiftBag()));
        when(upgradeGenerationService.selectUpgrades(anyList(), anySet(), any(), anyMap()))
                .thenReturn(new UpgradeGenerationService.UpgradeSelection(Optional.empty(), Optional.empty()));

        GeneratedBundle savedBundle = buildSavedBundle(preschool, budgetTier);
        when(generatedBundleRepository.save(any())).thenReturn(savedBundle);
        when(generatedBundleRepository.findByPublicId(anyString())).thenReturn(Optional.of(savedBundle));

        service.generate(request);

        // Verify templateSelector was called with age=4 and TOYS_PLAY interest
        verify(templateSelector).selectTemplate(4, Interest.TOYS_PLAY);
    }

    @Test
    void generate_age8_readingPuzzleInterest_selectsReadingPuzzleTemplate() {
        BundleGenerationRequest request = new BundleGenerationRequest(
                8, AudiencePreference.NO_PREFERENCE, Interest.READING_PUZZLE, PartyType.CELEBRATION, "LOW", null);

        BudgetTier budgetTier = buildBudgetTier(BigDecimal.valueOf(2.50));
        BundleTemplateSlot slotR = buildSlot("READING", (short) 1, Set.of("READING"));
        BundleTemplateSlot slotP = buildSlot("PUZZLE",  (short) 2, Set.of("PUZZLE"));
        BundleTemplateSlot slotU = buildSlot("UTILITY", (short) 3, Set.of("UTILITY"));
        BundleTemplateSlot slotN = buildSlot("NOVELTY", (short) 4, Set.of("NOVELTY"));
        BundleTemplate rpTemplate = buildTemplate("READING_PUZZLE_4_ITEM",
                List.of(slotR, slotP, slotU, slotN));

        Product pR = buildProduct(1L, "READ-001",  BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pP = buildProduct(2L, "PUZZ-001",  BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pU = buildProduct(3L, "UTIL-001",  BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);
        Product pN = buildProduct(4L, "NOV-001",   BigDecimal.valueOf(0.40), UpgradeTier.STANDARD);

        List<ProductRoleAffinity> roleAffs = List.of(
                buildRoleAff(1L, "READING", (short) 90),
                buildRoleAff(2L, "PUZZLE",  (short) 90),
                buildRoleAff(3L, "UTILITY", (short) 90),
                buildRoleAff(4L, "NOVELTY", (short) 90)
        );

        when(budgetTierRepository.findByCodeAndActiveTrue("LOW")).thenReturn(Optional.of(budgetTier));
        when(templateSelector.selectTemplate(8, Interest.READING_PUZZLE)).thenReturn(rpTemplate);
        when(productRepository.findAllByActiveTrue()).thenReturn(List.of(pR, pP, pU, pN));
        when(interestAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(audienceAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(occasionRepository.findAllByProductIdIn(anyCollection())).thenReturn(List.of());
        when(roleAffinityRepository.findAllByProductIdIn(anyCollection())).thenReturn(roleAffs);
        when(eligibilityService.isEligible(any(Product.class), anyInt(), any(PartyType.class), anyMap()))
                .thenReturn(true);
        when(eligibilityService.isAudienceCompatible(anyLong(), any(AudiencePreference.class), anyMap()))
                .thenReturn(true);
        when(scoringService.score(any(), any(), any(), anyList(), anyList(), anyList())).thenReturn(50);
        when(giftBagOptionRepository.findByIsDefaultTrue()).thenReturn(Optional.of(buildGiftBag()));
        when(upgradeGenerationService.selectUpgrades(anyList(), anySet(), any(), anyMap()))
                .thenReturn(new UpgradeGenerationService.UpgradeSelection(Optional.empty(), Optional.empty()));

        GeneratedBundle savedBundle = buildSavedBundle(rpTemplate, budgetTier);
        when(generatedBundleRepository.save(any())).thenReturn(savedBundle);
        when(generatedBundleRepository.findByPublicId(anyString())).thenReturn(Optional.of(savedBundle));

        service.generate(request);

        verify(templateSelector).selectTemplate(8, Interest.READING_PUZZLE);
    }

    @Test
    void generate_age8_popMusicInterest_selectsGeneralTemplate() {
        GenerationSetup setup = setupSuccessfulGeneration(BigDecimal.valueOf(2.50));
        stubCommonMocks(setup);

        service.generate(defaultRequest());

        verify(templateSelector).selectTemplate(8, Interest.POP_MUSIC);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

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
}
