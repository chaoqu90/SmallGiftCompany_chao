-- Phase 2 — Catalog schema
-- Tables are created empty; placeholder seed data lives in V3.

CREATE TABLE product (
    id                  BIGSERIAL      PRIMARY KEY,
    sku                 VARCHAR(50)    NOT NULL,
    name                VARCHAR(100)   NOT NULL,
    description         TEXT,
    image_url           VARCHAR(500),
    unit_cost           NUMERIC(10, 2) NOT NULL,
    inventory_quantity  INTEGER        NOT NULL DEFAULT 0,
    active              BOOLEAN        NOT NULL DEFAULT true,
    CONSTRAINT product_sku_unique UNIQUE (sku)
);

CREATE TABLE bundle (
    id          BIGSERIAL      PRIMARY KEY,
    name        VARCHAR(100)   NOT NULL,
    description TEXT,
    base_price  NUMERIC(10, 2) NOT NULL,
    image_url   VARCHAR(500),
    active      BOOLEAN        NOT NULL DEFAULT true
);

CREATE TABLE bundle_item (
    id                  BIGSERIAL PRIMARY KEY,
    bundle_id           BIGINT    NOT NULL REFERENCES bundle (id),
    product_id          BIGINT    NOT NULL REFERENCES product (id),
    quantity_per_bundle INTEGER   NOT NULL DEFAULT 1,
    replaceable         BOOLEAN   NOT NULL DEFAULT false
);

CREATE TABLE bundle_tag (
    bundle_id BIGINT      NOT NULL REFERENCES bundle (id),
    tag       VARCHAR(50) NOT NULL,
    PRIMARY KEY (bundle_id, tag)
);

CREATE INDEX idx_bundle_tag_tag ON bundle_tag (tag);
