-- V10: Add 12 new products (batch 2).
-- Also reactivates READING_PUZZLE_4_ITEM — now has PUZZLE-role products to fill that slot.
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--                               (exceptions: ACTIVITY-ANIMAL-PAPER-001=4, TOY-DINO-SKELETON-001=6)
--   TOY-WALL-CRAWLER-001 cost = 1.00 — assumed package qty 50 (¥40.36/50=¥0.81→¥1.00);
--                               VERIFY package quantity before production.

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. Color-Changing Face Keychain Toy  ¥21.60/30 → ¥1.00
    ('TOY-FACE-KEYCHAIN-001',
     'Color-Changing Face Keychain Toy',
     'A mini character keychain toy with a playful changing-face mechanism.',
     1.00, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'CHARACTER', true),

    -- 2. Rainbow Shape Spring Toy  ¥32.30/48 → ¥1.00
    ('TOY-RAINBOW-SPRING-001',
     'Rainbow Shape Spring Toy',
     'A colorful mini spring toy in assorted geometric shapes for tactile play.',
     1.00, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'RAINBOW', true),

    -- 3. 24-Segment Magic Ruler Puzzle  ¥53.60/50 → ¥1.50
    ('PUZZLE-MAGIC-RULER-001',
     '24-Segment Magic Ruler Puzzle',
     'A bendable geometric puzzle toy that can be transformed into many different shapes.',
     1.50, 100, 3, 12, 'PUZZLE', 'BAR', 'STANDARD', 'GEOMETRIC', true),

    -- 4. Extendable Robot Toy  ¥42.60/30 → ¥1.50
    ('TOY-ROBOT-EXTEND-001',
     'Extendable Robot Toy',
     'A colorful robot figure with flexible extendable arms and legs for hands-on play.',
     1.50, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'ROBOT', true),

    -- 5. Animal Party Blowout  ¥36.75/100 → ¥0.50  (CELEBRATION only)
    ('NOVELTY-ANIMAL-BLOWOUT-001',
     'Animal Party Blowout',
     'A colorful party blowout featuring assorted playful animal faces.',
     0.50, 100, 3, 12, 'NOVELTY', 'BAR', 'STANDARD', 'PARTY_ANIMAL', true),

    -- 6. Colorful Party Blowout  ¥11.30/8 → ¥1.50  (CELEBRATION only)
    ('NOVELTY-PARTY-BLOWOUT-001',
     'Colorful Party Blowout',
     'A classic retractable party blowout with a cheerful colorful pattern.',
     1.50, 100, 3, 12, 'NOVELTY', 'BAR', 'STANDARD', 'PARTY', true),

    -- 7. Moving Animal Paper Model Kit  ¥74.20/12 → ¥6.50  PREMIUM  minAge=4 (specified)
    ('ACTIVITY-ANIMAL-PAPER-001',
     'Moving Animal Paper Model Kit',
     'A creative paper craft kit for assembling an articulated animal model.',
     6.50, 100, 4, 12, 'ACTIVITY', 'FLAT_RECT', 'PREMIUM', 'ANIMAL_CRAFT', true),

    -- 8. Character Paper Model Kit  ¥22.35/26 → ¥1.00
    --    Generic name used — verify IP clearance before using specific character branding.
    ('ACTIVITY-MONSTER-PAPER-001',
     'Character Paper Model Kit',
     'A small DIY paper model craft kit for assembling a colorful character figure.',
     1.00, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', 'CHARACTER_CRAFT', true),

    -- 9. Fox-Style Paper Model Kit  ¥10.75/9 → ¥1.50
    ('ACTIVITY-FOX-PAPER-001',
     'Fox-Style Paper Model Kit',
     'A small DIY paper model kit featuring assorted fantasy fox-style character designs.',
     1.50, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', 'FANTASY_ANIMAL_CRAFT', true),

    -- 10. Giant Character Papercraft Kit  ¥38.65/1 → ¥39.00  PREMIUM  active=false
    --     Excluded from normal generation — too large for a goodie bag.
    ('ACTIVITY-GIANT-PAPER-001',
     'Giant Character Papercraft Kit',
     'A large DIY papercraft model kit intended to create an approximately 80 cm display figure.',
     39.00, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'PREMIUM', 'LARGE_CHARACTER_CRAFT', false),

    -- 11. Sticky Wall-Crawling Figure  ¥40.36/50 → ¥1.00
    --     TODO: VERIFY package quantity is 50 before production.
    ('TOY-WALL-CRAWLER-001',
     'Sticky Wall-Crawling Figure',
     'A sticky flexible figure designed to tumble or crawl down smooth vertical surfaces.',
     1.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'NOVELTY_ACTION', true),

    -- 12. Dinosaur Skeleton Building Egg  ¥64.50/24 → ¥3.00  PREMIUM  minAge=6 (specified)
    ('TOY-DINO-SKELETON-001',
     'Dinosaur Skeleton Building Egg',
     'A surprise dinosaur skeleton construction toy packaged inside a small egg.',
     3.00, 100, 6, 12, 'TOY', 'SMALL_VOLUME', 'PREMIUM', 'DINOSAUR', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 40)) AS v(i, w)
WHERE sku = 'TOY-FACE-KEYCHAIN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 35)) AS v(i, w)
WHERE sku = 'TOY-RAINBOW-SPRING-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 100), ('TOYS_PLAY', 80)) AS v(i, w)
WHERE sku = 'PUZZLE-MAGIC-RULER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-ROBOT-EXTEND-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 65), ('CUTE_MAGICAL', 40)) AS v(i, w)
WHERE sku = 'NOVELTY-ANIMAL-BLOWOUT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 55)) AS v(i, w)
WHERE sku = 'NOVELTY-PARTY-BLOWOUT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 90), ('TOYS_PLAY', 55)) AS v(i, w)
WHERE sku = 'ACTIVITY-ANIMAL-PAPER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 75), ('READING_PUZZLE', 70)) AS v(i, w)
WHERE sku = 'ACTIVITY-MONSTER-PAPER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 75), ('CUTE_MAGICAL', 65), ('READING_PUZZLE', 65)) AS v(i, w)
WHERE sku = 'ACTIVITY-FOX-PAPER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 70), ('READING_PUZZLE', 65)) AS v(i, w)
WHERE sku = 'ACTIVITY-GIANT-PAPER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-WALL-CRAWLER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('READING_PUZZLE', 75)) AS v(i, w)
WHERE sku = 'TOY-DINO-SKELETON-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-FACE-KEYCHAIN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-RAINBOW-SPRING-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'PUZZLE-MAGIC-RULER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 55)) AS v(a, w)
WHERE sku = 'TOY-ROBOT-EXTEND-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'NOVELTY-ANIMAL-BLOWOUT-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'NOVELTY-PARTY-BLOWOUT-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACTIVITY-ANIMAL-PAPER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACTIVITY-MONSTER-PAPER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACTIVITY-FOX-PAPER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACTIVITY-GIANT-PAPER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-WALL-CRAWLER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 55)) AS v(a, w)
WHERE sku = 'TOY-DINO-SKELETON-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────

-- Both occasions
INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-FACE-KEYCHAIN-001', 'TOY-RAINBOW-SPRING-001', 'PUZZLE-MAGIC-RULER-001',
    'TOY-ROBOT-EXTEND-001', 'ACTIVITY-ANIMAL-PAPER-001', 'ACTIVITY-MONSTER-PAPER-001',
    'ACTIVITY-FOX-PAPER-001', 'ACTIVITY-GIANT-PAPER-001',
    'TOY-WALL-CRAWLER-001', 'TOY-DINO-SKELETON-001'
);

-- CELEBRATION only
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'CELEBRATION' FROM product
WHERE sku IN ('NOVELTY-ANIMAL-BLOWOUT-001', 'NOVELTY-PARTY-BLOWOUT-001');

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 90), ('NOVELTY', 100), ('COLLECTIBLE', 80), ('TACTILE', 55)) AS v(r, w)
WHERE sku = 'TOY-FACE-KEYCHAIN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('PLAY', 95), ('SIMPLE_TOY', 90), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'TOY-RAINBOW-SPRING-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PUZZLE', 100), ('ACTIVITY', 95), ('PLAY', 75), ('TACTILE', 80)) AS v(r, w)
WHERE sku = 'PUZZLE-MAGIC-RULER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 90), ('SIMPLE_TOY', 85), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'TOY-ROBOT-EXTEND-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 100), ('PLAY', 75)) AS v(r, w)
WHERE sku = 'NOVELTY-ANIMAL-BLOWOUT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 100), ('PLAY', 65)) AS v(r, w)
WHERE sku = 'NOVELTY-PARTY-BLOWOUT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PUZZLE', 80), ('PLAY', 50), ('PREMIUM', 80)) AS v(r, w)
WHERE sku = 'ACTIVITY-ANIMAL-PAPER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PUZZLE', 70), ('PLAY', 65), ('COLLECTIBLE', 50)) AS v(r, w)
WHERE sku = 'ACTIVITY-MONSTER-PAPER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PUZZLE', 65), ('PLAY', 60), ('COLLECTIBLE', 60)) AS v(r, w)
WHERE sku = 'ACTIVITY-FOX-PAPER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PUZZLE', 70), ('PREMIUM', 100)) AS v(r, w)
WHERE sku = 'ACTIVITY-GIANT-PAPER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('NOVELTY', 95), ('TACTILE', 75)) AS v(r, w)
WHERE sku = 'TOY-WALL-CRAWLER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 95), ('ACTIVITY', 80), ('PUZZLE', 70), ('COLLECTIBLE', 80), ('PREMIUM', 85)) AS v(r, w)
WHERE sku = 'TOY-DINO-SKELETON-001';

-- ── Reactivate READING_PUZZLE_4_ITEM ─────────────────────────────────────────
-- PUZZLE-role products now exist (PUZZLE-MAGIC-RULER-001, ACTIVITY-MONSTER-PAPER-001,
-- ACTIVITY-FOX-PAPER-001, TOY-DINO-SKELETON-001, ACTIVITY-ANIMAL-PAPER-001).
-- The template can now fill all 4 slots: READING / PUZZLE / UTILITY / NOVELTY.

UPDATE bundle_template
SET active = true
WHERE code = 'READING_PUZZLE_4_ITEM';
