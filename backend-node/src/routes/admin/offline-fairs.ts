/**
 * Admin offline fair routes — HTTP Basic auth required (applied at router level).
 *
 * POST /admin/api/offline-fairs/import   — upload xlsx, parse, validate, persist
 * GET  /admin/api/offline-fairs          — list all fairs (for dropdown)
 * GET  /admin/api/offline-fairs/:id/analytics — analytics for a specific fair
 *
 * The import endpoint uses multer memory storage. The xlsx file is parsed
 * in-process (no disk writes). The full import is atomic: fair + sale rows +
 * inventory updates all happen inside a single sql.begin() transaction.
 *
 * Design: specs/analytics/design.md §A, §C.1–C.3, §G
 * Requirements: FEAT-006 R-AF-1 through R-AF-5, R-AD-1 through R-AD-3
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { basicAuth } from '../../middleware/auth.js';
import {
  lookupSkuProducts,
  importFair,
  listFairs,
  getFairAnalytics,
  type ImportSaleInput,
  type InventoryUpdate,
} from '../../repositories/offlineFairs.js';

export const adminOfflineFairsRouter = Router();

// Apply Basic auth to every route in this router
adminOfflineFairsRouter.use(basicAuth);

// Multer: memory storage, 5 MB limit (sufficient for fair inventory sheets)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── POST /import ─────────────────────────────────────────────────────────────

/**
 * Import an offline fair from an xlsx file.
 *
 * Multipart fields:
 *   name (string, required) — fair name
 *   date (string ISO 8601, required) — fair date e.g. 2026-09-01
 *   file (binary, required) — .xlsx workbook
 *
 * Processing pipeline:
 *   1. Validate form fields
 *   2. Parse xlsx first sheet; locate sku + remaining_inventory columns
 *   3. Validate all data rows (empty SKU, non-numeric/negative remaining_inventory)
 *   4. Batch-lookup all SKUs against the product table
 *   5. Compute sold_qty; collect anomaly warnings
 *   6. Atomic transaction: INSERT fair + INSERT sale rows + UPDATE inventory
 *   7. Return 201 summary
 *
 * Requirements: R-AF-1 through R-AF-5
 */
adminOfflineFairsRouter.post(
  '/import',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // ── Step 1: Validate form fields ────────────────────────────────────────
      const name = (req.body?.name ?? '').trim();
      const date = (req.body?.date ?? '').trim();

      if (!name || !date) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [
            ...(!name ? [{ row: null, message: 'Fair name is required.' }] : []),
            ...(!date ? [{ row: null, message: 'Fair date is required.' }] : []),
          ],
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: 'Fair date must be a valid ISO date (YYYY-MM-DD).' }],
        });
        return;
      }

      if (!req.file) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: 'File is required.' }],
        });
        return;
      }

      // ── Step 2: Parse xlsx ──────────────────────────────────────────────────
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: 'The uploaded file contains no sheets.' }],
        });
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      // Parse to array of arrays (header row + data rows)
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        // No data rows (only header or completely empty)
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: 'The uploaded file contains no data rows.' }],
        });
        return;
      }

      // Locate required columns (case-insensitive)
      const headerRow = (rows[0] as string[]).map(h => String(h).toLowerCase().trim());
      const skuColIndex = headerRow.indexOf('sku');
      const remainingColIndex = headerRow.indexOf('remaining_inventory');

      const missingColumns: string[] = [];
      if (skuColIndex === -1) missingColumns.push('sku');
      if (remainingColIndex === -1) missingColumns.push('remaining_inventory');

      if (missingColumns.length > 0) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: `Required columns not found: ${missingColumns.join(', ')}.` }],
        });
        return;
      }

      // ── Step 3: Validate data rows ──────────────────────────────────────────
      const dataRows = rows.slice(1);
      const validationErrors: { row: number; message: string }[] = [];

      interface ParsedRow {
        rowNumber: number;  // 1-indexed, excluding header
        sku: string;
        remainingInventory: number;
      }

      const parsedRows: ParsedRow[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowNum = i + 1;

        const rawSku = String(row[skuColIndex] ?? '').trim();
        const rawRemaining = row[remainingColIndex];

        // Skip fully empty rows silently (blank trailing rows in Excel)
        if (rawSku === '' && (rawRemaining === '' || rawRemaining === null || rawRemaining === undefined)) {
          continue;
        }

        if (rawSku === '') {
          validationErrors.push({ row: rowNum, message: 'SKU is empty.' });
          continue;
        }

        const remaining = Number(rawRemaining);
        if (rawRemaining === '' || rawRemaining === null || rawRemaining === undefined || !Number.isInteger(remaining) || remaining < 0) {
          validationErrors.push({ row: rowNum, message: 'remaining_inventory must be a non-negative integer.' });
          continue;
        }

        parsedRows.push({ rowNumber: rowNum, sku: rawSku, remainingInventory: remaining });
      }

      if (validationErrors.length > 0) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: validationErrors,
        });
        return;
      }

      if (parsedRows.length === 0) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: [{ row: null, message: 'The uploaded file contains no data rows.' }],
        });
        return;
      }

      // ── Step 4: Batch SKU lookup ────────────────────────────────────────────
      const skus = parsedRows.map(r => r.sku);
      const productMap = await lookupSkuProducts(skus);

      const skuErrors: { row: number; message: string }[] = [];
      for (const pr of parsedRows) {
        if (!productMap.has(pr.sku)) {
          skuErrors.push({ row: pr.rowNumber, message: `SKU '${pr.sku}' not found in product catalog.` });
        }
      }

      if (skuErrors.length > 0) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Import Validation Failed',
          status: 422,
          errors: skuErrors,
        });
        return;
      }

      // ── Step 5: Compute sold_qty; collect warnings ──────────────────────────
      const saleRows: ImportSaleInput[] = [];
      const inventoryUpdates: InventoryUpdate[] = [];
      const warnings: string[] = [];

      for (const pr of parsedRows) {
        const product = productMap.get(pr.sku)!;
        const currentQty = product.inventory_quantity;
        const soldQty = currentQty - pr.remainingInventory;

        if (soldQty < 0) {
          // Anomaly: remaining > current inventory — warn, skip sale row, skip inventory update
          warnings.push(
            `SKU '${pr.sku}': remaining_inventory (${pr.remainingInventory}) exceeds current inventory (${currentQty}). Sold quantity set to 0; inventory not changed for this SKU.`,
          );
          // Do NOT add to inventoryUpdates
        } else {
          // Normal: update inventory regardless of soldQty (even if 0)
          inventoryUpdates.push({ productId: product.id, newQty: pr.remainingInventory });

          if (soldQty > 0) {
            const unitPrice = Number(product.retail_price);
            saleRows.push({
              productId: product.id,
              skuSnapshot: product.sku,
              productNameSnapshot: product.name,
              unitPrice,
              quantitySold: soldQty,
              lineTotal: unitPrice * soldQty,
            });
          }
        }
      }

      // ── Step 6: Atomic transaction ──────────────────────────────────────────
      const result = await importFair(name, date, saleRows, inventoryUpdates, warnings, parsedRows.length);

      // ── Step 7: Return 201 summary ──────────────────────────────────────────
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ────────────────────────────────────────────────────────────────────

/**
 * List all offline fairs, ordered by fair_date DESC.
 * Used to populate the dropdown in the admin dashboard.
 *
 * Requirements: R-AD-1
 * Design: §C.2
 */
adminOfflineFairsRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fairs = await listFairs();
      res.json(fairs);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:id/analytics ───────────────────────────────────────────────────────

/**
 * Returns analytics for a single fair (metrics + top-5 lists).
 *
 * HTTP 404 when the fair ID is not found.
 *
 * Requirements: R-AD-2, R-AD-3
 * Design: §C.3
 */
adminOfflineFairsRouter.get(
  '/:id/analytics',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'Fair ID must be a number.',
          instance: req.path,
        });
        return;
      }

      const analytics = await getFairAnalytics(id);
      if (!analytics) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Fair not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      res.json(analytics);
    } catch (err) {
      next(err);
    }
  },
);
