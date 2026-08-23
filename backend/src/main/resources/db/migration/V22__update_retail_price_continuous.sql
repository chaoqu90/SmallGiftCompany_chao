-- V22: Update retail_price to continuous pricing formula.
--
-- Formula (in USD):
--   cog_adjusted <  1  → retail_price = 0.50                          (flat floor)
--   cog_adjusted <  4  → retail_price = ROUND(cog_adjusted / 2,    2) (½ cog)
--   cog_adjusted < 10  → retail_price = ROUND(cog_adjusted / 3 + 2.0/3, 2) (linear ramp)
--   cog_adjusted >= 10 → retail_price = ROUND(cog_adjusted * 0.4,  2) (scale)
--
-- Continuity check:
--   At ¥1:  0.50 = 1/2               ✓
--   At ¥4:  4/3 + 2/3 = 2.00 = 4/2  ✓
--   At ¥10: 10/3 + 2/3 = 4.00 = 10×0.4 ✓

UPDATE product
SET retail_price = CASE
    WHEN cog_adjusted < 1  THEN 0.50
    WHEN cog_adjusted < 4  THEN ROUND(cog_adjusted / 2,              2)
    WHEN cog_adjusted < 10 THEN ROUND(cog_adjusted / 3.0 + 2.0 / 3, 2)
    ELSE                        ROUND(cog_adjusted * 0.4,            2)
END;
