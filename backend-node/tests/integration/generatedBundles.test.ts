/**
 * Integration tests: POST /api/generated-bundles and GET /api/generated-bundles/:publicId
 *
 * AC4.1  — POST returns 201 with GeneratedBundleResponse shape
 * AC4.2  — missing/invalid fields return 400 ProblemDetail
 * AC4.12 — persisted as immutable snapshot
 * AC5.1  — GET returns 200 with bundle data
 * AC5.2  — GET returns 404 ProblemDetail for unknown publicId
 * AC11.2 — Zod validation failures map to 400 about:validation-error
 * AC11.3 — BundleGenerationError maps to 422 about:bundle-generation-error
 *
 * Seeds four products (one per GENERAL_4_ITEM slot) in beforeAll.
 * Cleans up all test bundles and products in afterAll.
 *
 * Requires DATABASE_URL and seed reference data (migrations 001 + 002).
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

const VALID_REQUEST = {
  age: 7,
  audiencePreference: 'FEMININE',
  interest: 'CUTE_MAGICAL',
  partyType: 'CELEBRATION',
  budgetTierCode: 'MID',
  maxRetailPrice: null,
};

beforeAll(async () => {
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
  await seedGenerationProducts();
});

afterAll(async () => {
  await cleanBundles();
  await cleanProducts(TEST_PRODUCT_SKUS);
});

// ─── POST /api/generated-bundles ─────────────────────────────────────────────

describe('POST /api/generated-bundles', () => {
  it('returns 201 with correct GeneratedBundleResponse shape', async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send(VALID_REQUEST);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      generatedBundleId: expect.stringMatching(/^gb_[a-f0-9]{12}$/),
      templateCode: 'GENERAL_4_ITEM',
      standardItemCogsSnapshot: expect.any(Number),
      bundleRetailPrice: expect.any(Number),
      items: expect.arrayContaining([
        expect.objectContaining({
          slotCode: expect.any(String),
          productName: expect.any(String),
          sku: expect.any(String),
          formFactor: expect.any(String),
          quantityPerBag: expect.any(Number),
          displayOrder: expect.any(Number),
        }),
      ]),
    });
    expect(res.body.items).toHaveLength(4);
  });

  it('returns 400 ProblemDetail when age is missing', async () => {
    const { age: _age, ...bodyWithoutAge } = VALID_REQUEST;
    const res = await request(app)
      .post('/api/generated-bundles')
      .send(bodyWithoutAge);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });

  it('returns 400 ProblemDetail when age is out of range', async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send({ ...VALID_REQUEST, age: 2 }); // below minimum of 3

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });

  it('returns 400 ProblemDetail when audiencePreference is invalid enum', async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send({ ...VALID_REQUEST, audiencePreference: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });

  it('returns 400 ProblemDetail when interest is invalid enum', async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send({ ...VALID_REQUEST, interest: 'UNKNOWN_INTEREST' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });

  it('returns 422 with BUDGET_TIER_NOT_FOUND when tier does not exist', async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send({ ...VALID_REQUEST, budgetTierCode: 'NONEXISTENT' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      type: 'about:bundle-generation-error',
      status: 422,
      failureCode: 'BUDGET_TIER_NOT_FOUND',
    });
  });

  it('returns 422 with NO_ELIGIBLE_PRODUCTS when no products match the request', async () => {
    // HALLOWEEN party type: none of our test products have HALLOWEEN occasion
    const res = await request(app)
      .post('/api/generated-bundles')
      .send({ ...VALID_REQUEST, partyType: 'HALLOWEEN' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      type: 'about:bundle-generation-error',
      status: 422,
      failureCode: expect.stringMatching(/^(NO_ELIGIBLE_PRODUCTS|INSUFFICIENT_ROLE_COVERAGE)$/),
    });
  });

  it('persists the bundle so it can be retrieved by publicId (AC4.12)', async () => {
    const postRes = await request(app)
      .post('/api/generated-bundles')
      .send(VALID_REQUEST);

    expect(postRes.status).toBe(201);

    const publicId: string = postRes.body.generatedBundleId;
    const getRes = await request(app).get(`/api/generated-bundles/${publicId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.generatedBundleId).toBe(publicId);
  });
});

// ─── GET /api/generated-bundles/:publicId ────────────────────────────────────

describe('GET /api/generated-bundles/:publicId', () => {
  let createdPublicId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/generated-bundles')
      .send(VALID_REQUEST);
    createdPublicId = res.body.generatedBundleId;
  });

  it('returns 200 with full bundle detail for a known publicId (AC5.1)', async () => {
    const res = await request(app).get(`/api/generated-bundles/${createdPublicId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      generatedBundleId: createdPublicId,
      templateCode: expect.any(String),
      items: expect.any(Array),
    });
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns 404 ProblemDetail for an unknown publicId (AC5.2)', async () => {
    const res = await request(app).get('/api/generated-bundles/gb_notarealid000');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      type: 'about:bundle-not-found',
      status: 404,
    });
  });
});
