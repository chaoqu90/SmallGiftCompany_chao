-- V12: Add 12 new products (batch 3 — pop-fantasy / articulated toys theme).
--
-- TODO placeholders:
--   inventory_quantity = 100  — replace with real stock counts
--   min_age = 3               — replace after supplier safety verification
--                               (exceptions: BOOK-KPOP-JOURNAL-001=6, STATIONERY-KPOP-PENCIL-001=6,
--                                PEN-KPOP-PUSH-001=6, PEN-KPOP-ACRYLIC-001=6, ACTIVITY-KPOP-DRESSUP-001=6)
--   NOVELTY-KPOP-TATTOO-001 min_age = 3 — verify skin safety with supplier before production.
--
-- Cost vs budget tier notes:
--   TOY-KPOP-FIGURE-001     ¥5.00  — fits MID (9.00) and HIGH (15.00); PREMIUM upgrade slot only
--   ACCESSORY-CAT-CHARM-001 ¥6.00  — fits HIGH (15.00) standard slot only
--   ACCESSORY-KPOP-BADGE-001 ¥4.50 — fits MID (9.00) and HIGH (15.00)
--   ACCESSORY-KPOP-BROOCH-001 ¥3.50 — fits MID (9.00) and HIGH (15.00)
--   PEN-KPOP-ACRYLIC-001    ¥4.00  — fits MID (9.00) and HIGH (15.00)
--   ACTIVITY-KPOP-DRESSUP-001 ¥5.00 — fits MID (9.00) and HIGH (15.00)
--   BOOK-KPOP-JOURNAL-001   ¥27.50 — exceeds all standard slot budgets; PREMIUM upgrade slot only
--   ACTIVITY-GIANT-PAPER-001 ¥39.00 — same; PREMIUM upgrade slot only (already active from V11)

-- ── Products ─────────────────────────────────────────────────────────────────

INSERT INTO product (sku, name, description, cost, inventory_quantity, min_age, max_age,
                     category, form_factor, upgrade_tier, theme_code, active)
VALUES
    -- 1. 3D Articulated Sword  ¥44.62/50 → ¥1.00
    ('TOY-FLEX-SWORD-001',
     '3D Articulated Sword',
     'A colorful articulated mini sword with flexible linked segments for tactile play.',
     1.00, 100, 3, 12, 'TOY', 'BAR', 'STANDARD', 'FANTASY_WEAPON', true),

    -- 2. 3D Articulated Dragon  ¥91.01/50 → ¥2.00
    ('TOY-DRAGON-001',
     '3D Articulated Dragon',
     'A colorful flexible dragon figure with articulated segments for tactile and imaginative play.',
     2.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'STANDARD', 'DRAGON', true),

    -- 3. Character Phone and Bag Charm  ¥5.88/1 → ¥6.00
    ('ACCESSORY-CAT-CHARM-001',
     'Character Phone and Bag Charm',
     'A small character charm with strap for decorating a backpack, pencil case, or other accessory.',
     6.00, 100, 3, 12, 'ACCESSORY', 'SMALL_VOLUME', 'STANDARD', 'CUTE_CHARACTER', true),

    -- 4. Pop Fantasy Temporary Tattoo  ¥18.46/8 → ¥2.50
    --    TODO: verify skin safety with supplier; min_age may need to be higher than 3.
    ('NOVELTY-KPOP-TATTOO-001',
     'Pop Fantasy Temporary Tattoo',
     'A colorful temporary tattoo sheet with bold fantasy-pop inspired graphics.',
     2.50, 100, 3, 12, 'STICKER_TATTOO', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true),

    -- 5. Pop Fantasy Mini Figure  ¥28.90/6 → ¥5.00  PREMIUM
    ('TOY-KPOP-FIGURE-001',
     'Pop Fantasy Mini Figure',
     'A colorful collectible mini character figure inspired by pop-fantasy styling.',
     5.00, 100, 3, 12, 'TOY', 'IRREGULAR_VOLUME', 'PREMIUM', 'POP_FANTASY', true),

    -- 6. Pop Fantasy Journal  ¥82/3 → ¥27.50  PREMIUM  minAge=6 (specified)
    --    Cost exceeds all standard slot budget tiers; used as upgrade only.
    ('BOOK-KPOP-JOURNAL-001',
     'Pop Fantasy Journal',
     'A themed notebook and journal with decorative pages for writing, notes, and creative activities.',
     27.50, 100, 6, 12, 'BOOK', 'FLAT_RECT', 'PREMIUM', 'POP_FANTASY', true),

    -- 7. Pop Fantasy 2B Pencil  ¥31.85/60 → ¥1.00  minAge=6 (specified)
    --    DB unit = ONE pencil (package qty 60 = 5 boxes × 12).
    ('STATIONERY-KPOP-PENCIL-001',
     'Pop Fantasy 2B Pencil',
     'A themed 2B pencil with colorful character packaging and artwork.',
     1.00, 100, 6, 12, 'STATIONERY', 'BAR', 'STANDARD', 'POP_FANTASY', true),

    -- 8. Pop Fantasy Character Badge  ¥22.35/5 → ¥4.50
    ('ACCESSORY-KPOP-BADGE-001',
     'Pop Fantasy Character Badge',
     'A colorful round character badge for backpacks, clothing, and pencil cases.',
     4.50, 100, 3, 12, 'ACCESSORY', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true),

    -- 9. Pop Fantasy Push Pen  ¥14.79/6 → ¥2.50  minAge=6 (specified)
    ('PEN-KPOP-PUSH-001',
     'Pop Fantasy Push Pen',
     'A character-themed click pen designed as a practical and collectible stationery favor.',
     2.50, 100, 6, 12, 'STATIONERY', 'BAR', 'STANDARD', 'POP_FANTASY', true),

    -- 10. Acrylic Character Pen  ¥22.77/6 → ¥4.00  minAge=6 (specified)
    ('PEN-KPOP-ACRYLIC-001',
     'Acrylic Character Pen',
     'A character-themed pen featuring a decorative acrylic topper.',
     4.00, 100, 6, 12, 'STATIONERY', 'BAR', 'STANDARD', 'POP_FANTASY', true),

    -- 11. Pop Fantasy Character Brooch  ¥3.20/1 → ¥3.50
    ('ACCESSORY-KPOP-BROOCH-001',
     'Pop Fantasy Character Brooch',
     'A decorative character brooch for backpacks, clothing, or accessory collections.',
     3.50, 100, 3, 12, 'ACCESSORY', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true),

    -- 12. Pop Fantasy Dress-Up Sticker Set  ¥24.44/5 → ¥5.00  minAge=6 (specified)
    --     DB unit = ONE complete 8-sheet set.
    ('ACTIVITY-KPOP-DRESSUP-001',
     'Pop Fantasy Dress-Up Sticker Set',
     'An eight-sheet character dress-up sticker activity set with outfits, hairstyles, and accessories.',
     5.00, 100, 6, 12, 'ACTIVITY', 'FLAT_RECT', 'STANDARD', 'POP_FANTASY', true);

-- ── Interest Affinities ───────────────────────────────────────────────────────

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100)) AS v(i, w)
WHERE sku = 'TOY-FLEX-SWORD-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('TOYS_PLAY', 100), ('CUTE_MAGICAL', 55)) AS v(i, w)
WHERE sku = 'TOY-DRAGON-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('CUTE_MAGICAL', 95), ('TOYS_PLAY', 35)) AS v(i, w)
WHERE sku = 'ACCESSORY-CAT-CHARM-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 55)) AS v(i, w)
WHERE sku = 'NOVELTY-KPOP-TATTOO-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('TOYS_PLAY', 90), ('CUTE_MAGICAL', 65)) AS v(i, w)
WHERE sku = 'TOY-KPOP-FIGURE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('READING_PUZZLE', 50), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'BOOK-KPOP-JOURNAL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('READING_PUZZLE', 40)) AS v(i, w)
WHERE sku = 'STATIONERY-KPOP-PENCIL-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'ACCESSORY-KPOP-BADGE-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('READING_PUZZLE', 30)) AS v(i, w)
WHERE sku = 'PEN-KPOP-PUSH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 45)) AS v(i, w)
WHERE sku = 'PEN-KPOP-ACRYLIC-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 50)) AS v(i, w)
WHERE sku = 'ACCESSORY-KPOP-BROOCH-001';

INSERT INTO product_interest_affinity (product_id, interest, weight)
SELECT id, i, w FROM product
CROSS JOIN (VALUES ('POP_MUSIC', 100), ('CUTE_MAGICAL', 80), ('TOYS_PLAY', 45)) AS v(i, w)
WHERE sku = 'ACTIVITY-KPOP-DRESSUP-001';

-- ── Audience Affinities ───────────────────────────────────────────────────────

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('UNIVERSAL', 100), ('MASCULINE', 40)) AS v(a, w)
WHERE sku = 'TOY-FLEX-SWORD-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, 'UNIVERSAL', 100 FROM product WHERE sku = 'TOY-DRAGON-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 70), ('UNIVERSAL', 55)) AS v(a, w)
WHERE sku = 'ACCESSORY-CAT-CHARM-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'NOVELTY-KPOP-TATTOO-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'TOY-KPOP-FIGURE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'BOOK-KPOP-JOURNAL-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 75), ('UNIVERSAL', 50)) AS v(a, w)
WHERE sku = 'STATIONERY-KPOP-PENCIL-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'ACCESSORY-KPOP-BADGE-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'PEN-KPOP-PUSH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'PEN-KPOP-ACRYLIC-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 80), ('UNIVERSAL', 45)) AS v(a, w)
WHERE sku = 'ACCESSORY-KPOP-BROOCH-001';

INSERT INTO product_audience_affinity (product_id, audience, weight)
SELECT id, a, w FROM product
CROSS JOIN (VALUES ('FEMININE', 85), ('UNIVERSAL', 40)) AS v(a, w)
WHERE sku = 'ACTIVITY-KPOP-DRESSUP-001';

-- ── Occasions ─────────────────────────────────────────────────────────────────

-- Both occasions
INSERT INTO product_occasion (product_id, occasion)
SELECT p.id, o.occasion FROM product p
CROSS JOIN (VALUES ('CELEBRATION'), ('HALLOWEEN')) AS o(occasion)
WHERE p.sku IN (
    'TOY-FLEX-SWORD-001', 'TOY-DRAGON-001', 'ACCESSORY-CAT-CHARM-001',
    'NOVELTY-KPOP-TATTOO-001', 'TOY-KPOP-FIGURE-001', 'STATIONERY-KPOP-PENCIL-001',
    'ACCESSORY-KPOP-BADGE-001', 'PEN-KPOP-PUSH-001', 'PEN-KPOP-ACRYLIC-001',
    'ACCESSORY-KPOP-BROOCH-001', 'ACTIVITY-KPOP-DRESSUP-001'
);

-- CELEBRATION only
INSERT INTO product_occasion (product_id, occasion)
SELECT id, 'CELEBRATION' FROM product
WHERE sku = 'BOOK-KPOP-JOURNAL-001';

-- ── Role Affinities ───────────────────────────────────────────────────────────

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 90), ('SIMPLE_TOY', 80), ('NOVELTY', 70)) AS v(r, w)
WHERE sku = 'TOY-FLEX-SWORD-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('PLAY', 100), ('TACTILE', 95), ('COLLECTIBLE', 75), ('NOVELTY', 65)) AS v(r, w)
WHERE sku = 'TOY-DRAGON-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 95), ('NOVELTY', 75), ('WEARABLE', 55)) AS v(r, w)
WHERE sku = 'ACCESSORY-CAT-CHARM-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('NOVELTY', 100), ('ACTIVITY', 45)) AS v(r, w)
WHERE sku = 'NOVELTY-KPOP-TATTOO-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('COLLECTIBLE', 100), ('PLAY', 95), ('PREMIUM', 100), ('NOVELTY', 75)) AS v(r, w)
WHERE sku = 'TOY-KPOP-FIGURE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('ACTIVITY', 85), ('READING', 65), ('PREMIUM', 100)) AS v(r, w)
WHERE sku = 'BOOK-KPOP-JOURNAL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('ACTIVITY', 50)) AS v(r, w)
WHERE sku = 'STATIONERY-KPOP-PENCIL-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 95), ('NOVELTY', 65)) AS v(r, w)
WHERE sku = 'ACCESSORY-KPOP-BADGE-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('COLLECTIBLE', 55), ('NOVELTY', 45)) AS v(r, w)
WHERE sku = 'PEN-KPOP-PUSH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('UTILITY', 100), ('COLLECTIBLE', 75), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'PEN-KPOP-ACRYLIC-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('WEARABLE', 100), ('COLLECTIBLE', 95), ('NOVELTY', 60)) AS v(r, w)
WHERE sku = 'ACCESSORY-KPOP-BROOCH-001';

INSERT INTO product_role_affinity (product_id, role, weight)
SELECT id, r, w FROM product
CROSS JOIN (VALUES ('ACTIVITY', 100), ('PLAY', 70), ('NOVELTY', 55)) AS v(r, w)
WHERE sku = 'ACTIVITY-KPOP-DRESSUP-001';
