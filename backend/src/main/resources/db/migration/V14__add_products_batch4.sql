-- V14: Add 12 new products (batch 4 — collectibles, fidgets, pixel/dino theme).
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--                               (exceptions: BOOK-POP-MINI-001=6, BOOK-POP-SPIRAL-001=6)
--   TOY-LIGHT-SWORD-001 / TOY-PIXEL-LIGHT-001 min_age — verify BOTH safety AND battery compliance.
--   ACCESSORY-AXOLOTL-001 cost = ¥6.50 — assumed 2 units per pair; VERIFY supplier quantity.
--
-- Budget tier fit for standard slots (max_item_cogs: LOW=¥5.50 / MID=¥9.00 / HIGH=¥15.00):
--   ¥0.50  BOOK-POP-MINI-001         — LOW, MID, HIGH
--   ¥1.50  COLLECTIBLE-POP-CARD-001  — LOW, MID, HIGH
--   ¥3.00  TOY-DRAGON-EGG-001        — LOW, MID, HIGH
--   ¥3.00  ACCESSORY-RETRO-BROOCH-001 — LOW, MID, HIGH
--   ¥3.50  TOY-PIXEL-LIGHT-001       — LOW, MID, HIGH
--   ¥4.00  ACCESSORY-POP-KEYCHAIN-001 — LOW, MID, HIGH
--   ¥4.00  TOY-BITING-DINO-001       — LOW, MID, HIGH
--   ¥5.50  TOY-LIGHT-SWORD-001       — MID, HIGH
--   ¥6.00  BOOK-POP-SPIRAL-001       — HIGH only
--   ¥6.50  ACCESSORY-AXOLOTL-001     — HIGH only
--   ¥6.00  TOY-SPIRAL-FIDGET-001     — PREMIUM upgrade slot (upgradeTier=PREMIUM)
--   ¥17.00 ACCESSORY-TREX-001        — PREMIUM upgrade slot only (exceeds all standard budgets)

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. Pop Fantasy Collectible Card Pack  ¥32.81/30 → ¥1.50
    ('COLLECTIBLE-POP-CARD-001',
     'Pop Fantasy Collectible Card Pack',
     'A sealed mini collectible card pack containing five assorted character cards.',
     1.50, 100, 3, 12, 'COLLECTIBLE', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true),

    -- 2. Pop Fantasy Mini Notebook  ¥0.37/1 → ¥0.50  minAge=6 (specified)
    ('BOOK-POP-MINI-001',
     'Pop Fantasy Mini Notebook',
     'A compact character-themed mini notebook for notes, doodles, and journaling.',
     0.50, 100, 6, 12, 'BOOK', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true),

    -- 3. Acrylic Character Keychain  ¥3.83/1 → ¥4.00
    ('ACCESSORY-POP-KEYCHAIN-001',
     'Acrylic Character Keychain',
     'A colorful acrylic character keychain for decorating backpacks and pencil cases.',
     4.00, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'STANDARD', 'POP_FANTASY', true),

    -- 4. 3D Spiral Fidget Toy  ¥35.86/6 → ¥6.00  PREMIUM
    ('TOY-SPIRAL-FIDGET-001',
     '3D Spiral Fidget Toy',
     'A 3D-printed spiral fidget toy with a twisting geometric design for tactile play.',
     6.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'PREMIUM', 'FIDGET', true),

    -- 5. 3D Dragon Egg Fidget  ¥8.90/3 → ¥3.00
    ('TOY-DRAGON-EGG-001',
     '3D Dragon Egg Fidget',
     'A colorful articulated dragon-egg style fidget toy with a tactile scale pattern.',
     3.00, 100, 3, 12, 'TOY', 'ROUND', 'STANDARD', 'DRAGON', true),

    -- 6. T-Rex Skeleton Bag Charm  ¥16.74/1 → ¥17.00  PREMIUM
    --    Exceeds all standard slot budgets; upgrade slot only.
    ('ACCESSORY-TREX-001',
     'T-Rex Skeleton Bag Charm',
     'An articulated dinosaur skeleton charm for backpacks, bags, or collectible displays.',
     17.00, 100, 3, 12, 'ACCESSORY', 'IRREGULAR_VOLUME', 'PREMIUM', 'DINOSAUR', true),

    -- 7. Light-Up Pixel Sword Keychain  ¥16.23/3 → ¥5.50
    --    TODO: verify BOTH safety AND battery compliance before setting min_age.
    ('TOY-LIGHT-SWORD-001',
     'Light-Up Pixel Sword Keychain',
     'A pixel-style mini sword keychain with a press-activated light.',
     5.50, 100, 3, 12, 'TOY', 'BAR', 'STANDARD', 'PIXEL_GAME', true),

    -- 8. Pixel-Style Light-Up Keychain  ¥33.91/10 → ¥3.50
    --    TODO: verify BOTH safety AND battery compliance before setting min_age.
    ('TOY-PIXEL-LIGHT-001',
     'Pixel-Style Light-Up Keychain',
     'A mini pixel-style light-up accessory featuring assorted fantasy-game inspired shapes.',
     3.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'PIXEL_GAME', true),

    -- 9. Retro Character Brooch  ¥2.92/1 → ¥3.00
    ('ACCESSORY-RETRO-BROOCH-001',
     'Retro Character Brooch',
     'A small illustrated character brooch for backpacks, clothing, and accessory collections.',
     3.00, 100, 3, 12, 'ACCESSORY', 'FLAT_RECT', 'STANDARD', 'RETRO_CHARACTER', true),

    -- 10. Articulated Biting Dinosaur  ¥18.50/5 → ¥4.00
    ('TOY-BITING-DINO-001',
     'Articulated Biting Dinosaur',
     'A colorful articulated dinosaur figure designed for finger-operated movement and tactile play.',
     4.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'DINOSAUR', true),

    -- 11. Axolotl Keychain  ¥12.66/2 → ¥6.50
    --     TODO: VERIFY supplier quantity is 2 per pair before production.
    ('ACCESSORY-AXOLOTL-001',
     'Axolotl Keychain',
     'A cute pixel-style axolotl keychain for decorating backpacks, bags, or pencil cases.',
     6.50, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 12. Pop Fantasy Spiral Notebook  ¥5.80/1 → ¥6.00  minAge=6 (specified)
    ('BOOK-POP-SPIRAL-001',
     'Pop Fantasy Spiral Notebook',
     'A compact spiral notebook with decorative character stickers and a coordinating charm.',
     6.00, 100, 6, 12, 'BOOK', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('TOYS_PLAY', 55)) AS v(i, w)
WHERE sku = 'COLLECTIBLE-POP-CARD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('READING_PUZZLE', 55), ('CUTE_MAGICAL', 40)) AS v(i, w)
WHERE sku = 'BOOK-POP-MINI-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 50)) AS v(i, w)
WHERE sku = 'ACCESSORY-POP-KEYCHAIN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('READING_PUZZLE', 40)) AS v(i, w)
WHERE sku = 'TOY-SPIRAL-FIDGET-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 55)) AS v(i, w)
WHERE sku = 'TOY-DRAGON-EGG-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('READING_PUZZLE', 45)) AS v(i, w)
WHERE sku = 'ACCESSORY-TREX-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-LIGHT-SWORD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-PIXEL-LIGHT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 25), ('CUTE_MAGICAL', 35)) AS v(i, w)
WHERE sku = 'ACCESSORY-RETRO-BROOCH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-BITING-DINO-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 90), ('TOYS_PLAY', 40)) AS v(i, w)
WHERE sku = 'ACCESSORY-AXOLOTL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('READING_PUZZLE', 55), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'BOOK-POP-SPIRAL-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 55)) AS v(a, w)
WHERE sku = 'COLLECTIBLE-POP-CARD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'BOOK-POP-MINI-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'ACCESSORY-POP-KEYCHAIN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-SPIRAL-FIDGET-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-DRAGON-EGG-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 55)) AS v(a, w)
WHERE sku = 'ACCESSORY-TREX-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 50)) AS v(a, w)
WHERE sku = 'TOY-LIGHT-SWORD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-PIXEL-LIGHT-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACCESSORY-RETRO-BROOCH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 50)) AS v(a, w)
WHERE sku = 'TOY-BITING-DINO-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'ACCESSORY-AXOLOTL-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'BOOK-POP-SPIRAL-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────
-- All 12 products are appropriate for both CELEBRATION and HALLOWEEN.

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'COLLECTIBLE-POP-CARD-001', 'BOOK-POP-MINI-001', 'ACCESSORY-POP-KEYCHAIN-001',
    'TOY-SPIRAL-FIDGET-001', 'TOY-DRAGON-EGG-001', 'ACCESSORY-TREX-001',
    'TOY-LIGHT-SWORD-001', 'TOY-PIXEL-LIGHT-001', 'ACCESSORY-RETRO-BROOCH-001',
    'TOY-BITING-DINO-001', 'ACCESSORY-AXOLOTL-001', 'BOOK-POP-SPIRAL-001'
);

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 100), ('NOVELTY', 85), ('PLAY', 35)) AS v(r, w)
WHERE sku = 'COLLECTIBLE-POP-CARD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 85), ('UTILITY', 80), ('READING', 60)) AS v(r, w)
WHERE sku = 'BOOK-POP-MINI-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 100), ('NOVELTY', 80), ('WEARABLE', 55)) AS v(r, w)
WHERE sku = 'ACCESSORY-POP-KEYCHAIN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('PLAY', 95), ('NOVELTY', 85), ('PREMIUM', 80)) AS v(r, w)
WHERE sku = 'TOY-SPIRAL-FIDGET-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('PLAY', 90), ('NOVELTY', 80), ('COLLECTIBLE', 55)) AS v(r, w)
WHERE sku = 'TOY-DRAGON-EGG-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 100), ('PLAY', 85), ('NOVELTY', 80), ('PREMIUM', 100)) AS v(r, w)
WHERE sku = 'ACCESSORY-TREX-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 95), ('NOVELTY', 100), ('COLLECTIBLE', 65)) AS v(r, w)
WHERE sku = 'TOY-LIGHT-SWORD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 100), ('PLAY', 90), ('COLLECTIBLE', 70)) AS v(r, w)
WHERE sku = 'TOY-PIXEL-LIGHT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 90), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'ACCESSORY-RETRO-BROOCH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 95), ('COLLECTIBLE', 65), ('NOVELTY', 80)) AS v(r, w)
WHERE sku = 'TOY-BITING-DINO-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 90), ('NOVELTY', 75), ('WEARABLE', 55)) AS v(r, w)
WHERE sku = 'ACCESSORY-AXOLOTL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 90), ('ACTIVITY', 85), ('READING', 60), ('COLLECTIBLE', 45)) AS v(r, w)
WHERE sku = 'BOOK-POP-SPIRAL-001';
