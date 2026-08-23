-- Phase 2 — align tag vocabulary with the UX spec (A_PLAYFUL_BOUTIQUE.md).
-- Age bands: 0-3/4-8 → 3-5/6-8 (spec uses 3–5, 6–8, 9–12).
-- Interests: art/crafts/science/outdoor → creative/animals (spec vocabulary).

-- 1. Age range alignment
UPDATE bundle_tag SET tag = 'age:3-5' WHERE tag = 'age:0-3';
UPDATE bundle_tag SET tag = 'age:6-8' WHERE tag = 'age:4-8';
-- age:9-12 is unchanged

-- 2. Consolidate old fine-grained interest tags into spec vocabulary
--    Remove tags being replaced first to avoid PK conflicts on the rename step.
DELETE FROM bundle_tag WHERE tag IN ('interest:art', 'interest:science', 'interest:outdoor');
--    Rename crafts → creative (Rainbow Fun Pack had this tag).
UPDATE bundle_tag SET tag = 'interest:creative' WHERE tag = 'interest:crafts';
--    Any active bundle that lost all its interest tags (Sticker Blast had only 'art')
--    gets interest:creative so it still appears in interest searches.
INSERT INTO bundle_tag (bundle_id, tag)
SELECT b.id, 'interest:creative'
FROM   bundle b
WHERE  b.active = true
  AND  NOT EXISTS (
      SELECT 1 FROM bundle_tag bt
      WHERE bt.bundle_id = b.id AND bt.tag LIKE 'interest:%'
  );

-- 3. Give Rainbow Fun Pack the 'animals' interest to differentiate it from Sticker Blast.
INSERT INTO bundle_tag (bundle_id, tag)
SELECT b.id, 'interest:animals'
FROM   bundle b
WHERE  b.name = 'Rainbow Fun Pack'
  AND  NOT EXISTS (
      SELECT 1 FROM bundle_tag bt
      WHERE bt.bundle_id = b.id AND bt.tag = 'interest:animals'
  );
