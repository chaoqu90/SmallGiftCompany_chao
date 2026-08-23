INSERT INTO product (sku, name, description, unit_cost, inventory_quantity)
VALUES
    ('STICKER-001', 'Unicorn Sticker Pack',   'Pack of 12 unicorn stickers',      0.75, 500),
    ('CRAYON-001',  'Mini Crayon Set',         '8-colour mini crayon set',         1.20, 300),
    ('PUTTY-001',   'Rainbow Silly Putty',     'Stretchy rainbow-coloured putty',  0.90, 400);

INSERT INTO bundle (name, description, base_price, image_url, active)
VALUES
    ('Rainbow Fun Pack',
     'Stickers, crayons, and putty — perfect for ages 4-8.',
     8.99,
     '/images/bundles/rainbow-fun-pack.jpg',
     true),
    ('Sticker Blast',
     'Double the stickers for sticker-obsessed kids.',
     5.99,
     '/images/bundles/sticker-blast.jpg',
     true),
    ('Discontinued Pack',
     'Old bundle no longer sold.',
     4.99,
     null,
     false);

INSERT INTO bundle_item (bundle_id, product_id, quantity_per_bundle)
SELECT b.id, p.id, 1
FROM   bundle b, product p
WHERE  b.name = 'Rainbow Fun Pack'
  AND  p.sku IN ('STICKER-001', 'CRAYON-001', 'PUTTY-001');

INSERT INTO bundle_item (bundle_id, product_id, quantity_per_bundle)
SELECT b.id, p.id, 2
FROM   bundle b, product p
WHERE  b.name = 'Sticker Blast'
  AND  p.sku = 'STICKER-001';

INSERT INTO bundle_tag (bundle_id, tag)
SELECT id, tag
FROM   bundle
CROSS JOIN (VALUES ('age:6-8'), ('interest:creative'), ('interest:animals'), ('party:birthday')) AS t(tag)
WHERE  name = 'Rainbow Fun Pack';

INSERT INTO bundle_tag (bundle_id, tag)
SELECT id, tag
FROM   bundle
CROSS JOIN (VALUES ('age:6-8'), ('interest:creative'), ('party:birthday'), ('party:halloween')) AS t(tag)
WHERE  name = 'Sticker Blast';
