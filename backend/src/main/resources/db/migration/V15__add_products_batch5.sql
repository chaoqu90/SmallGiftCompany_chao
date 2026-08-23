-- V15: Add 12 new products (batch 5 — pixel lights, dinos, bracelets, fidget lamps).
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--                               (exception: STATIONERY-CUTE-ERASER-001=6)
--   TOY-PIXEL-FIGURE-LIGHT-001 / TOY-WHACK-MOUSE-001 / STATIONERY-UV-PEN-001
--                             — verify BOTH safety AND battery compliance before setting min_age
--   ACCESSORY-CROC-SNAKE-001  — VERIFY that 3 pieces form one complete set per favor, not 3 separate
--   ACCESSORY-TRANSFORM-BRACELET-001 cost ¥9.00 — VERIFY supplier quantity is 6
--
-- Budget tier fit for standard slots (max_item_cogs: LOW=¥5.50 / MID=¥9.00 / HIGH=¥15.00):
--   ¥0.50  TOY-PROJECTILE-DINO-001        — LOW, MID, HIGH
--   ¥1.00  TOY-FLYING-GYRO-001            — LOW, MID, HIGH
--   ¥2.00  STATIONERY-UV-PEN-001          — LOW, MID, HIGH
--   ¥3.00  TOY-BITING-DINO-MINI-001       — LOW, MID, HIGH
--   ¥3.00  ACCESSORY-UNICORN-BRACELET-001 — LOW, MID, HIGH
--   ¥3.50  TOY-PIXEL-FIGURE-LIGHT-001     — LOW, MID, HIGH
--   ¥4.00  TOY-WHACK-MOUSE-001            — LOW, MID, HIGH
--   ¥4.50  STATIONERY-CUTE-ERASER-001     — LOW, MID, HIGH
--   ¥5.00  TOY-CHARACTER-SPIN-LAMP-001    — MID, HIGH
--   ¥9.00  ACCESSORY-TRANSFORM-BRACELET-001 — MID, HIGH (fits MID exactly at ¥9.00)
--   ¥11.00 TOY-PRINCESS-SPIN-LAMP-001     — HIGH only
--   ¥13.50 ACCESSORY-CROC-SNAKE-001       — PREMIUM upgrade slot (upgradeTier=PREMIUM)

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. Pixel Character Light-Up Keychain  ¥17.30/5 → ¥3.50
    --    TODO: verify BOTH safety AND battery compliance before setting min_age.
    ('TOY-PIXEL-FIGURE-LIGHT-001',
     'Pixel Character Light-Up Keychain',
     'A pixel-style character keychain with colorful built-in lighting for bags, backpacks, or play.',
     3.50, 100, 3, 12, 'TOY', 'SMALL_VOLUME', 'STANDARD', 'PIXEL_GAME', true),

    -- 2. Finger-Launch Dinosaur  ¥8.98/30 → ¥0.50
    ('TOY-PROJECTILE-DINO-001',
     'Finger-Launch Dinosaur',
     'A small stretchy dinosaur toy designed to be launched with a finger for simple active play.',
     0.50, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'DINOSAUR', true),

    -- 3. 3-Piece Croc Snake Shoe Charm  ¥13.20/1 set → ¥13.50  PREMIUM
    --    TODO: VERIFY 3 pieces form one complete set per favor (not 3 independent favors).
    ('ACCESSORY-CROC-SNAKE-001',
     '3-Piece Croc Snake Shoe Charm',
     'A three-piece dimensional snake charm set designed to decorate compatible clog-style shoes.',
     13.50, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'PREMIUM', 'ANIMAL', true),

    -- 4. Mini Biting Dinosaur Figure  ¥25.80/10 → ¥3.00
    ('TOY-BITING-DINO-MINI-001',
     'Mini Biting Dinosaur Figure',
     'A small dinosaur figure with an interactive biting mechanism for tactile and imaginative play.',
     3.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'DINOSAUR', true),

    -- 5. Pull-String Flying Gyro  ¥40.80/50 → ¥1.00
    ('TOY-FLYING-GYRO-001',
     'Pull-String Flying Gyro',
     'A colorful pull-string spinning toy that launches a lightweight rotor for active play.',
     1.00, 100, 3, 12, 'TOY', 'ROUND', 'STANDARD', 'FIDGET', true),

    -- 6. Transforming Animal Bracelet  ¥52.40/6 → ¥9.00
    --    TODO: VERIFY supplier quantity is 6 before production.
    ('ACCESSORY-TRANSFORM-BRACELET-001',
     'Transforming Animal Bracelet',
     'A colorful wearable bracelet featuring a small animal figure that transforms through twisting articulated pieces.',
     9.00, 100, 3, 12, 'ACCESSORY', 'IRREGULAR_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 7. DIY Unicorn Transforming Bracelet  ¥22.70/8 → ¥3.00
    ('ACCESSORY-UNICORN-BRACELET-001',
     'DIY Unicorn Transforming Bracelet',
     'A colorful beaded animal bracelet with playful transforming pieces for wearable and tactile play.',
     3.00, 100, 3, 12, 'ACCESSORY', 'IRREGULAR_VOLUME', 'STANDARD', 'CUTE_MAGICAL', true),

    -- 8. Cute Animal Block Eraser  ¥25.61/6 → ¥4.50  minAge=6 (specified)
    ('STATIONERY-CUTE-ERASER-001',
     'Cute Animal Block Eraser',
     'A chunky square eraser decorated with a cute illustrated animal character.',
     4.50, 100, 6, 12, 'STATIONERY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_ANIMAL', true),

    -- 9. Mini Whack-a-Mouse Game Keychain  ¥110/30 → ¥4.00
    --    TODO: verify BOTH safety AND battery compliance before setting min_age.
    --    TODO: VERIFY supplier quantity is 30 before production.
    ('TOY-WHACK-MOUSE-001',
     'Mini Whack-a-Mouse Game Keychain',
     'A compact handheld whack-a-mouse style game featuring buttons, lights, sound, and a keychain.',
     4.00, 100, 3, 12, 'TOY', 'FLAT_RECT', 'STANDARD', 'GAME', true),

    -- 10. Invisible UV Light Pen  ¥19.80/10 → ¥2.00
    --     TODO: verify BOTH safety AND battery compliance before setting min_age.
    ('STATIONERY-UV-PEN-001',
     'Invisible UV Light Pen',
     'A colorful secret-message pen with invisible ink that can be revealed using its built-in UV light.',
     2.00, 100, 3, 12, 'STATIONERY', 'BAR', 'STANDARD', 'SECRET_MESSAGE', true),

    -- 11. Character Spinning Stress-Relief Lamp  ¥18.10/4 → ¥5.00
    ('TOY-CHARACTER-SPIN-LAMP-001',
     'Character Spinning Stress-Relief Lamp',
     'A small character-themed spinning desk toy with a decorative stand for tactile fidget play.',
     5.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'CUTE_CHARACTER', true),

    -- 12. Princess Spinning Stress-Relief Lamp  ¥10.69/1 → ¥11.00
    ('TOY-PRINCESS-SPIN-LAMP-001',
     'Princess Spinning Stress-Relief Lamp',
     'A princess-themed spinning desk toy with a double-sided illustrated design and display base.',
     11.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'PRINCESS', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 100 FROM product WHERE sku = 'TOY-PIXEL-FIGURE-LIGHT-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 100 FROM product WHERE sku = 'TOY-PROJECTILE-DINO-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 60 FROM product WHERE sku = 'ACCESSORY-CROC-SNAKE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 100 FROM product WHERE sku = 'TOY-BITING-DINO-MINI-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, 'TOYS_PLAY', 100 FROM product WHERE sku = 'TOY-FLYING-GYRO-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 90), ('TOYS_PLAY', 85)) AS v(i, w)
WHERE sku = 'ACCESSORY-TRANSFORM-BRACELET-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 100), ('TOYS_PLAY', 75)) AS v(i, w)
WHERE sku = 'ACCESSORY-UNICORN-BRACELET-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 85), ('READING_PUZZLE', 40)) AS v(i, w)
WHERE sku = 'STATIONERY-CUTE-ERASER-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('READING_PUZZLE', 65)) AS v(i, w)
WHERE sku = 'TOY-WHACK-MOUSE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 75), ('READING_PUZZLE', 70)) AS v(i, w)
WHERE sku = 'STATIONERY-UV-PEN-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 95), ('TOYS_PLAY', 90)) AS v(i, w)
WHERE sku = 'TOY-CHARACTER-SPIN-LAMP-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 100), ('TOYS_PLAY', 75)) AS v(i, w)
WHERE sku = 'TOY-PRINCESS-SPIN-LAMP-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-PIXEL-FIGURE-LIGHT-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-PROJECTILE-DINO-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 90 FROM product WHERE sku = 'ACCESSORY-CROC-SNAKE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 90), ('MASCULINE', 50)) AS v(a, w)
WHERE sku = 'TOY-BITING-DINO-MINI-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-FLYING-GYRO-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 65)) AS v(a, w)
WHERE sku = 'ACCESSORY-TRANSFORM-BRACELET-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 90), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'ACCESSORY-UNICORN-BRACELET-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'STATIONERY-CUTE-ERASER-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-WHACK-MOUSE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'STATIONERY-UV-PEN-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 55)) AS v(a, w)
WHERE sku = 'TOY-CHARACTER-SPIN-LAMP-001';

-- TOY-PRINCESS-SPIN-LAMP-001: FEMININE only (no UNIVERSAL per spec)
INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'FEMININE', 95 FROM product WHERE sku = 'TOY-PRINCESS-SPIN-LAMP-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────
-- All 12 products appropriate for both CELEBRATION and HALLOWEEN.

INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-PIXEL-FIGURE-LIGHT-001', 'TOY-PROJECTILE-DINO-001', 'ACCESSORY-CROC-SNAKE-001',
    'TOY-BITING-DINO-MINI-001', 'TOY-FLYING-GYRO-001', 'ACCESSORY-TRANSFORM-BRACELET-001',
    'ACCESSORY-UNICORN-BRACELET-001', 'STATIONERY-CUTE-ERASER-001', 'TOY-WHACK-MOUSE-001',
    'STATIONERY-UV-PEN-001', 'TOY-CHARACTER-SPIN-LAMP-001', 'TOY-PRINCESS-SPIN-LAMP-001'
);

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 100), ('COLLECTIBLE', 85), ('PLAY', 80)) AS v(r, w)
WHERE sku = 'TOY-PIXEL-FIGURE-LIGHT-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('NOVELTY', 85), ('TACTILE', 65)) AS v(r, w)
WHERE sku = 'TOY-PROJECTILE-DINO-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('NOVELTY', 90), ('COLLECTIBLE', 75), ('PREMIUM', 75)) AS v(r, w)
WHERE sku = 'ACCESSORY-CROC-SNAKE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 90), ('NOVELTY', 85), ('COLLECTIBLE', 60)) AS v(r, w)
WHERE sku = 'TOY-BITING-DINO-MINI-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('NOVELTY', 90), ('TACTILE', 65)) AS v(r, w)
WHERE sku = 'TOY-FLYING-GYRO-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('PLAY', 85), ('TACTILE', 85), ('NOVELTY', 95), ('COLLECTIBLE', 70)) AS v(r, w)
WHERE sku = 'ACCESSORY-TRANSFORM-BRACELET-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('TACTILE', 85), ('PLAY', 75), ('COLLECTIBLE', 80), ('NOVELTY', 80)) AS v(r, w)
WHERE sku = 'ACCESSORY-UNICORN-BRACELET-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('COLLECTIBLE', 80), ('NOVELTY', 65)) AS v(r, w)
WHERE sku = 'STATIONERY-CUTE-ERASER-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('ACTIVITY', 90), ('NOVELTY', 90), ('COLLECTIBLE', 55)) AS v(r, w)
WHERE sku = 'TOY-WHACK-MOUSE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('UTILITY', 90), ('NOVELTY', 100), ('PLAY', 75)) AS v(r, w)
WHERE sku = 'STATIONERY-UV-PEN-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 100), ('NOVELTY', 95), ('COLLECTIBLE', 90), ('PLAY', 75)) AS v(r, w)
WHERE sku = 'TOY-CHARACTER-SPIN-LAMP-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('TACTILE', 90), ('NOVELTY', 90), ('COLLECTIBLE', 85), ('PLAY', 65)) AS v(r, w)
WHERE sku = 'TOY-PRINCESS-SPIN-LAMP-001';
