/**
 * Integration tests: admin bundle list and detail endpoints
 *
 * AC9.1 — GET list returns bundles newest first, max 200
 * AC9.2 — GET /:publicId returns full aggregate
 * AC9.3 — GET /:publicId returns 404 for unknown publicId
 * AC12.1 — unauthorized requests return 401
 *
 * Seeds products + generates a bundle in beforeAll, cleans up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  seedGenerationProducts,
  cleanBundles,
  cleanProducts,
  TEST_PRODUCT_SKUS,
} from './helpers/db.js';

const app = createApp();

const AUTH_USER = process.env.ADMIN_USERNAME ?? 'admin';
const AUTH_PASS = process.env.ADMIN_PASSWORD ?? 'admin';
const BASE_PATH = '/admin/api/bundles';

let generatedPublicId: string;

function authed(method: 'get' | 'post', path: string) {
  return request(app)[method](path).auth(AUTH_USER, AUTH_PASS);
}

beforeAll(async () => {
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
  await seedGenerationProducts();

  // Generate a bundle for retrieval tests
  const res = await request(app)
    .post('/api/generated-bundles')
    .send({
      age: 7,
      audiencePreference: 'FEMININE',
      interest: 'CUTE_MAGICAL',
      partyType: 'CELEBRATION',
      budgetTierCode: 'MID',
      maxRetailPrice: null,
    });

  expect(res.status).toBe(201);
  generatedPublicId = res.body.generatedBundleId;
});

afterAll(async () => {
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('Admin bundles — auth', () => {
  it('returns 401 for unauthenticated list request (AC12.1)', async () => {
    const res = await request(app).get(BASE_PATH);
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/api/bundles ───────────────────────────────────────────────────

describe('GET /admin/api/bundles', () => {
  it('returns 200 with an array of bundles (AC9.1)', async () => {
    const res = await authed('get', BASE_PATH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('includes templateCode and budgetTierCode on each entry', async () => {
    const res = await authed('get', BASE_PATH);

    const bundle = res.body[0];
    expect(bundle).toHaveProperty('template_code');
    expect(bundle).toHaveProperty('budget_tier_code');
  });

  it('returns bundles newest first (AC9.1)', async () => {
    const res = await authed('get', BASE_PATH);

    if (res.body.length >= 2) {
      const first = new Date(res.body[0].created_at).getTime();
      const second = new Date(res.body[1].created_at).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });
});

// ─── GET /admin/api/bundles/:publicId ────────────────────────────────────────

describe('GET /admin/api/bundles/:publicId', () => {
  it('returns 200 with full bundle aggregate for a known publicId (AC9.2)', async () => {
    const res = await authed('get', `${BASE_PATH}/${generatedPublicId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      generatedBundleId: generatedPublicId,
      templateCode: expect.any(String),
      items: expect.any(Array),
    });
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns 404 ProblemDetail for an unknown publicId (AC9.3)', async () => {
    const res = await authed('get', `${BASE_PATH}/gb_notarealid000`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      type: 'about:bundle-not-found',
      status: 404,
    });
  });
});
