-- TEST DATA — seed for bundle generation integration tests.
-- All values are test data; owner must validate before use in production.

-- ── Budget Tiers ──────────────────────────────────────────────────────────────
INSERT INTO budget_tier (code, retail_min, retail_max, max_item_cogs, target_retail_price, active)
VALUES
    ('LOW',  5.00,  9.99,  2.50,  7.99, true),
    ('MID',  10.00, 14.99, 4.00, 12.99, true),
    ('HIGH', 15.00, 19.99, 5.50, 17.99, true);

-- ── Bundle Templates ──────────────────────────────────────────────────────────
INSERT INTO bundle_template (code, name, min_age, max_age, active)
VALUES
    ('GENERAL_4_ITEM',        'General 4-Item Bundle',          6, 12, true),
    ('PRESCHOOL_4_ITEM',      'Preschool 4-Item Bundle',        3,  5, true),
    ('READING_PUZZLE_4_ITEM', 'Reading & Puzzle 4-Item Bundle', 6, 12, true);

-- GENERAL_4_ITEM slots: UTILITY, ACTIVITY, PLAY+WEARABLE+TACTILE, NOVELTY+COLLECTIBLE
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'UTILITY',             1, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'ACTIVITY',            2, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'PLAY_WEARABLE_TACTILE', 3, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY_COLLECTIBLE', 4, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'UTILITY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'UTILITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'ACTIVITY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'ACTIVITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, r
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
CROSS JOIN (VALUES ('PLAY'), ('WEARABLE'), ('TACTILE')) AS roles(r)
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'PLAY_WEARABLE_TACTILE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, r
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
CROSS JOIN (VALUES ('NOVELTY'), ('COLLECTIBLE')) AS roles(r)
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'NOVELTY_COLLECTIBLE';

-- PRESCHOOL_4_ITEM slots: ACTIVITY, TACTILE, SIMPLE_TOY, NOVELTY
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'ACTIVITY',   1, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'TACTILE',    2, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'SIMPLE_TOY', 3, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY',    4, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'ACTIVITY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'ACTIVITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'TACTILE'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'TACTILE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'SIMPLE_TOY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'SIMPLE_TOY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'NOVELTY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'NOVELTY';

-- READING_PUZZLE_4_ITEM slots: READING, PUZZLE, UTILITY, NOVELTY
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'READING', 1, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'PUZZLE',  2, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'UTILITY', 3, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY', 4, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'READING'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'READING';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'PUZZLE'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'PUZZLE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'UTILITY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'UTILITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'NOVELTY'
FROM bundle_template_slot s JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'NOVELTY';

-- ── Gift Bag ──────────────────────────────────────────────────────────────────
INSERT INTO gift_bag_option (code, name, description, cost, retail_price_adjustment, active, is_default)
VALUES ('CLASSIC_BAG', 'Classic Gift Bag', 'Standard bag with tissue paper', 0.50, 0.00, true, true);

-- ── Products ──────────────────────────────────────────────────────────────────
-- TEST DATA — fits LOW budget (max_item_cogs=2.50) across 4 slots.
-- Individual costs chosen so 4 items sum to <= 2.50: e.g. 0.40+0.45+0.50+0.55 = 1.90

-- UTILITY products (both occasions, age 6-12)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-UTIL-001', 'Test Pen A',        'Basic pen for testing',       0.40, 0, 0.40, 0.40, 100, 6, 12, 'STATIONERY',    'BAR',        'STANDARD', true),
    ('T-UTIL-002', 'Test Pen B',        'Secondary pen for testing',   0.45, 0, 0.45, 0.45, 100, 6, 12, 'STATIONERY',    'BAR',        'STANDARD', true),
    ('T-UTIL-003', 'Test Bookmark',     'Bookmark for testing',        0.35, 0, 0.35, 0.35, 100, 6, 12, 'BOOK',          'FLAT_RECT',  'STANDARD', true);

-- ACTIVITY products (both occasions, age 6-12)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-ACT-001',  'Test Notepad A',    'Notepad for testing',         0.45, 0, 0.45, 0.45, 100, 6, 12, 'STATIONERY',    'FLAT_RECT',  'STANDARD', true),
    ('T-ACT-002',  'Test Notepad B',    'Secondary notepad',           0.50, 0, 0.50, 0.50, 100, 6, 12, 'STATIONERY',    'FLAT_RECT',  'STANDARD', true);

-- PLAY/WEARABLE/TACTILE products (both occasions, age 6-12)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-PLAY-001', 'Test Stretchy Toy', 'Stretchy toy for testing',    0.50, 0, 0.50, 0.50, 100, 6, 12, 'TOY',           'ROUND',      'STANDARD', true),
    ('T-PLAY-002', 'Test Bracelet',     'Bracelet for testing',        0.55, 0, 0.55, 0.50, 100, 6, 12, 'ACCESSORY',     'ROUND',      'STANDARD', true),
    ('T-PLAY-003', 'Test Mini Ball',    'Mini ball for testing',       0.45, 0, 0.45, 0.45, 100, 3, 12, 'SPORT',         'ROUND',      'STANDARD', true);

-- NOVELTY/COLLECTIBLE products (both occasions, age 6-12)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-NOV-001',  'Test Sticker Pack', 'Sticker pack for testing',   0.55, 0, 0.55, 0.50, 100, 6, 12, 'STICKER_TATTOO','FLAT_RECT',  'STANDARD', true),
    ('T-NOV-002',  'Test Mini Figure',  'Mini figure for testing',     0.60, 0, 0.60, 0.50, 100, 6, 12, 'COLLECTIBLE',   'SMALL_VOLUME','STANDARD', true);

-- PREMIUM upgrade product (both occasions, age 6-12)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-PREM-001', 'Test Premium Figure','Premium collectible for testing', 1.60, 0, 1.60, 0.80, 100, 6, 12, 'COLLECTIBLE','SMALL_VOLUME','PREMIUM', true);

-- MID budget products (cost 0.75-1.00)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-MID-UTIL-001', 'Test Mid Pen',   'Mid-range pen',              0.75, 0, 0.75, 0.50, 100, 6, 12, 'STATIONERY',   'BAR',        'STANDARD', true),
    ('T-MID-ACT-001',  'Test Mid Pad',   'Mid-range notepad',          0.80, 0, 0.80, 0.50, 100, 6, 12, 'STATIONERY',   'FLAT_RECT',  'STANDARD', true),
    ('T-MID-PLAY-001', 'Test Mid Toy',   'Mid-range toy',              0.85, 0, 0.85, 0.50, 100, 6, 12, 'TOY',          'ROUND',      'STANDARD', true),
    ('T-MID-NOV-001',  'Test Mid Cards', 'Mid-range cards',            0.90, 0, 0.90, 0.45, 100, 6, 12, 'COLLECTIBLE',  'FLAT_RECT',  'STANDARD', true);

-- PRESCHOOL products (age 3-5)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-PRE-ACT-001',  'Pre Activity',    'Preschool activity item',   0.40, 0, 0.40, 0.40, 100, 3,  5, 'ACTIVITY',     'FLAT_RECT',  'STANDARD', true),
    ('T-PRE-TAC-001',  'Pre Tactile',     'Preschool tactile item',    0.45, 0, 0.45, 0.45, 100, 3,  5, 'TOY',          'ROUND',      'STANDARD', true),
    ('T-PRE-TOY-001',  'Pre Simple Toy',  'Preschool simple toy',      0.50, 0, 0.50, 0.50, 100, 3,  5, 'TOY',          'SMALL_VOLUME','STANDARD', true),
    ('T-PRE-NOV-001',  'Pre Novelty',     'Preschool novelty item',    0.35, 0, 0.35, 0.35, 100, 3,  5, 'NOVELTY',      'SMALL_VOLUME','STANDARD', true);

-- INACTIVE product (should be filtered out)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-INACT-001', 'Inactive Test Product', 'Inactive for testing',   0.40, 0, 0.40, 0.40, 100, 6, 12, 'OTHER',        'OTHER',      'STANDARD', false);

-- HALLOWEEN-only product (for testing occasion filtering)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-HALL-001', 'Halloween Only',  'Halloween-only test product',   0.40, 0, 0.40, 0.40, 100, 6, 12, 'NOVELTY',      'SMALL_VOLUME','STANDARD', true);

-- CELEBRATION-only product
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-CELE-001', 'Celebration Only','Celebration-only test product', 0.40, 0, 0.40, 0.40, 100, 6, 12, 'NOVELTY',      'SMALL_VOLUME','STANDARD', true);

-- Product outside age range (min_age=10 for testing age exclusion when requesting age 6)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-OLD-001', 'Older Kids Only', 'Age 10+ only test product',      0.40, 0, 0.40, 0.40, 100, 10, 12, 'OTHER',       'OTHER',      'STANDARD', true);

-- CUTE_MAGICAL themed products (for interest dominance test — both occasions)
INSERT INTO product (sku, name, description, cost, cog_overhead, cog_adjusted, retail_price, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('T-MAGIC-UTIL-001', 'Magic Pencil',   'Unicorn pencil for testing', 0.40, 0, 0.40, 0.40, 100, 6, 12, 'STATIONERY', 'BAR',        'STANDARD', true),
    ('T-MAGIC-ACT-001',  'Magic Notepad',  'Glitter notepad for testing',0.45, 0, 0.45, 0.45, 100, 6, 12, 'STATIONERY', 'FLAT_RECT',  'STANDARD', true),
    ('T-MAGIC-PLAY-001', 'Magic Putty',    'Rainbow putty for testing',  0.50, 0, 0.50, 0.50, 100, 6, 12, 'TOY',        'ROUND',      'STANDARD', true),
    ('T-MAGIC-NOV-001',  'Magic Stickers', 'Fairy stickers for testing', 0.55, 0, 0.55, 0.50, 100, 6, 12, 'STICKER_TATTOO','FLAT_RECT','STANDARD', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────
-- Standard test products: POP_MUSIC primary affinity, cross-appeal secondary

-- UTILITY products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 90), ('CUTE_MAGICAL', 50), ('TOYS_PLAY', 40), ('SPORTS', 30), ('READING_PUZZLE', 30)
) AS v(i, w) WHERE sku = 'T-UTIL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 80), ('CUTE_MAGICAL', 45), ('TOYS_PLAY', 35), ('SPORTS', 25), ('READING_PUZZLE', 25)
) AS v(i, w) WHERE sku = 'T-UTIL-002';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('READING_PUZZLE', 90), ('CUTE_MAGICAL', 40), ('POP_MUSIC', 30), ('TOYS_PLAY', 25), ('SPORTS', 20)
) AS v(i, w) WHERE sku = 'T-UTIL-003';

-- ACTIVITY products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 88), ('CUTE_MAGICAL', 55), ('TOYS_PLAY', 45), ('SPORTS', 30), ('READING_PUZZLE', 35)
) AS v(i, w) WHERE sku = 'T-ACT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 75), ('CUTE_MAGICAL', 50), ('TOYS_PLAY', 40), ('SPORTS', 25), ('READING_PUZZLE', 30)
) AS v(i, w) WHERE sku = 'T-ACT-002';

-- PLAY products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 90), ('POP_MUSIC', 40), ('CUTE_MAGICAL', 55), ('SPORTS', 50), ('READING_PUZZLE', 20)
) AS v(i, w) WHERE sku = 'T-PLAY-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 85), ('CUTE_MAGICAL', 60), ('TOYS_PLAY', 45), ('SPORTS', 30), ('READING_PUZZLE', 20)
) AS v(i, w) WHERE sku = 'T-PLAY-002';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('SPORTS', 90), ('TOYS_PLAY', 70), ('POP_MUSIC', 30), ('CUTE_MAGICAL', 25), ('READING_PUZZLE', 15)
) AS v(i, w) WHERE sku = 'T-PLAY-003';

-- NOVELTY products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 85), ('POP_MUSIC', 50), ('TOYS_PLAY', 60), ('SPORTS', 30), ('READING_PUZZLE', 25)
) AS v(i, w) WHERE sku = 'T-NOV-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 85), ('POP_MUSIC', 55), ('CUTE_MAGICAL', 60), ('SPORTS', 35), ('READING_PUZZLE', 25)
) AS v(i, w) WHERE sku = 'T-NOV-002';

-- PREMIUM product
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 95), ('CUTE_MAGICAL', 70), ('TOYS_PLAY', 60)
) AS v(i, w) WHERE sku = 'T-PREM-001';

-- MID products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 85), ('CUTE_MAGICAL', 40), ('TOYS_PLAY', 35)
) AS v(i, w) WHERE sku = 'T-MID-UTIL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 80), ('CUTE_MAGICAL', 45), ('TOYS_PLAY', 40)
) AS v(i, w) WHERE sku = 'T-MID-ACT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 85), ('POP_MUSIC', 45), ('CUTE_MAGICAL', 50)
) AS v(i, w) WHERE sku = 'T-MID-PLAY-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 80), ('POP_MUSIC', 50), ('CUTE_MAGICAL', 55)
) AS v(i, w) WHERE sku = 'T-MID-NOV-001';

-- PRESCHOOL products (cross-interest for CUTE_MAGICAL and TOYS_PLAY)
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 80), ('TOYS_PLAY', 75), ('POP_MUSIC', 30)
) AS v(i, w) WHERE sku = 'T-PRE-ACT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 85), ('CUTE_MAGICAL', 70), ('POP_MUSIC', 25)
) AS v(i, w) WHERE sku = 'T-PRE-TAC-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 90), ('CUTE_MAGICAL', 65), ('POP_MUSIC', 20)
) AS v(i, w) WHERE sku = 'T-PRE-TOY-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 75), ('TOYS_PLAY', 70), ('POP_MUSIC', 35)
) AS v(i, w) WHERE sku = 'T-PRE-NOV-001';

-- INACTIVE (interest affinities exist but product is inactive)
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 70), ('TOYS_PLAY', 60)
) AS v(i, w) WHERE sku = 'T-INACT-001';

-- HALLOWEEN-only
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('TOYS_PLAY', 70), ('CUTE_MAGICAL', 60), ('POP_MUSIC', 40)
) AS v(i, w) WHERE sku = 'T-HALL-001';

-- CELEBRATION-only
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 65), ('TOYS_PLAY', 55), ('CUTE_MAGICAL', 50)
) AS v(i, w) WHERE sku = 'T-CELE-001';

-- AGE-restricted
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('POP_MUSIC', 60), ('TOYS_PLAY', 50)
) AS v(i, w) WHERE sku = 'T-OLD-001';

-- CUTE_MAGICAL high-affinity products (for interest dominance test)
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 95), ('POP_MUSIC', 20), ('TOYS_PLAY', 30)
) AS v(i, w) WHERE sku = 'T-MAGIC-UTIL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 95), ('POP_MUSIC', 20), ('TOYS_PLAY', 30)
) AS v(i, w) WHERE sku = 'T-MAGIC-ACT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 95), ('POP_MUSIC', 20), ('TOYS_PLAY', 30)
) AS v(i, w) WHERE sku = 'T-MAGIC-PLAY-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 95), ('POP_MUSIC', 20), ('TOYS_PLAY', 30)
) AS v(i, w) WHERE sku = 'T-MAGIC-NOV-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 80 FROM product WHERE sku IN (
    'T-UTIL-001', 'T-UTIL-002', 'T-UTIL-003',
    'T-ACT-001', 'T-ACT-002',
    'T-PLAY-001', 'T-PLAY-003',
    'T-NOV-001', 'T-NOV-002',
    'T-PREM-001',
    'T-MID-UTIL-001', 'T-MID-ACT-001', 'T-MID-PLAY-001', 'T-MID-NOV-001',
    'T-PRE-ACT-001', 'T-PRE-TAC-001', 'T-PRE-TOY-001', 'T-PRE-NOV-001',
    'T-INACT-001', 'T-HALL-001', 'T-CELE-001', 'T-OLD-001'
);

-- T-PLAY-002 (bracelet): FEMININE affinity
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 30)) AS v(a, w)
WHERE sku = 'T-PLAY-002';

-- CUTE_MAGICAL products: FEMININE affinity (for interest dominance test)
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 25)) AS v(a, w)
WHERE sku IN ('T-MAGIC-UTIL-001', 'T-MAGIC-ACT-001', 'T-MAGIC-PLAY-001', 'T-MAGIC-NOV-001');

-- ── Occasions ─────────────────────────────────────────────────────────────────
-- Both occasions for general test products
INSERT INTO product_occasion (product_id, occasion)
SELECT id, o FROM product
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS v(o)
WHERE sku IN (
    'T-UTIL-001', 'T-UTIL-002', 'T-UTIL-003',
    'T-ACT-001', 'T-ACT-002',
    'T-PLAY-001', 'T-PLAY-002', 'T-PLAY-003',
    'T-NOV-001', 'T-NOV-002',
    'T-PREM-001',
    'T-MID-UTIL-001', 'T-MID-ACT-001', 'T-MID-PLAY-001', 'T-MID-NOV-001',
    'T-INACT-001', 'T-OLD-001',
    'T-MAGIC-UTIL-001', 'T-MAGIC-ACT-001', 'T-MAGIC-PLAY-001', 'T-MAGIC-NOV-001'
);

-- Preschool products: both occasions
INSERT INTO product_occasion (product_id, occasion)
SELECT id, o FROM product
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS v(o)
WHERE sku IN ('T-PRE-ACT-001', 'T-PRE-TAC-001', 'T-PRE-TOY-001', 'T-PRE-NOV-001');

-- HALLOWEEN-only
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'HALLOWEEN' FROM product WHERE sku = 'T-HALL-001';

-- CELEBRATION-only
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'CELEBRATION' FROM product WHERE sku = 'T-CELE-001';

-- ── Role Affinities ───────────────────────────────────────────────────────────
-- UTILITY products
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 95 FROM product WHERE sku = 'T-UTIL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 90 FROM product WHERE sku = 'T-UTIL-002';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('UTILITY', 90), ('NOVELTY', 30)) AS v(r, w)
WHERE sku = 'T-UTIL-003';

-- ACTIVITY products
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('ACTIVITY', 95), ('UTILITY', 40)) AS v(r, w)
WHERE sku = 'T-ACT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 35)) AS v(r, w)
WHERE sku = 'T-ACT-002';

-- PLAY products
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('TACTILE', 95), ('PLAY', 55)) AS v(r, w)
WHERE sku = 'T-PLAY-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('WEARABLE', 95), ('NOVELTY', 40)) AS v(r, w)
WHERE sku = 'T-PLAY-002';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('PLAY', 90), ('TACTILE', 50)) AS v(r, w)
WHERE sku = 'T-PLAY-003';

-- NOVELTY products
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('COLLECTIBLE', 85), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'T-NOV-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'T-NOV-002';

-- PREMIUM
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('PREMIUM', 100), ('COLLECTIBLE', 65)) AS v(r, w)
WHERE sku = 'T-PREM-001';

-- MID products
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 90 FROM product WHERE sku = 'T-MID-UTIL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 40)) AS v(r, w)
WHERE sku = 'T-MID-ACT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('PLAY', 90), ('TACTILE', 55)) AS v(r, w)
WHERE sku = 'T-MID-PLAY-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'T-MID-NOV-001';

-- PRESCHOOL
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('ACTIVITY', 90), ('TACTILE', 60)) AS v(r, w)
WHERE sku = 'T-PRE-ACT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('TACTILE', 95), ('PLAY', 50)) AS v(r, w)
WHERE sku = 'T-PRE-TAC-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('SIMPLE_TOY', 95), ('PLAY', 45)) AS v(r, w)
WHERE sku = 'T-PRE-TOY-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'NOVELTY', 90 FROM product WHERE sku = 'T-PRE-NOV-001';

-- INACTIVE
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 80 FROM product WHERE sku = 'T-INACT-001';

-- HALLOWEEN
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('NOVELTY', 90), ('COLLECTIBLE', 50)) AS v(r, w)
WHERE sku = 'T-HALL-001';

-- CELEBRATION
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('NOVELTY', 90), ('COLLECTIBLE', 50)) AS v(r, w)
WHERE sku = 'T-CELE-001';

-- AGE-restricted
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 80 FROM product WHERE sku = 'T-OLD-001';

-- CUTE_MAGICAL products (for interest dominance test)
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, 'UTILITY', 90 FROM product WHERE sku = 'T-MAGIC-UTIL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 40)) AS v(r, w)
WHERE sku = 'T-MAGIC-ACT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('TACTILE', 90), ('PLAY', 55)) AS v(r, w)
WHERE sku = 'T-MAGIC-PLAY-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 65)) AS v(r, w)
WHERE sku = 'T-MAGIC-NOV-001';
