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

// User routers (FEAT-001 — Supabase JWT auth applied inside the router)
import { userProfileRouter } from './routes/user/profile.js';

// Cart & Order routers (FEAT-002)
import { userCartRouter }    from './routes/user/cart.js';
import { userOrdersRouter }  from './routes/user/orders.js';
import { adminOrdersRouter } from './routes/admin/orders.js';
import { giftBagOptionsRouter } from './routes/giftBagOptions.js';

// Payment routers (FEAT-003)
import { checkoutRouter } from './routes/checkout.js';
import { webhookRouter }  from './routes/webhooks.js';

// Future Party routers (FEAT-004)
import { futurePartiesRouter }      from './routes/futureParties.js';
import { adminFuturePartiesRouter } from './routes/admin/futureParties.js';

export function createApp() {
  const app = express();

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(cors(corsOptions));

  // ── Stripe webhook — MUST be before express.json() (needs raw body) ─────
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

  app.use(express.json());

  // ── Public routes ────────────────────────────────────────────────────────
  app.use('/api', healthRouter);
  app.use('/api/generated-bundles', generatedBundlesRouter);
  app.use('/api/analytics', analyticsRouter);

  // ── Admin routes (auth enforced inside each router) ──────────────────────
  app.use('/admin/api/products', adminProductsRouter);
  app.use('/admin/api/bundles', adminBundlesRouter);
  app.use('/admin/api/dashboard', adminDashboardRouter);

  // ── User routes (FEAT-001 — JWT auth enforced inside router) ─────────────
  app.use('/api/user/profile', userProfileRouter);

  // ── Cart & Order routes (FEAT-002) ────────────────────────────────────────
  app.use('/api/cart',               userCartRouter);
  app.use('/api/orders',             userOrdersRouter);
  app.use('/api/gift-bag-options',   giftBagOptionsRouter);
  app.use('/admin/api/orders',       adminOrdersRouter);

  // ── Payment routes (FEAT-003) ─────────────────────────────────────────────
  app.use('/api/checkout', checkoutRouter);

  // ── Future Party routes (FEAT-004) ────────────────────────────────────────
  app.use('/api/future-parties',       futurePartiesRouter);       // public — no auth (AC7.1, AC7.3)
  app.use('/admin/api/future-parties', adminFuturePartiesRouter);  // basicAuth inside router (AC7.2, AC7.3)

  // ── Error handler (MUST be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
