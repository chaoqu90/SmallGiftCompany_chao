-- V21: Add sub-¥1 pricing tier to retail_price calculation.
--
-- Updated retail price formula (in USD):
--   cog_adjusted < 1  → retail_price = cog_adjusted        (1:1, e.g. ¥0.50 → $0.50)
--   cog_adjusted < 4  → retail_price = ROUND(cog_adjusted / 2,   2)
--   cog_adjusted >= 4 → retail_price = ROUND(cog_adjusted / 2.5, 2)

UPDATE product
SET retail_price = CASE
    WHEN cog_adjusted < 1 THEN cog_adjusted
    WHEN cog_adjusted < 4 THEN ROUND(cog_adjusted / 2,   2)
    ELSE                       ROUND(cog_adjusted / 2.5, 2)
END;
