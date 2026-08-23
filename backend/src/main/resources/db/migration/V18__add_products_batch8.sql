-- V18: Add 2 new products (batch 8 — wind-up duck, pocket gomoku).
--
-- Category remapping (invalid enum values remapped to nearest valid ProductCategory):
--   GAME → ACTIVITY  (no GAME category in enum)
--
-- Role remapping notes (invalid enum values remapped to nearest valid BundleRole):
--   SKILL → dropped  (ACTIVITY already present on GAME-GOMOKU-001 at weight 90)
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--
-- Budget tier fit (max_item_cogs: LOW=¥5.50 / MID=¥9.00 / HIGH=¥15.00):
--   ¥3.50  TOY-WINDUP-DUCK-001  — LOW, MID, HIGH
--   ¥7.00  GAME-GOMOKU-001      — MID, HIGH

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 27. Wind-Up Walking Duck  ¥63/20 → ¥3.50
    ('TOY-WINDUP-DUCK-001',
     'Wind-Up Walking Duck',
     'A colorful wind-up duck toy that walks forward after its side mechanism is wound up.',
     3.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 28. Magnetic Pocket Gomoku  ¥6.82/1 → ¥7.00
    --     Category GAME remapped to ACTIVITY (nearest valid enum value).
    ('GAME-GOMOKU-001',
     'Magnetic Pocket Gomoku',
     'A compact magnetic five-in-a-row board game with black and white pieces for portable strategy play.',
     7.00, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', null, true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 70)) AS v(i, w)
WHERE sku = 'TOY-WINDUP-DUCK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 100), ('TOYS_PLAY', 55)) AS v(i, w)
WHERE sku = 'GAME-GOMOKU-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-WINDUP-DUCK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'GAME-GOMOKU-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN ('TOY-WINDUP-DUCK-001', 'GAME-GOMOKU-001');

-- ── Role Affinities ───────────────────────────────────────────────────────────
-- Note: SKILL is not a valid BundleRole enum value.
--   SKILL → dropped (ACTIVITY already present at weight 90 on GAME-GOMOKU-001)

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('SIMPLE_TOY', 95), ('NOVELTY', 85), ('TACTILE', 60)) AS v(r, w)
WHERE sku = 'TOY-WINDUP-DUCK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PUZZLE', 100), ('ACTIVITY', 90), ('PLAY', 85)) AS v(r, w)
WHERE sku = 'GAME-GOMOKU-001';
