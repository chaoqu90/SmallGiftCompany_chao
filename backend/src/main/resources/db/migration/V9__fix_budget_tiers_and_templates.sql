-- V9: Recalibrate budget tiers and deactivate templates incompatible with V8 products.
--
-- WHY budget tiers changed:
--   V7 test products cost ¥0.30–1.00 each (4-item total ~¥2.00–3.00).
--   V8 real products cost ¥0.50–5.00 each (4-item minimum ~¥4.00).
--   The old max_item_cogs values (2.50 / 4.00 / 5.50) cannot fill 4 slots.
--   New values are calibrated so the greedy algorithm has enough headroom:
--     LOW  (5.50) — fits cheapest 4-item path (0.50+1.00+1.50+0.50 = 3.50, buffer for scoring)
--     MID  (9.00) — fits mid-range selection including mermaid/duck toys
--     HIGH (15.00) — fits all products including the ¥5.00 bookmark
--   Retail price bands are placeholder — owner must validate.
--
-- WHY READING_PUZZLE_4_ITEM is deactivated:
--   That template has a dedicated PUZZLE slot. None of the V8 products carry the PUZZLE role.
--   Setting active=false triggers the existing fallback in BundleTemplateSelector:
--   findByCodeAndActiveTrue("READING_PUZZLE_4_ITEM").orElseGet(→ GENERAL_4_ITEM)
--   so interest=READING_PUZZLE requests still succeed via GENERAL_4_ITEM.
--   Re-activate this template when puzzle products are added.

UPDATE budget_tier
SET max_item_cogs        = 5.50,
    retail_min           = 15.00,
    retail_max           = 25.00,
    target_retail_price  = 20.00
WHERE code = 'LOW';

UPDATE budget_tier
SET max_item_cogs        = 9.00,
    retail_min           = 28.00,
    retail_max           = 45.00,
    target_retail_price  = 36.00
WHERE code = 'MID';

UPDATE budget_tier
SET max_item_cogs        = 15.00,
    retail_min           = 50.00,
    retail_max           = 75.00,
    target_retail_price  = 60.00
WHERE code = 'HIGH';

UPDATE bundle_template
SET active = false
WHERE code = 'READING_PUZZLE_4_ITEM';
