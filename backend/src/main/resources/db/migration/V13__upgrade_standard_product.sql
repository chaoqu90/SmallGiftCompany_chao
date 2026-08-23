-- V13: Add standard product to upgrade slot; standard upgrade is the default/included option.
ALTER TABLE generated_bundle_upgrade
    ADD COLUMN standard_product_id               BIGINT        REFERENCES product(id),
    ADD COLUMN standard_product_name_snapshot    VARCHAR(100),
    ADD COLUMN standard_sku_snapshot             VARCHAR(50),
    ADD COLUMN standard_cost_snapshot            NUMERIC(10,2),
    ADD COLUMN standard_retail_adjustment_snapshot NUMERIC(10,2) DEFAULT 0;
