-- V19: Add retail_price column to product.
--
-- Pricing formula (for now — may be revised later):
--   cost < 4  → retail_price = cost          (treat ¥ value directly as $)
--   cost >= 4 → retail_price = ROUND(cost/7, 2) (convert ¥ to $ at ~7:1 rate)
--
-- This retail_price is used to:
--   1. Compute bundle retail price = sum of item retail prices
--   2. Compute upgrade delta = premium.retail_price − standard.retail_price

ALTER TABLE product
    ADD COLUMN retail_price NUMERIC(10, 2);

UPDATE product
SET retail_price = CASE
    WHEN cost < 4 THEN cost
    ELSE ROUND(cost / 7, 2)
END;

ALTER TABLE product
    ALTER COLUMN retail_price SET NOT NULL;
