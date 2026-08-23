-- V16: Add 4 new products (batch 6 — spinner, stamps, fidget ring).
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--
-- Budget tier fit for standard slots (max_item_cogs: LOW=¥5.50 / MID=¥9.00 / HIGH=¥15.00):
--   ¥1.00  TOY-SPINNER-001           — LOW, MID, HIGH
--   ¥4.00  STATIONERY-STAMP-001      — LOW, MID, HIGH
--   ¥4.00  TOY-FIDGET-RING-001       — LOW, MID, HIGH
--   ¥15.00 ACTIVITY-MAGIC-STAMP-001  — HIGH only (fits exactly at HIGH max)

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. Dinosaur Spinning Wand  ¥34/50 → ¥1.00
    ('TOY-SPINNER-001',
     'Dinosaur Spinning Wand',
     'A handheld spinning wand toy with a colorful dinosaur-themed rotating disc for simple sensory play.',
     1.00, 100, 3, 12, 'TOY', 'BAR', 'STANDARD', 'DINOSAUR', true),

    -- 2. Character Mini Stamp  ¥3.96/1 → ¥4.00
    ('STATIONERY-STAMP-001',
     'Character Mini Stamp',
     'A small self-contained character stamp for decorating paper, cards, notebooks, and other craft projects.',
     4.00, 100, 3, 12, 'STATIONERY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_CHARACTER', true),

    -- 3. Magic Sticker Stamp Set  ¥14.90/1 → ¥15.00
    --    Includes stamp + mini activity book + 100 stickers as one complete set.
    --    Fits HIGH tier exactly (max_item_cogs=¥15.00).
    ('ACTIVITY-MAGIC-STAMP-001',
     'Magic Sticker Stamp Set',
     'A creative stamp activity set with a handheld stamp, mini activity book, and colorful stickers for decorating and imaginative craft play.',
     15.00, 100, 3, 12, 'ACTIVITY', 'IRREGULAR_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 4. Color-Changing Fidget Ring  ¥14.76/4 → ¥4.00
    --    4-pack split into 4 individual inventory units.
    ('TOY-FIDGET-RING-001',
     'Color-Changing Fidget Ring',
     'A flexible twistable finger fidget toy that changes color with temperature for tactile and sensory play.',
     4.00, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'COLOR_CHANGE', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'TOY-SPINNER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 80), ('READING_PUZZLE', 40), ('TOYS_PLAY', 35)) AS v(i, w)
WHERE sku = 'STATIONERY-STAMP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 90), ('TOYS_PLAY', 80), ('READING_PUZZLE', 45)) AS v(i, w)
WHERE sku = 'ACTIVITY-MAGIC-STAMP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 50)) AS v(i, w)
WHERE sku = 'TOY-FIDGET-RING-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-SPINNER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'STATIONERY-STAMP-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 70), ('UNIVERSAL', 65)) AS v(a, w)
WHERE sku = 'ACTIVITY-MAGIC-STAMP-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-FIDGET-RING-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-SPINNER-001', 'STATIONERY-STAMP-001',
    'ACTIVITY-MAGIC-STAMP-001', 'TOY-FIDGET-RING-001'
);

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('SIMPLE_TOY', 95), ('TACTILE', 75), ('NOVELTY', 80)) AS v(r, w)
WHERE sku = 'TOY-SPINNER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('ACTIVITY', 85), ('NOVELTY', 65), ('COLLECTIBLE', 55)) AS v(r, w)
WHERE sku = 'STATIONERY-STAMP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PLAY', 90), ('NOVELTY', 75), ('SIMPLE_TOY', 60)) AS v(r, w)
WHERE sku = 'ACTIVITY-MAGIC-STAMP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('PLAY', 95), ('NOVELTY', 90), ('SIMPLE_TOY', 85)) AS v(r, w)
WHERE sku = 'TOY-FIDGET-RING-001';
