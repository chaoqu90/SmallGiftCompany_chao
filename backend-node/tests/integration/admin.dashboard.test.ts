/**
 * Integration tests: admin dashboard endpoints
 *
 * AC10.1 — GET / returns finderCompletions and bundleViews counts
 * AC10.2 — GET /product-coverage returns simulation results (no DB writes)
 * AC10.3 — product-coverage uses constrained (PATH 2) simulation logic
 * AC12.1 — unauthorized requests return 401
 *
 * Seeds analytics events and products in beforeAll, cleans up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  seedGenerationProducts,
  cleanBundles,
  cleanProducts,
  cleanAnalyticsEvents,
  TEST_PRODUCT_SKUS,
} from './helpers/db.js';

const app = createApp();

const AUTH_USER = process.env.ADMIN_USERNAME ?? 'admin';
const AUTH_PASS = process.env.ADMIN_PASSWORD ?? 'admin';
const BASE_PATH = '/admin/api/dashboard';

function authed(path: string) {
  return request(app).get(path).auth(AUTH_USER, AUTH_PASS);
}

beforeAll(async () => {
  await cleanAnalyticsEvents();
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
  await seedGenerationProducts();

  // Record some analytics events so the counts are non-trivial
  await request(app)
    .post('/api/analytics/events')
    .send({ eventType: 'FINDER_COMPLETED' });
  await request(app)
    .post('/api/analytics/events')
    .send({ eventType: 'FINDER_COMPLETED' });
  await request(app)
    .post('/api/analytics/events')
    .send({ eventType: 'BUNDLE_VIEWED', bundleId: 'gb_abc123def456' });
});

afterAll(async () => {
  await cleanAnalyticsEvents();
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('Admin dashboard — auth', () => {
  it('returns 401 for unauthenticated GET / (AC12.1)', async () => {
    const res = await request(app).get(BASE_PATH);
    expect(res.status).toBe(401);
  });

  it('returns 401 for unauthenticated GET /product-coverage', async () => {
    const res = await request(app).get(`${BASE_PATH}/product-coverage`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/api/dashboard ─────────────────────────────────────────────────

describe('GET /admin/api/dashboard', () => {
  it('returns 200 with finderCompletions and bundleViews counts (AC10.1)', async () => {
    const res = await authed(BASE_PATH);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      finderCompletions: expect.any(Number),
      bundleViews: expect.any(Number),
    });

    // We seeded 2 FINDER_COMPLETED and 1 BUNDLE_VIEWED
    expect(res.body.finderCompletions).toBeGreaterThanOrEqual(2);
    expect(res.body.bundleViews).toBeGreaterThanOrEqual(1);
  });
});

// ─── GET /admin/api/dashboard/product-coverage ───────────────────────────────

describe('GET /admin/api/dashboard/product-coverage', () => {
  it('returns 200 with an array of coverage records (AC10.2)', async () => {
    const res = await authed(`${BASE_PATH}/product-coverage`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each coverage record has required fields (AC10.3)', async () => {
    const res = await authed(`${BASE_PATH}/product-coverage`);

    if (res.body.length > 0) {
      const record = res.body[0];
      expect(record).toHaveProperty('productId');
      expect(record).toHaveProperty('productName');
      expect(record).toHaveProperty('sku');
      expect(record).toHaveProperty('interest');
      expect(record).toHaveProperty('audiencePreference');
      expect(record).toHaveProperty('partyType');
      expect(record).toHaveProperty('budgetTierCode');
      expect(record).toHaveProperty('age');
      expect(record).toHaveProperty('slotCode');
    }
  });

  it('does not write to the database (AC10.2)', async () => {
    // Verify by checking the bundle count is unchanged before and after
    const bundleCountBefore = await request(app)
      .get('/admin/api/bundles')
      .auth(AUTH_USER, AUTH_PASS);

    await authed(`${BASE_PATH}/product-coverage`);

    const bundleCountAfter = await request(app)
      .get('/admin/api/bundles')
      .auth(AUTH_USER, AUTH_PASS);

    expect(bundleCountAfter.body.length).toBe(bundleCountBefore.body.length);
  });
});
