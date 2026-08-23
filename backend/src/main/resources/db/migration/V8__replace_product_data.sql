-- V8: Replace all test product data with real products.
-- Clears every product row (and its affinities) from V3 + V7 seed.
-- Bundle templates, budget tiers, and gift bag option are left unchanged.
--
-- TODO fields set to safe placeholder values — owner must update before production:
--   inventory_quantity = 100  (all rows — replace with real stock counts)
--   min_age = 3               (all rows — verify safety rating with supplier)

-- ── Clear existing product data (in FK dependency order) ────────────────────

DELETE FROM generated_bundle_item;
DELETE FROM generated_bundle_upgrade;
DELETE FROM generated_bundle_gift_bag;
DELETE FROM generated_bundle;

DELETE FROM product_role_affinity;
DELETE FROM product_occasion;
DELETE FROM product_audience_affinity;
DELETE FROM product_interest_affinity;
DELETE FROM product;

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. Capybara Bubble Squeeze Toy
    --    ¥46.85 / 48 = ¥0.976 → ¥1.00
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('TOY-CAPYBARA-001',
     'Capybara Bubble Squeeze Toy',
     'A cute capybara squeeze toy that blows a bubble when squeezed.',
     1.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 2. Squeeze Duck Toy
    --    ¥7.82 / 2 = ¥3.91 → ¥4.00
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('TOY-DUCK-001',
     'Squeeze Duck Toy',
     'A soft squeeze duck toy designed for tactile and silly sensory play.',
     4.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'FUNNY_ANIMAL', true),

    -- 3. Auto-Follow Page Bookmark
    --    ¥28.80 / 6 = ¥4.80 → ¥5.00
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('BOOKMARK-FOLLOW-001',
     'Auto-Follow Page Bookmark',
     'A flexible page-following bookmark that clips onto a book and helps keep track of reading progress.',
     5.00, 100, 3, 12, 'BOOK', 'FLAT_RECT', 'STANDARD', NULL, true),

    -- 4. Van Gogh Magnetic Bookmark
    --    ¥8.61 / 4 = ¥2.1525 → ¥2.50
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('BOOKMARK-ART-001',
     'Van Gogh Magnetic Bookmark',
     'A magnetic bookmark featuring colorful classic-art-inspired designs.',
     2.50, 100, 3, 12, 'BOOK', 'FLAT_RECT', 'STANDARD', 'ART', true),

    -- 5. Crystal Diamond Pencil Cap
    --    ¥17.80 / 20 = ¥0.89 → ¥1.00
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('STATIONERY-PENCILCAP-001',
     'Crystal Diamond Pencil Cap',
     'A colorful crystal-style pencil topper and protective pencil cap.',
     1.00, 100, 3, 12, 'STATIONERY', 'SMALL_VOLUME', 'STANDARD', 'GEM', true),

    -- 6. Diamond Crystal Pen
    --    ¥1.05 / 1 = ¥1.05 → ¥1.50
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('PEN-DIAMOND-001',
     'Diamond Crystal Pen',
     'A colorful pen topped with a large faceted crystal-style gem.',
     1.50, 100, 3, 12, 'STATIONERY', 'BAR', 'STANDARD', 'GEM', true),

    -- 7. Rainbow Scratch Art Notebook
    --    ¥56 / 50 = ¥1.12 → ¥1.50
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('ACTIVITY-SCRATCH-001',
     'Rainbow Scratch Art Notebook',
     'A mini scratch-art notebook for drawing colorful pictures and patterns on rainbow scratch paper.',
     1.50, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', 'RAINBOW', true),

    -- 8. Colorful Gem Ring
    --    ¥10.95 / 30 = ¥0.365 → ¥0.50
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('ACCESSORY-RING-001',
     'Colorful Gem Ring',
     'A colorful costume ring with a translucent gem-style design.',
     0.50, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'STANDARD', 'GEM', true),

    -- 9. Mermaid Mini Figure
    --    ¥12.81 / 4 = ¥3.2025 → ¥3.50
    --    TODO: verify min_age safety rating; update inventory_quantity
    ('TOY-MERMAID-001',
     'Mermaid Mini Figure',
     'A small colorful mermaid figure supplied as a surprise-style mini toy.',
     3.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'MERMAID', true),

    -- 10. Flocked Bunny Mini Figure
    --     ¥11.40 / 9 = ¥1.267 → ¥1.50
    --     TODO: verify min_age safety rating; update inventory_quantity
    ('TOY-BUNNY-001',
     'Flocked Bunny Mini Figure',
     'A soft flocked mini bunny character figure in assorted pastel colors.',
     1.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 55)) AS v(i, w)
WHERE sku = 'TOY-CAPYBARA-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 30)) AS v(i, w)
WHERE sku = 'TOY-DUCK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 100)) AS v(i, w)
WHERE sku = 'BOOKMARK-FOLLOW-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 95), ('CUTE_MAGICAL', 20)) AS v(i, w)
WHERE sku = 'BOOKMARK-ART-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 85), ('READING_PUZZLE', 45)) AS v(i, w)
WHERE sku = 'STATIONERY-PENCILCAP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 90), ('READING_PUZZLE', 35)) AS v(i, w)
WHERE sku = 'PEN-DIAMOND-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 65), ('TOYS_PLAY', 55), ('READING_PUZZLE', 45)) AS v(i, w)
WHERE sku = 'ACTIVITY-SCRATCH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 100)) AS v(i, w)
WHERE sku = 'ACCESSORY-RING-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 100), ('TOYS_PLAY', 80)) AS v(i, w)
WHERE sku = 'TOY-MERMAID-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 95), ('TOYS_PLAY', 80)) AS v(i, w)
WHERE sku = 'TOY-BUNNY-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-CAPYBARA-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-DUCK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'BOOKMARK-FOLLOW-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'BOOKMARK-ART-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 70), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'STATIONERY-PENCILCAP-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'PEN-DIAMOND-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACTIVITY-SCRATCH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 85), ('UNIVERSAL', 40)) AS v(a, w)
WHERE sku = 'ACCESSORY-RING-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 85), ('UNIVERSAL', 40)) AS v(a, w)
WHERE sku = 'TOY-MERMAID-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 70), ('UNIVERSAL', 60)) AS v(a, w)
WHERE sku = 'TOY-BUNNY-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────
-- All 10 products are appropriate for both CELEBRATION and HALLOWEEN.

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-CAPYBARA-001', 'TOY-DUCK-001',
    'BOOKMARK-FOLLOW-001', 'BOOKMARK-ART-001',
    'STATIONERY-PENCILCAP-001', 'PEN-DIAMOND-001',
    'ACTIVITY-SCRATCH-001', 'ACCESSORY-RING-001',
    'TOY-MERMAID-001', 'TOY-BUNNY-001'
);

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 100), ('SIMPLE_TOY', 90), ('NOVELTY', 85)) AS v(r, w)
WHERE sku = 'TOY-CAPYBARA-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 100), ('SIMPLE_TOY', 90), ('NOVELTY', 75)) AS v(r, w)
WHERE sku = 'TOY-DUCK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('READING', 100), ('UTILITY', 95), ('ACTIVITY', 30)) AS v(r, w)
WHERE sku = 'BOOKMARK-FOLLOW-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('READING', 100), ('UTILITY', 90), ('COLLECTIBLE', 40)) AS v(r, w)
WHERE sku = 'BOOKMARK-ART-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 95), ('NOVELTY', 70), ('COLLECTIBLE', 45)) AS v(r, w)
WHERE sku = 'STATIONERY-PENCILCAP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('NOVELTY', 60), ('ACTIVITY', 35)) AS v(r, w)
WHERE sku = 'PEN-DIAMOND-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PLAY', 55), ('NOVELTY', 45)) AS v(r, w)
WHERE sku = 'ACTIVITY-SCRATCH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 75), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'ACCESSORY-RING-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 95), ('COLLECTIBLE', 100), ('SIMPLE_TOY', 75), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'TOY-MERMAID-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 100), ('PLAY', 85), ('SIMPLE_TOY', 75), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'TOY-BUNNY-001';
