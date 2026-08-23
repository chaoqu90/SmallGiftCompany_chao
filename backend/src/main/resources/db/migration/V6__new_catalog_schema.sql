-- V6: retire old predefined-bundle tables; expand product; add dynamic generation tables.
-- This is a local dev database. V1-V5 are already applied.

-- 1. Drop old bundle-related tables (dependency order: tags first, items second, bundles last)
DROP TABLE IF EXISTS bundle_tag;
DROP TABLE IF EXISTS bundle_item;
DROP TABLE IF EXISTS bundle;

-- 2. Expand product table
ALTER TABLE product
    RENAME COLUMN unit_cost TO cost;

ALTER TABLE product
    ADD COLUMN min_age          SMALLINT     NOT NULL DEFAULT 3,
    ADD COLUMN max_age          SMALLINT     NOT NULL DEFAULT 12,
    ADD COLUMN category         VARCHAR(30)  NOT NULL DEFAULT 'OTHER',
    ADD COLUMN form_factor      VARCHAR(30)  NOT NULL DEFAULT 'OTHER',
    ADD COLUMN upgrade_tier     VARCHAR(20)  NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN theme_code       VARCHAR(50),
    ADD COLUMN created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ADD COLUMN updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now();

-- 3. Product affinity tables

CREATE TABLE product_interest_affinity (
    product_id  BIGINT       NOT NULL REFERENCES product(id),
    interest    VARCHAR(30)  NOT NULL,
    weight      SMALLINT     NOT NULL CHECK (weight >= 0 AND weight <= 100),
    PRIMARY KEY (product_id, interest)
);

CREATE TABLE product_audience_affinity (
    product_id  BIGINT       NOT NULL REFERENCES product(id),
    audience    VARCHAR(20)  NOT NULL,
    weight      SMALLINT     NOT NULL CHECK (weight >= 0 AND weight <= 100),
    PRIMARY KEY (product_id, audience)
);

CREATE TABLE product_occasion (
    product_id  BIGINT       NOT NULL REFERENCES product(id),
    occasion    VARCHAR(20)  NOT NULL,
    PRIMARY KEY (product_id, occasion)
);

CREATE TABLE product_role_affinity (
    product_id  BIGINT       NOT NULL REFERENCES product(id),
    role        VARCHAR(20)  NOT NULL,
    weight      SMALLINT     NOT NULL CHECK (weight >= 0 AND weight <= 100),
    PRIMARY KEY (product_id, role)
);

-- 4. Budget tier

CREATE TABLE budget_tier (
    id                   BIGSERIAL       PRIMARY KEY,
    code                 VARCHAR(10)     NOT NULL UNIQUE,
    retail_min           NUMERIC(10,2)   NOT NULL,
    retail_max           NUMERIC(10,2)   NOT NULL,
    max_item_cogs        NUMERIC(10,2)   NOT NULL,
    target_retail_price  NUMERIC(10,2)   NOT NULL,
    active               BOOLEAN         NOT NULL DEFAULT true
);

-- 5. Bundle template

CREATE TABLE bundle_template (
    id       BIGSERIAL    PRIMARY KEY,
    code     VARCHAR(30)  NOT NULL UNIQUE,
    name     VARCHAR(100) NOT NULL,
    min_age  SMALLINT     NOT NULL,
    max_age  SMALLINT     NOT NULL,
    active   BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE bundle_template_slot (
    id                  BIGSERIAL    PRIMARY KEY,
    bundle_template_id  BIGINT       NOT NULL REFERENCES bundle_template(id),
    slot_code           VARCHAR(30)  NOT NULL,
    display_order       SMALLINT     NOT NULL,
    required            BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE bundle_template_slot_role (
    slot_id  BIGINT      NOT NULL REFERENCES bundle_template_slot(id),
    role     VARCHAR(20) NOT NULL,
    PRIMARY KEY (slot_id, role)
);

-- 6. Gift bag option

CREATE TABLE gift_bag_option (
    id                       BIGSERIAL      PRIMARY KEY,
    code                     VARCHAR(30)    NOT NULL UNIQUE,
    name                     VARCHAR(100)   NOT NULL,
    description              TEXT,
    cost                     NUMERIC(10,2)  NOT NULL DEFAULT 0,
    retail_price_adjustment  NUMERIC(10,2)  NOT NULL DEFAULT 0,
    active                   BOOLEAN        NOT NULL DEFAULT true,
    is_default               BOOLEAN        NOT NULL DEFAULT false
);

-- 7. Generated bundle snapshot

CREATE TABLE generated_bundle (
    id                          BIGSERIAL      PRIMARY KEY,
    public_id                   VARCHAR(30)    NOT NULL UNIQUE,
    session_id                  VARCHAR(100),
    requested_age               SMALLINT       NOT NULL,
    audience_preference         VARCHAR(20)    NOT NULL,
    interest                    VARCHAR(30)    NOT NULL,
    party_type                  VARCHAR(20)    NOT NULL,
    budget_tier_id              BIGINT         NOT NULL REFERENCES budget_tier(id),
    bundle_template_id          BIGINT         NOT NULL REFERENCES bundle_template(id),
    base_retail_price           NUMERIC(10,2),
    standard_item_cogs_snapshot NUMERIC(10,2)  NOT NULL,
    status                      VARCHAR(20)    NOT NULL DEFAULT 'GENERATED',
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    expires_at                  TIMESTAMPTZ
);

CREATE TABLE generated_bundle_item (
    id                       BIGSERIAL      PRIMARY KEY,
    generated_bundle_id      BIGINT         NOT NULL REFERENCES generated_bundle(id),
    slot_code                VARCHAR(30)    NOT NULL,
    product_id               BIGINT         NOT NULL REFERENCES product(id),
    product_name_snapshot    VARCHAR(100)   NOT NULL,
    sku_snapshot             VARCHAR(50)    NOT NULL,
    cost_snapshot            NUMERIC(10,2)  NOT NULL,
    description_snapshot     TEXT,
    form_factor_snapshot     VARCHAR(30)    NOT NULL,
    quantity_per_bag         SMALLINT       NOT NULL DEFAULT 1,
    display_order            SMALLINT       NOT NULL
);

CREATE TABLE generated_bundle_upgrade (
    id                              BIGSERIAL      PRIMARY KEY,
    generated_bundle_id             BIGINT         NOT NULL UNIQUE REFERENCES generated_bundle(id),
    product_id                      BIGINT         REFERENCES product(id),
    product_name_snapshot           VARCHAR(100),
    sku_snapshot                    VARCHAR(50),
    cost_snapshot                   NUMERIC(10,2),
    retail_price_adjustment_snapshot NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE generated_bundle_gift_bag (
    generated_bundle_id          BIGINT         NOT NULL PRIMARY KEY REFERENCES generated_bundle(id),
    gift_bag_option_id           BIGINT         NOT NULL REFERENCES gift_bag_option(id),
    name_snapshot                VARCHAR(100)   NOT NULL,
    cost_snapshot                NUMERIC(10,2)  NOT NULL,
    retail_price_adjustment_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_default                   BOOLEAN        NOT NULL DEFAULT true
);
