/**
 * Express app factory.
 *
 * This file has NO Lambda-specific imports. It is imported by both:
 *   - src/server.ts  (local dev — calls listen(8080))
 *   - src/lambda.ts  (Lambda — wrapped with serverless-http)
 *
 * Route handlers are imported here. Admin routers apply basicAuth middleware
 * internally at the router level.
 *
 * The errorHandler MUST be the last middleware registered (AC11.1–AC11.5).
 */
import express from 'express';
import cors from 'cors';
import { corsOptions } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';

// Public routers
import { healthRouter } from './routes/health.js';
import { generatedBundlesRouter } from './routes/generatedBundles.js';
import { analyticsRouter } from './routes/analytics.js';

// Admin routers (auth middleware applied inside each admin router)
import { adminProductsRouter } from './routes/admin/products.js';
import { adminBundlesRouter } from './routes/admin/bundles.js';
import { adminDashboardRouter } from './routes/admin/dashboard.js';

export function createApp() {
  const app = express();

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(cors(corsOptions));
  app.use(express.json());

  // ── Public routes ────────────────────────────────────────────────────────
  app.use('/api', healthRouter);
  app.use('/api/generated-bundles', generatedBundlesRouter);
  app.use('/api/analytics', analyticsRouter);

  // ── Admin routes (auth enforced inside each router) ──────────────────────
  app.use('/admin/api/products', adminProductsRouter);
  app.use('/admin/api/bundles', adminBundlesRouter);
  app.use('/admin/api/dashboard', adminDashboardRouter);

  // ── Error handler (MUST be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
