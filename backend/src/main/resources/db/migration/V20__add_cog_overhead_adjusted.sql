-- V20: Add cog_overhead and cog_adjusted columns to product; recalculate retail_price.
--
-- Column semantics:
--   cost          = COG/raw     (existing, unchanged)
--   cog_overhead  = COG/overhead (new; set to 0 for all existing products — update per product later)
--   cog_adjusted  = COG/adjusted = cost + cog_overhead
--
-- Retail price formula (in USD):
--   cog_adjusted < 4  → retail_price = ROUND(cog_adjusted / 2,   2)
--   cog_adjusted >= 4 → retail_price = ROUND(cog_adjusted / 2.5, 2)

ALTER TABLE product
    ADD COLUMN cog_overhead NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN cog_adjusted NUMERIC(10, 2);

-- cog_adjusted = cost + cog_overhead
UPDATE product
SET cog_adjusted = cost + cog_overhead;

ALTER TABLE product
    ALTER COLUMN cog_adjusted SET NOT NULL;

-- Recalculate retail_price using new formula based on cog_adjusted
UPDATE product
SET retail_price = CASE
    WHEN cog_adjusted < 4 THEN ROUND(cog_adjusted / 2,   2)
    ELSE                       ROUND(cog_adjusted / 2.5, 2)
END;
