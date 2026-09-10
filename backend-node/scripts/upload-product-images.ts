/**
 * upload-product-images.ts
 *
 * Uploads product images from product_image/ to S3 and saves the public URL
 * into the product.image_url column.
 *
 * Matching rule:
 *   The image filename (without extension) must match a product SKU
 *   (case-insensitive). Supported extensions: jpg, jpeg, png, gif, webp.
 *
 * Upload key: product-images/<SKU>.<ext>
 * Public URL:  https://<bucket>.s3.amazonaws.com/product-images/<SKU>.<ext>
 *
 * Skip conditions:
 *   - No matching SKU found in the DB
 *   - Product already has an image_url set
 *
 * Dry-run by default — pass --force to actually upload and update.
 *
 * Usage (from backend-node/):
 *   npm run upload-images          # dry run
 *   npm run upload-images:force    # upload + update DB
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import postgres from 'postgres';

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR  = path.resolve(__dirname, '../../product_image');

// ── CLI flags ─────────────────────────────────────────────────────────────────

const force = process.argv.includes('--force');

// ── Validate env ──────────────────────────────────────────────────────────────

const BUCKET = process.env.PRODUCT_IMAGES_BUCKET;
if (!BUCKET) {
  console.error('PRODUCT_IMAGES_BUCKET environment variable is required.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────

const s3  = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function mimeType(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png')  return 'image/png';
  if (ext === 'gif')  return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nUpload product images — mode: ${force ? 'UPLOAD + UPDATE DB' : 'DRY RUN'}\n`);
  console.log(`Image dir: ${IMAGE_DIR}`);
  console.log(`S3 bucket: ${BUCKET}\n`);

  // ── Read image files ───────────────────────────────────────────────────────

  if (!fs.existsSync(IMAGE_DIR)) {
    console.error(`Image directory not found: ${IMAGE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGE_DIR);

  // ── Fetch all products from DB ─────────────────────────────────────────────

  const products = await sql<{ id: number; sku: string; image_url: string | null }[]>`
    SELECT id, sku, image_url FROM product
  `;

  // Build a SKU → product map (uppercase for case-insensitive match)
  const skuMap = new Map(products.map(p => [p.sku.toUpperCase(), p]));

  // ── Plan work ──────────────────────────────────────────────────────────────

  let skipped_ext       = 0;
  let skipped_no_match  = 0;
  let skipped_has_image = 0;

  const toUpload: {
    filePath:  string;
    filename:  string;
    sku:       string;
    productId: number;
    ext:       string;
    s3Key:     string;
    publicUrl: string;
  }[] = [];

  for (const filename of files) {
    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx === -1) { skipped_ext++; continue; }

    const ext = filename.slice(dotIdx + 1).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) { skipped_ext++; continue; }

    const sku = filename.slice(0, dotIdx).toUpperCase();
    const product = skuMap.get(sku);

    if (!product) {
      console.log(`  No match — ${filename}`);
      skipped_no_match++;
      continue;
    }

    if (product.image_url) {
      console.log(`  Already has image — [${product.sku}] skipping`);
      skipped_has_image++;
      continue;
    }

    const s3Key    = `product-images/${product.sku}.${ext}`;
    const publicUrl = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

    toUpload.push({
      filePath:  path.join(IMAGE_DIR, filename),
      filename,
      sku:       product.sku,
      productId: product.id,
      ext,
      s3Key,
      publicUrl,
    });
  }

  console.log('');
  console.log(`Skipped — unsupported extension:  ${skipped_ext}`);
  console.log(`Skipped — no matching SKU in DB:  ${skipped_no_match}`);
  console.log(`Skipped — image already set:      ${skipped_has_image}`);
  console.log(`To upload:                        ${toUpload.length}\n`);

  if (toUpload.length === 0) {
    console.log('Nothing to upload.');
    await sql.end();
    return;
  }

  console.log('Images to upload:');
  for (const u of toUpload) {
    console.log(`  [${u.sku}]  ${u.filename}  →  ${u.s3Key}`);
  }
  console.log('');

  if (!force) {
    console.log('Dry run — no changes made.');
    console.log('To upload, re-run with --force:\n');
    console.log('  npm run upload-images:force\n');
    await sql.end();
    return;
  }

  // ── Upload + update ────────────────────────────────────────────────────────

  let uploaded = 0;
  let failed   = 0;

  for (const u of toUpload) {
    try {
      const body = fs.readFileSync(u.filePath);

      await s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         u.s3Key,
        Body:        body,
        ContentType: mimeType(u.ext),
      }));

      await sql`
        UPDATE product
        SET image_url = ${u.publicUrl}
        WHERE id = ${u.productId}
      `;

      console.log(`  ✓ [${u.sku}]  ${u.publicUrl}`);
      uploaded++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ [${u.sku}]  ${msg}`);
    }
  }

  console.log(`\nUploaded: ${uploaded}  Failed: ${failed}`);
  console.log('Done.');
  await sql.end();
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
