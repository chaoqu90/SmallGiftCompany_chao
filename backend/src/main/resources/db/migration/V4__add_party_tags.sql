-- Phase 2 — add party-type tags to seed bundles.
-- V3 is already applied to existing databases; new tags go in a separate migration.

INSERT INTO bundle_tag (bundle_id, tag)
SELECT id, 'party:birthday'
FROM   bundle
WHERE  name = 'Rainbow Fun Pack';

INSERT INTO bundle_tag (bundle_id, tag)
SELECT id, tag
FROM   bundle
CROSS JOIN (VALUES ('party:birthday'), ('party:halloween')) AS t(tag)
WHERE  name = 'Sticker Blast';
