-- V17: Add 11 new products (batch 7 — balloons, sticky toys, rings, puzzles, skateboards).
--
-- SKIPPED: ACCESSORY-RING-001 — already exists in V8. No changes needed.
--
-- Role mapping notes (invalid enum values remapped to nearest valid BundleRole):
--   ACTIVE_PLAY  → dropped  (PLAY already present on same product)
--   PRETEND_PLAY → PLAY     (for TOY-BALLOON-WAND-001, ACCESSORY-PRINCESS-JEWELRY-001)
--   CREATIVE     → dropped  (ACTIVITY already present on same product)
--   SKILL        → ACTIVITY (for TOY-FINGER-SKATEBOARD-001)
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--
-- Budget tier fit (max_item_cogs: LOW=¥5.50 / MID=¥9.00 / HIGH=¥15.00):
--   ¥0.50  TOY-STICKY-LIZARD-001          — LOW, MID, HIGH
--   ¥0.50  TOY-SPINNING-TOP-001           — LOW, MID, HIGH
--   ¥1.00  TOY-BALLOON-WAND-001           — LOW, MID, HIGH
--   ¥1.00  STICKER-PUZZLE-001             — LOW, MID, HIGH
--   ¥1.00  TOY-SLIDING-PUZZLE-001         — LOW, MID, HIGH
--   ¥2.00  TOY-FINGER-SKATEBOARD-001      — LOW, MID, HIGH
--   ¥3.50  TOY-DINO-EGG-001              — LOW, MID, HIGH
--   ¥5.50  TOY-BALLOON-SWORD-001          — LOW (fits exactly), MID, HIGH
--   ¥11.50 ACCESSORY-PRINCESS-JEWELRY-001 — HIGH standard slot (upgradeTier=PREMIUM,
--                                           also eligible for upgrade slot)
--   ¥19.00 ACCESSORY-BEAD-BRACELET-001    — PREMIUM upgrade slot only
--   ¥25.00 ACCESSORY-PRINCESS-RING-001    — PREMIUM upgrade slot only

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 15. Inflatable Balloon Sword Set  ¥252.99/50 → ¥5.50
    ('TOY-BALLOON-SWORD-001',
     'Inflatable Balloon Sword Set',
     'A lightweight inflatable sword toy with a matching inflatable sheath for active pretend and party play.',
     5.50, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'FANTASY', true),

    -- 16. Princess Balloon Wand  ¥25.41/50 → ¥1.00
    ('TOY-BALLOON-WAND-001',
     'Princess Balloon Wand',
     'A lightweight inflatable character wand designed for pretend play, parties, and celebration activities.',
     1.00, 100, 3, 12, 'TOY', 'BAR', 'STANDARD', 'PRINCESS', true),

    -- 17. Sticky Stretch Lizard  ¥34.90/100 → ¥0.50
    ('TOY-STICKY-LIZARD-001',
     'Sticky Stretch Lizard',
     'A colorful sticky and stretchy lizard toy that can be tossed, stretched, and used for tactile play.',
     0.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'REPTILE', true),

    -- 18. Character Puzzle Sticker Sheet  ¥25.56/48 → ¥1.00
    ('STICKER-PUZZLE-001',
     'Character Puzzle Sticker Sheet',
     'A colorful character sticker sheet with mix-and-match pieces for assembling faces, outfits, and playful designs.',
     1.00, 100, 3, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', 'CUTE_CHARACTER', true),

    -- 19. Colorful Mini Spinning Top  ¥14.10/58 → ¥0.50
    ('TOY-SPINNING-TOP-001',
     'Colorful Mini Spinning Top',
     'A small transparent spinning top in assorted bright colors and shapes for simple tabletop play.',
     0.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'COLORFUL', true),

    -- 21. Princess Crown Ring  ¥24.92/1 → ¥25.00  PREMIUM  (upgrade slot only)
    ('ACCESSORY-PRINCESS-RING-001',
     'Princess Crown Ring',
     'An adjustable costume ring featuring a delicate crown-inspired design with colorful faux gemstones.',
     25.00, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'PREMIUM', 'PRINCESS', true),

    -- 22. Colorful Bead Bracelet  ¥18.96/1 → ¥19.00  PREMIUM  (upgrade slot only)
    ('ACCESSORY-BEAD-BRACELET-001',
     'Colorful Bead Bracelet',
     'A colorful beaded children''s bracelet with a playful flower accent and assorted candy-colored beads.',
     19.00, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'PREMIUM', 'FLOWER', true),

    -- 23. Mini Number Sliding Puzzle  ¥45/50 → ¥1.00
    ('TOY-SLIDING-PUZZLE-001',
     'Mini Number Sliding Puzzle',
     'A compact number sliding puzzle with colorful tiles that can be rearranged into numerical order.',
     1.00, 100, 3, 12, 'TOY', 'FLAT_RECT', 'STANDARD', 'COLORFUL', true),

    -- 24. Growing Dinosaur Egg  ¥18.90/6 → ¥3.50
    ('TOY-DINO-EGG-001',
     'Growing Dinosaur Egg',
     'A surprise dinosaur egg that expands and reveals a dinosaur figure after being placed in water.',
     3.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'DINOSAUR', true),

    -- 25. Princess Jewelry Set  ¥11.35/1 → ¥11.50  PREMIUM
    --     Cost ¥11.50 fits HIGH standard slots AND upgrade slot.
    ('ACCESSORY-PRINCESS-JEWELRY-001',
     'Princess Jewelry Set',
     'A coordinated children''s costume jewelry set with colorful faux pearls, gemstones, and princess-inspired decorative elements.',
     11.50, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'PREMIUM', 'PRINCESS', true),

    -- 26. Mini Finger Skateboard  ¥59/30 → ¥2.00
    ('TOY-FINGER-SKATEBOARD-001',
     'Mini Finger Skateboard',
     'A miniature finger skateboard with rolling wheels for tricks, tabletop play, and skill-based challenges.',
     2.00, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'SPORTS', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'TOY-BALLOON-SWORD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 95), ('TOYS_PLAY', 85)) AS v(i, w)
WHERE sku = 'TOY-BALLOON-WAND-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 20)) AS v(i, w)
WHERE sku = 'TOY-STICKY-LIZARD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 80), ('READING_PUZZLE', 75), ('TOYS_PLAY', 45)) AS v(i, w)
WHERE sku = 'STICKER-PUZZLE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 35)) AS v(i, w)
WHERE sku = 'TOY-SPINNING-TOP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'CUTE_MAGICAL', 100 FROM product WHERE sku = 'ACCESSORY-PRINCESS-RING-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'CUTE_MAGICAL', 100 FROM product WHERE sku = 'ACCESSORY-BEAD-BRACELET-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 100), ('TOYS_PLAY', 70)) AS v(i, w)
WHERE sku = 'TOY-SLIDING-PUZZLE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 60), ('READING_PUZZLE', 25)) AS v(i, w)
WHERE sku = 'TOY-DINO-EGG-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'CUTE_MAGICAL', 100 FROM product WHERE sku = 'ACCESSORY-PRINCESS-JEWELRY-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 100 FROM product WHERE sku = 'TOY-FINGER-SKATEBOARD-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-BALLOON-SWORD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'TOY-BALLOON-WAND-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-STICKY-LIZARD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'STICKER-PUZZLE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-SPINNING-TOP-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 95), ('UNIVERSAL', 20)) AS v(a, w)
WHERE sku = 'ACCESSORY-PRINCESS-RING-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 90), ('UNIVERSAL', 25)) AS v(a, w)
WHERE sku = 'ACCESSORY-BEAD-BRACELET-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-SLIDING-PUZZLE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-DINO-EGG-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 95), ('UNIVERSAL', 20)) AS v(a, w)
WHERE sku = 'ACCESSORY-PRINCESS-JEWELRY-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-FINGER-SKATEBOARD-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-BALLOON-SWORD-001', 'TOY-BALLOON-WAND-001', 'TOY-STICKY-LIZARD-001',
    'STICKER-PUZZLE-001', 'TOY-SPINNING-TOP-001',
    'ACCESSORY-PRINCESS-RING-001', 'ACCESSORY-BEAD-BRACELET-001',
    'TOY-SLIDING-PUZZLE-001', 'TOY-DINO-EGG-001',
    'ACCESSORY-PRINCESS-JEWELRY-001', 'TOY-FINGER-SKATEBOARD-001'
);

-- ── Role Affinities ───────────────────────────────────────────────────────────
-- Note: ACTIVE_PLAY and PRETEND_PLAY are not valid BundleRole enum values.
--   ACTIVE_PLAY  → dropped (PLAY already covers it)
--   PRETEND_PLAY → mapped to PLAY
--   CREATIVE     → dropped (ACTIVITY already covers it)
--   SKILL        → mapped to ACTIVITY

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('NOVELTY', 75)) AS v(r, w)
WHERE sku = 'TOY-BALLOON-SWORD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('SIMPLE_TOY', 85), ('NOVELTY', 75)) AS v(r, w)
WHERE sku = 'TOY-BALLOON-WAND-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('PLAY', 95), ('SIMPLE_TOY', 90), ('NOVELTY', 85)) AS v(r, w)
WHERE sku = 'TOY-STICKY-LIZARD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PUZZLE', 75), ('NOVELTY', 55)) AS v(r, w)
WHERE sku = 'STICKER-PUZZLE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('SIMPLE_TOY', 100), ('NOVELTY', 75), ('TACTILE', 55)) AS v(r, w)
WHERE sku = 'TOY-SPINNING-TOP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 90), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'ACCESSORY-PRINCESS-RING-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 85), ('NOVELTY', 55)) AS v(r, w)
WHERE sku = 'ACCESSORY-BEAD-BRACELET-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PUZZLE', 100), ('ACTIVITY', 95), ('PLAY', 80), ('TACTILE', 60)) AS v(r, w)
WHERE sku = 'TOY-SLIDING-PUZZLE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 95), ('NOVELTY', 100), ('ACTIVITY', 85), ('COLLECTIBLE', 65)) AS v(r, w)
WHERE sku = 'TOY-DINO-EGG-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('PLAY', 85), ('COLLECTIBLE', 80), ('NOVELTY', 65)) AS v(r, w)
WHERE sku = 'ACCESSORY-PRINCESS-JEWELRY-001';

-- SKILL → ACTIVITY
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('ACTIVITY', 95), ('TACTILE', 80), ('COLLECTIBLE', 65), ('NOVELTY', 55)) AS v(r, w)
WHERE sku = 'TOY-FINGER-SKATEBOARD-001';
