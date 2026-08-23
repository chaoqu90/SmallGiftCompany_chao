-- V7: Seed data for dynamic bundle generation system.
-- TEST DATA — owner must validate real product values before production use.

-- ── Budget Tiers ──────────────────────────────────────────────────────────────
INSERT INTO budget_tier (code, retail_min, retail_max, max_item_cogs, target_retail_price, active)
VALUES
    ('LOW',  5.00,  9.99,  2.50,  7.99, true),
    ('MID',  10.00, 14.99, 4.00, 12.99, true),
    ('HIGH', 15.00, 19.99, 5.50, 17.99, true);

-- ── Bundle Templates ──────────────────────────────────────────────────────────
INSERT INTO bundle_template (code, name, min_age, max_age, active)
VALUES
    ('GENERAL_4_ITEM',       'General 4-Item Bundle',       6, 12, true),
    ('PRESCHOOL_4_ITEM',     'Preschool 4-Item Bundle',     3,  5, true),
    ('READING_PUZZLE_4_ITEM','Reading & Puzzle 4-Item Bundle', 6, 12, true);

-- GENERAL_4_ITEM slots
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'UTILITY',             1, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'ACTIVITY',            2, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'PLAY_WEARABLE_TACTILE', 3, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY_COLLECTIBLE', 4, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';

-- GENERAL_4_ITEM slot roles
INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'UTILITY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'UTILITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'ACTIVITY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'ACTIVITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, r FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
CROSS JOIN (VALUES ('PLAY'), ('WEARABLE'), ('TACTILE')) AS roles(r)
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'PLAY_WEARABLE_TACTILE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, r FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
CROSS JOIN (VALUES ('NOVELTY'), ('COLLECTIBLE')) AS roles(r)
WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'NOVELTY_COLLECTIBLE';

-- PRESCHOOL_4_ITEM slots
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'ACTIVITY',   1, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'TACTILE',    2, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'SIMPLE_TOY', 3, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY',    4, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'ACTIVITY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'ACTIVITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'TACTILE' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'TACTILE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'SIMPLE_TOY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'SIMPLE_TOY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'NOVELTY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'NOVELTY';

-- READING_PUZZLE_4_ITEM slots
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'READING', 1, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'PUZZLE',  2, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'UTILITY', 3, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
SELECT id, 'NOVELTY', 4, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'READING' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'READING';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'PUZZLE' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'PUZZLE';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'UTILITY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'UTILITY';

INSERT INTO bundle_template_slot_role (slot_id, role)
SELECT s.id, 'NOVELTY' FROM bundle_template_slot s
JOIN bundle_template t ON s.bundle_template_id = t.id
WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'NOVELTY';

-- ── Gift Bag Options ──────────────────────────────────────────────────────────
INSERT INTO gift_bag_option (code, name, description, cost, retail_price_adjustment, active, is_default)
VALUES ('CLASSIC_BAG', 'Classic Gift Bag', 'Standard gift bag with tissue paper', 0.50, 0.00, true, true);

-- ── Products: update existing ──────────────────────────────────────────────────
-- TEST DATA — approximate costs, sensible defaults for existing seed products

UPDATE product SET
    min_age = 3, max_age = 12,
    category = 'STICKER_TATTOO', form_factor = 'FLAT_RECT',
    upgrade_tier = 'STANDARD'
WHERE sku = 'STICKER-001';

UPDATE product SET
    min_age = 3, max_age = 10,
    category = 'STATIONERY', form_factor = 'BAR',
    upgrade_tier = 'STANDARD'
WHERE sku = 'CRAYON-001';

UPDATE product SET
    min_age = 3, max_age = 10,
    category = 'TOY', form_factor = 'ROUND',
    upgrade_tier = 'STANDARD'
WHERE sku = 'PUTTY-001';

-- ── Products: new inserts ──────────────────────────────────────────────────────
-- TEST DATA — all costs and metadata are approximate; owner must validate

-- POP_MUSIC products
INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age, category, form_factor, upgrade_tier, active)
VALUES
    ('POP-PEN-001',    'Music Notes Pen',       'Ballpoint pen with music note design',           0.60, 300, 6, 12, 'STATIONERY',  'BAR',       'STANDARD', true),
    ('POP-NOTE-001',   'Pop Star Notebook',     'Mini notebook with pop star cover',              0.90, 250, 6, 12, 'STATIONERY',  'FLAT_RECT', 'STANDARD', true),
    ('POP-BRACE-001',  'Music Bracelet',        'Silicone bracelet with music notes',             0.70, 350, 6, 12, 'ACCESSORY',   'ROUND',     'STANDARD', true),
    ('POP-CARDS-001',  'Pop Star Collector Cards', 'Set of 5 pop star trading cards',            0.80, 400, 6, 12, 'COLLECTIBLE', 'FLAT_RECT', 'STANDARD', true),
    ('POP-MINI-001',   'Pop Star Mini Figure',  'Collectible mini pop star figurine',            1.60, 150, 6, 12, 'COLLECTIBLE', 'SMALL_VOLUME','PREMIUM', true),

-- TOYS_PLAY products
    ('TOY-STRETCH-001','Stretchy Noodle Toy',   'Stretchy sensory noodle toy',                   0.45, 500, 3, 12, 'TOY',         'ROUND',     'STANDARD', true),
    ('TOY-PUZZLE-001', 'Mini Jigsaw Puzzle',    '24-piece mini jigsaw puzzle',                   0.80, 300, 6, 12, 'PUZZLE',      'FLAT_RECT', 'STANDARD', true),
    ('TOY-TOP-001',    'Spinning Top',          'Colourful spinning top',                        0.55, 400, 3, 12, 'TOY',         'ROUND',     'STANDARD', true),
    ('TOY-COL-001',    'Mini Collectible Figure','Small collectible animal figure',               0.40, 600, 3, 12, 'COLLECTIBLE', 'SMALL_VOLUME','STANDARD', true),

-- CUTE_MAGICAL products
    ('MAGIC-PEN-001',  'Unicorn Pencil',        'Pencil with unicorn topper',                    0.45, 400, 3, 12, 'STATIONERY',  'BAR',       'STANDARD', true),
    ('MAGIC-NOTE-001', 'Glitter Notebook',      'Mini notebook with glitter cover',              0.85, 280, 6, 12, 'STATIONERY',  'FLAT_RECT', 'STANDARD', true),
    ('MAGIC-STICK-001','Fairy Sticker Sheet',   'Sheet of fairy and star stickers',              0.35, 600, 3, 12, 'STICKER_TATTOO','FLAT_RECT','STANDARD', true),
    ('MAGIC-MINI-001', 'Unicorn Mini Figure',   'Collectible unicorn figurine',                  1.50, 180, 6, 12, 'COLLECTIBLE', 'SMALL_VOLUME','PREMIUM', true),

-- SPORTS products
    ('SPORT-PEN-001',  'Sports Pen',            'Ballpoint pen with sports design',              0.40, 350, 6, 12, 'STATIONERY',  'BAR',       'STANDARD', true),
    ('SPORT-BALL-001', 'Mini Foam Ball',        'Soft mini foam ball',                           0.75, 300, 3, 12, 'SPORT',       'ROUND',     'STANDARD', true),
    ('SPORT-STICK-001','Team Sticker Pack',     'Pack of sports team stickers',                  0.45, 500, 6, 12, 'STICKER_TATTOO','FLAT_RECT','STANDARD', true),
    ('SPORT-PAD-001',  'Score Pad',             'Mini score keeping notepad',                    0.60, 300, 6, 12, 'STATIONERY',  'FLAT_RECT', 'STANDARD', true),
    ('SPORT-BADGE-001','Sport Achievement Badge','Enamel sport achievement badge',               1.40, 200, 6, 12, 'WEARABLE',    'ROUND',     'PREMIUM',  true),

-- READING_PUZZLE products
    ('READ-MARK-001',  'Character Bookmark',    'Illustrated character bookmark',                0.35, 600, 6, 12, 'BOOK',        'FLAT_RECT', 'STANDARD', true),
    ('READ-BOOK-001',  'Mini Story Book',       'Short illustrated storybook',                   1.00, 200, 6, 12, 'BOOK',        'FLAT_RECT', 'STANDARD', true),
    ('READ-WORD-001',  'Word Puzzle Cards',     'Set of word puzzle activity cards',             0.65, 350, 6, 12, 'PUZZLE',      'FLAT_RECT', 'STANDARD', true),
    ('READ-BRAIN-001', 'Brain Teaser Puzzle',   'Handheld mechanical brain teaser',              1.70, 150, 6, 12, 'PUZZLE',      'SMALL_VOLUME','PREMIUM', true),

-- HALLOWEEN-only products
    ('HALL-BRACE-001', 'Glow-in-Dark Bracelet', 'Halloween glow-in-the-dark bracelet',          0.55, 400, 3, 12, 'WEARABLE',    'ROUND',     'STANDARD', true),
    ('HALL-TATTOO-001','Halloween Tattoo Sheet', 'Temporary Halloween-themed tattoos',           0.30, 700, 3, 12, 'STICKER_TATTOO','FLAT_RECT','STANDARD', true),
    ('HALL-ERASER-001','Spooky Eraser Set',     'Set of Halloween-shaped erasers',               0.40, 500, 3, 12, 'NOVELTY',     'SMALL_VOLUME','STANDARD', true),
    ('HALL-TOY-001',   'Spooky Halloween Toy',  'Mini wind-up Halloween toy',                   1.45, 180, 6, 12, 'TOY',         'SMALL_VOLUME','PREMIUM', true),

-- CELEBRATION-only products
    ('CELE-NOISE-001', 'Party Noisemaker',      'Colourful party noisemaker',                   0.40, 400, 3, 12, 'NOVELTY',     'SMALL_VOLUME','STANDARD', true),

-- Preschool products (age 3-5 only)
    ('PRE-FOAM-001',   'Foam Sticker Activity', 'Foam stickers for creative play',               0.40, 500, 3,  5, 'ACTIVITY',    'FLAT_RECT', 'STANDARD', true),
    ('PRE-BATH-001',   'Bath Toy',              'Soft squeezy bath toy',                         0.55, 350, 3,  5, 'TOY',         'SMALL_VOLUME','STANDARD', true),

-- Inactive product (TEST DATA)
    ('INACTIVE-001',   'Discontinued Item',     'This product is no longer available',           0.50, 100, 3, 12, 'OTHER',       'OTHER',     'STANDARD', false),

-- Low inventory product (TEST DATA)
    ('LOW-INV-001',    'Limited Edition Pin',   'Limited collector pin',                         0.80,   2, 6, 12, 'COLLECTIBLE', 'SMALL_VOLUME','STANDARD', true);

-- ── Product Interest Affinities ────────────────────────────────────────────────
-- TEST DATA — weights reflect thematic fit; owner must validate

-- STICKER-001: cross-appeal craft item
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 80), ('TOYS_PLAY', 50), ('POP_MUSIC', 40), ('SPORTS', 20), ('READING_PUZZLE', 20)
) AS v(i, w)
WHERE sku = 'STICKER-001';

-- CRAYON-001: art/activity cross-appeal
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES
    ('CUTE_MAGICAL', 70), ('TOYS_PLAY', 60), ('READING_PUZZLE', 40), ('POP_MUSIC', 30), ('SPORTS', 15)
) AS v(i, w)
WHERE sku = 'CRAYON-001';

-- PUTTY-001: sensory/tactile cross-appeal
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES
    ('TOYS_PLAY', 85), ('CUTE_MAGICAL', 60), ('POP_MUSIC', 30), ('SPORTS', 25), ('READING_PUZZLE', 20)
) AS v(i, w)
WHERE sku = 'PUTTY-001';

-- POP_MUSIC products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 90), ('CUTE_MAGICAL', 30), ('TOYS_PLAY', 20)) AS v(i, w)
WHERE sku = 'POP-PEN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 90), ('CUTE_MAGICAL', 40), ('READING_PUZZLE', 30)) AS v(i, w)
WHERE sku = 'POP-NOTE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 85), ('CUTE_MAGICAL', 50), ('TOYS_PLAY', 25)) AS v(i, w)
WHERE sku = 'POP-BRACE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 95), ('CUTE_MAGICAL', 30), ('TOYS_PLAY', 20)) AS v(i, w)
WHERE sku = 'POP-CARDS-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 40)) AS v(i, w)
WHERE sku = 'POP-MINI-001';

-- TOYS_PLAY products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 90), ('CUTE_MAGICAL', 45), ('SPORTS', 25)) AS v(i, w)
WHERE sku = 'TOY-STRETCH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 80), ('READING_PUZZLE', 60), ('CUTE_MAGICAL', 30)) AS v(i, w)
WHERE sku = 'TOY-PUZZLE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 90), ('SPORTS', 45), ('CUTE_MAGICAL', 30)) AS v(i, w)
WHERE sku = 'TOY-TOP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 85), ('CUTE_MAGICAL', 55), ('SPORTS', 30)) AS v(i, w)
WHERE sku = 'TOY-COL-001';

-- CUTE_MAGICAL products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 85), ('TOYS_PLAY', 40), ('POP_MUSIC', 30)) AS v(i, w)
WHERE sku = 'MAGIC-PEN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 90), ('POP_MUSIC', 50), ('READING_PUZZLE', 35)) AS v(i, w)
WHERE sku = 'MAGIC-NOTE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 95), ('TOYS_PLAY', 45), ('POP_MUSIC', 30)) AS v(i, w)
WHERE sku = 'MAGIC-STICK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 100), ('TOYS_PLAY', 40)) AS v(i, w)
WHERE sku = 'MAGIC-MINI-001';

-- SPORTS products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('SPORTS', 85), ('TOYS_PLAY', 30), ('READING_PUZZLE', 20)) AS v(i, w)
WHERE sku = 'SPORT-PEN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('SPORTS', 95), ('TOYS_PLAY', 60)) AS v(i, w)
WHERE sku = 'SPORT-BALL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('SPORTS', 90), ('TOYS_PLAY', 35), ('POP_MUSIC', 20)) AS v(i, w)
WHERE sku = 'SPORT-STICK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('SPORTS', 85), ('READING_PUZZLE', 50), ('TOYS_PLAY', 30)) AS v(i, w)
WHERE sku = 'SPORT-PAD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('SPORTS', 100), ('TOYS_PLAY', 30)) AS v(i, w)
WHERE sku = 'SPORT-BADGE-001';

-- READING_PUZZLE products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 90), ('CUTE_MAGICAL', 40), ('TOYS_PLAY', 30)) AS v(i, w)
WHERE sku = 'READ-MARK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 95), ('CUTE_MAGICAL', 35)) AS v(i, w)
WHERE sku = 'READ-BOOK-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 90), ('TOYS_PLAY', 50), ('SPORTS', 30)) AS v(i, w)
WHERE sku = 'READ-WORD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('READING_PUZZLE', 100), ('TOYS_PLAY', 30)) AS v(i, w)
WHERE sku = 'READ-BRAIN-001';

-- HALLOWEEN products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 60), ('CUTE_MAGICAL', 50), ('POP_MUSIC', 20)) AS v(i, w)
WHERE sku = 'HALL-BRACE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 65), ('TOYS_PLAY', 50), ('POP_MUSIC', 20)) AS v(i, w)
WHERE sku = 'HALL-TATTOO-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 70), ('CUTE_MAGICAL', 55), ('READING_PUZZLE', 20)) AS v(i, w)
WHERE sku = 'HALL-ERASER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 80), ('CUTE_MAGICAL', 60)) AS v(i, w)
WHERE sku = 'HALL-TOY-001';

-- CELEBRATION product
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 65), ('CUTE_MAGICAL', 50), ('POP_MUSIC', 45)) AS v(i, w)
WHERE sku = 'CELE-NOISE-001';

-- Preschool products
INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 75), ('TOYS_PLAY', 70), ('READING_PUZZLE', 30)) AS v(i, w)
WHERE sku = 'PRE-FOAM-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 80), ('CUTE_MAGICAL', 55)) AS v(i, w)
WHERE sku = 'PRE-BATH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 50), ('CUTE_MAGICAL', 40)) AS v(i, w)
WHERE sku = 'INACTIVE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 70), ('CUTE_MAGICAL', 50)) AS v(i, w)
WHERE sku = 'LOW-INV-001';

-- ── Product Audience Affinities ────────────────────────────────────────────────
-- TEST DATA — weights reflect cultural tendency; owner must validate

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'STICKER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'CRAYON-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'PUTTY-001';

-- POP_MUSIC
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'POP-PEN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'POP-NOTE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 30)) AS v(a, w) WHERE sku = 'POP-BRACE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 75)) AS v(a, w) WHERE sku = 'POP-CARDS-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 65), ('UNIVERSAL', 40)) AS v(a, w) WHERE sku = 'POP-MINI-001';

-- TOYS_PLAY
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'TOY-STRETCH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'TOY-PUZZLE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'TOY-TOP-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'TOY-COL-001';

-- CUTE_MAGICAL
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 25)) AS v(a, w) WHERE sku = 'MAGIC-PEN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 25)) AS v(a, w) WHERE sku = 'MAGIC-NOTE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 25)) AS v(a, w) WHERE sku = 'MAGIC-STICK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 25)) AS v(a, w) WHERE sku = 'MAGIC-MINI-001';

-- SPORTS
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('MASCULINE', 70), ('UNIVERSAL', 40)) AS v(a, w) WHERE sku = 'SPORT-PEN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('MASCULINE', 70), ('UNIVERSAL', 40)) AS v(a, w) WHERE sku = 'SPORT-BALL-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('MASCULINE', 70), ('UNIVERSAL', 40)) AS v(a, w) WHERE sku = 'SPORT-STICK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('MASCULINE', 65), ('UNIVERSAL', 45)) AS v(a, w) WHERE sku = 'SPORT-PAD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('MASCULINE', 70), ('UNIVERSAL', 40)) AS v(a, w) WHERE sku = 'SPORT-BADGE-001';

-- READING_PUZZLE
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90)) AS v(a, w) WHERE sku = 'READ-MARK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'READ-BOOK-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'READ-WORD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'READ-BRAIN-001';

-- HALLOWEEN
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'HALL-BRACE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'HALL-TATTOO-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'HALL-ERASER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'HALL-TOY-001';

-- CELEBRATION
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'CELE-NOISE-001';

-- Preschool
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 85)) AS v(a, w) WHERE sku = 'PRE-FOAM-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 80)) AS v(a, w) WHERE sku = 'PRE-BATH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 70)) AS v(a, w) WHERE sku = 'INACTIVE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 75)) AS v(a, w) WHERE sku = 'LOW-INV-001';

-- ── Product Occasions ──────────────────────────────────────────────────────────

-- General products (both occasions)
INSERT INTO product_occasion (product_id, occasion)
SELECT id, o FROM product
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS v(o)
WHERE sku IN ('STICKER-001', 'CRAYON-001', 'PUTTY-001',
              'POP-PEN-001', 'POP-NOTE-001', 'POP-BRACE-001', 'POP-CARDS-001', 'POP-MINI-001',
              'TOY-STRETCH-001', 'TOY-PUZZLE-001', 'TOY-TOP-001', 'TOY-COL-001',
              'MAGIC-PEN-001', 'MAGIC-NOTE-001', 'MAGIC-STICK-001', 'MAGIC-MINI-001',
              'SPORT-PEN-001', 'SPORT-BALL-001', 'SPORT-STICK-001', 'SPORT-PAD-001', 'SPORT-BADGE-001',
              'READ-MARK-001', 'READ-BOOK-001', 'READ-WORD-001', 'READ-BRAIN-001',
              'PRE-FOAM-001', 'PRE-BATH-001',
              'LOW-INV-001');

-- INACTIVE: both occasions but product is inactive (should be filtered)
INSERT INTO product_occasion (product_id, occasion)
SELECT id, o FROM product
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS v(o)
WHERE sku = 'INACTIVE-001';

-- HALLOWEEN-only products
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'HALLOWEEN' FROM product
WHERE sku IN ('HALL-BRACE-001', 'HALL-TATTOO-001', 'HALL-ERASER-001', 'HALL-TOY-001');

-- CELEBRATION-only products
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'CELEBRATION' FROM product
WHERE sku = 'CELE-NOISE-001';

-- ── Product Role Affinities ────────────────────────────────────────────────────
-- TEST DATA — primary role 90-100, secondary 40-70, tertiary 10-30

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('COLLECTIBLE', 30)) AS v(r, w)
WHERE sku = 'STICKER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('ACTIVITY', 50)) AS v(r, w)
WHERE sku = 'CRAYON-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 95), ('PLAY', 50)) AS v(r, w)
WHERE sku = 'PUTTY-001';

-- POP_MUSIC
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 95)) AS v(r, w) WHERE sku = 'POP-PEN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 40)) AS v(r, w) WHERE sku = 'POP-NOTE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 95), ('NOVELTY', 45)) AS v(r, w) WHERE sku = 'POP-BRACE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 95), ('NOVELTY', 50)) AS v(r, w) WHERE sku = 'POP-CARDS-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PREMIUM', 100), ('COLLECTIBLE', 60)) AS v(r, w) WHERE sku = 'POP-MINI-001';

-- TOYS_PLAY
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 95), ('PLAY', 55)) AS v(r, w) WHERE sku = 'TOY-STRETCH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PUZZLE', 85), ('ACTIVITY', 60)) AS v(r, w) WHERE sku = 'TOY-PUZZLE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('SIMPLE_TOY', 95), ('PLAY', 55)) AS v(r, w) WHERE sku = 'TOY-TOP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 50)) AS v(r, w) WHERE sku = 'TOY-COL-001';

-- CUTE_MAGICAL
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('NOVELTY', 35)) AS v(r, w) WHERE sku = 'MAGIC-PEN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 40)) AS v(r, w) WHERE sku = 'MAGIC-NOTE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 85), ('NOVELTY', 60)) AS v(r, w) WHERE sku = 'MAGIC-STICK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PREMIUM', 100), ('COLLECTIBLE', 65)) AS v(r, w) WHERE sku = 'MAGIC-MINI-001';

-- SPORTS
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90)) AS v(r, w) WHERE sku = 'SPORT-PEN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 95), ('TACTILE', 50)) AS v(r, w) WHERE sku = 'SPORT-BALL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 50)) AS v(r, w) WHERE sku = 'SPORT-STICK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 90), ('UTILITY', 40)) AS v(r, w) WHERE sku = 'SPORT-PAD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PREMIUM', 100), ('WEARABLE', 80)) AS v(r, w) WHERE sku = 'SPORT-BADGE-001';

-- READING_PUZZLE
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('NOVELTY', 30)) AS v(r, w) WHERE sku = 'READ-MARK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('READING', 100), ('ACTIVITY', 40)) AS v(r, w) WHERE sku = 'READ-BOOK-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PUZZLE', 95), ('ACTIVITY', 50)) AS v(r, w) WHERE sku = 'READ-WORD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PREMIUM', 100), ('PUZZLE', 70)) AS v(r, w) WHERE sku = 'READ-BRAIN-001';

-- HALLOWEEN
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 95), ('NOVELTY', 50)) AS v(r, w) WHERE sku = 'HALL-BRACE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 95), ('COLLECTIBLE', 45)) AS v(r, w) WHERE sku = 'HALL-TATTOO-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 80), ('NOVELTY', 70)) AS v(r, w) WHERE sku = 'HALL-ERASER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PREMIUM', 100), ('PLAY', 55)) AS v(r, w) WHERE sku = 'HALL-TOY-001';

-- CELEBRATION
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 95), ('PLAY', 40)) AS v(r, w) WHERE sku = 'CELE-NOISE-001';

-- Preschool
INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 85), ('TACTILE', 70)) AS v(r, w) WHERE sku = 'PRE-FOAM-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('SIMPLE_TOY', 90), ('TACTILE', 60)) AS v(r, w) WHERE sku = 'PRE-BATH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 60)) AS v(r, w) WHERE sku = 'INACTIVE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 85), ('NOVELTY', 50)) AS v(r, w) WHERE sku = 'LOW-INV-001';
