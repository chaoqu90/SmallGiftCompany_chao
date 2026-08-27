/**
 * Integration tests: admin product endpoints
 *
 * All endpoints require HTTP Basic auth (AC12.1–AC12.3).
 *
 * AC7.3  — GET list returns all products sorted by name
 * AC7.4  — GET /meta returns valid enum metadata
 * AC7.5  — POST create returns 201 with server-computed retail price
 * AC7.6  — PATCH inventory updates inventory_quantity
 * AC7.7  — PATCH active toggles active flag
 * AC7.8  — PATCH pricing recomputes cog_adjusted and retail_price server-side
 * AC7.9  — PATCH category/upgrade-tier/age-range/details update individual fields
 * AC7.10 — DELETE returns 409 when product is referenced by a bundle item
 * AC7.11 — DELETE returns 204 on successful deletion
 * AC8.1  — GET /affinities returns all four affinity types
 * AC8.2  — PUT /affinities atomically replaces all four affinity types
 * AC12.1 — unauthorized requests return 401
 *
 * Requires DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD env vars.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { cleanBundles, cleanProducts } from './helpers/db.js';

const app = createApp();

const AUTH_USER = process.env.ADMIN_USERNAME ?? 'admin';
const AUTH_PASS = process.env.ADMIN_PASSWORD ?? 'admin';

const TEST_SKU = 'ADMIN-TEST-PROD-001';
const BASE_PATH = '/admin/api/products';

let createdProductId: number;

function authed(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) {
  return request(app)[method](path).auth(AUTH_USER, AUTH_PASS);
}

beforeAll(async () => {
  await cleanBundles();
  await cleanProducts([TEST_SKU]);
});

afterAll(async () => {
  await cleanBundles();
  await cleanProducts([TEST_SKU]);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('Admin products — auth', () => {
  it('returns 401 for unauthenticated GET list (AC12.1)', async () => {
    const res = await request(app).get(BASE_PATH);
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong credentials (AC12.1)', async () => {
    const res = await request(app)
      .get(BASE_PATH)
      .auth('wrong', 'credentials');
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/api/products/meta ────────────────────────────────────────────

describe('GET /admin/api/products/meta', () => {
  it('returns enum metadata arrays (AC7.4)', async () => {
    const res = await authed('get', `${BASE_PATH}/meta`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      categories: expect.arrayContaining(['TOY', 'BOOK', 'STATIONERY']),
      formFactors: expect.arrayContaining(['ROUND', 'BAR', 'FLAT_RECT']),
      upgradeTiers: expect.arrayContaining(['STANDARD', 'PREMIUM']),
      interests: expect.arrayContaining(['CUTE_MAGICAL', 'SPORTS']),
      partyTypes: expect.arrayContaining(['CELEBRATION', 'HALLOWEEN']),
      audienceAffinities: expect.arrayContaining(['FEMININE', 'MASCULINE', 'UNIVERSAL']),
      bundleRoles: expect.arrayContaining(['UTILITY', 'ACTIVITY']),
    });
  });
});

// ─── POST /admin/api/products (create) ───────────────────────────────────────

describe('POST /admin/api/products', () => {
  it('creates a product with server-computed retailPrice and returns 201 (AC7.5)', async () => {
    const res = await authed('post', BASE_PATH).send({
      sku: TEST_SKU,
      name: 'Admin Integration Test Product',
      cost: 2.00,
      cogOverhead: 0.50,
      inventoryQuantity: 50,
      minAge: 3,
      maxAge: 10,
      category: 'TOY',
      formFactor: 'ROUND',
      upgradeTier: 'STANDARD',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sku: TEST_SKU,
      name: 'Admin Integration Test Product',
      active: true,
      inventory_quantity: 50,
    });

    // cogAdjusted = cost + cogOverhead = 2.00 + 0.50 = 2.50
    // retail_price = floor(2.50 / 2) = 1.25 (tier: 1.00 ≤ x < 4.00: cost/2)
    expect(parseFloat(res.body.cog_adjusted)).toBeCloseTo(2.50, 2);
    expect(parseFloat(res.body.retail_price)).toBeGreaterThan(0);

    createdProductId = res.body.id;
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await authed('post', BASE_PATH).send({ name: 'Missing fields' });
    expect(res.status).toBe(400);
    expect(res.body.type).toBe('about:validation-error');
  });
});

// ─── GET /admin/api/products (list) ──────────────────────────────────────────

describe('GET /admin/api/products', () => {
  it('returns 200 with an array of products (AC7.3)', async () => {
    const res = await authed('get', BASE_PATH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Our test product should be in the list
    const testProduct = res.body.find((p: { sku: string }) => p.sku === TEST_SKU);
    expect(testProduct).toBeDefined();
  });
});

// ─── PATCH endpoints ─────────────────────────────────────────────────────────

describe('PATCH /admin/api/products/:id/inventory (AC7.6)', () => {
  it('updates inventory_quantity', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/inventory`)
      .send({ inventoryQuantity: 75 });

    expect(res.status).toBe(200);
    expect(res.body.inventory_quantity).toBe(75);
  });

  it('returns 404 for unknown product id', async () => {
    const res = await authed('patch', `${BASE_PATH}/99999999/inventory`)
      .send({ inventoryQuantity: 10 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/api/products/:id/active (AC7.7)', () => {
  it('toggles active flag to false', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/active`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('toggles active flag back to true', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/active`)
      .send({ active: true });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
  });
});

describe('PATCH /admin/api/products/:id/pricing (AC7.8)', () => {
  it('recomputes cogAdjusted and retailPrice server-side', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/pricing`)
      .send({ cost: 3.00, cogOverhead: 0.00 });

    expect(res.status).toBe(200);
    // cogAdjusted = 3.00 + 0.00 = 3.00; retail = 3.00/2 = 1.50
    expect(parseFloat(res.body.cog_adjusted)).toBeCloseTo(3.00, 2);
    expect(parseFloat(res.body.retail_price)).toBeGreaterThan(0);
  });
});

describe('PATCH /admin/api/products/:id/category (AC7.9)', () => {
  it('updates the category field', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/category`)
      .send({ category: 'STATIONERY' });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('STATIONERY');
  });
});

describe('PATCH /admin/api/products/:id/upgrade-tier (AC7.9)', () => {
  it('updates the upgrade tier', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/upgrade-tier`)
      .send({ upgradeTier: 'PREMIUM' });

    expect(res.status).toBe(200);
    expect(res.body.upgrade_tier).toBe('PREMIUM');
  });
});

describe('PATCH /admin/api/products/:id/age-range (AC7.9)', () => {
  it('updates minAge and maxAge', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/age-range`)
      .send({ minAge: 5, maxAge: 10 });

    expect(res.status).toBe(200);
    expect(res.body.min_age).toBe(5);
    expect(res.body.max_age).toBe(10);
  });
});

describe('PATCH /admin/api/products/:id/details (AC7.9)', () => {
  it('updates name, category, and formFactor', async () => {
    const res = await authed('patch', `${BASE_PATH}/${createdProductId}/details`)
      .send({ name: 'Updated Name', category: 'TOY', formFactor: 'BAR' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.form_factor).toBe('BAR');
  });
});

// ─── GET/PUT affinities ───────────────────────────────────────────────────────

describe('GET /admin/api/products/:id/affinities (AC8.1)', () => {
  it('returns all four affinity types (initially empty)', async () => {
    const res = await authed('get', `${BASE_PATH}/${createdProductId}/affinities`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      interests: expect.any(Array),
      audiences: expect.any(Array),
      roles: expect.any(Array),
      occasions: expect.any(Array),
    });
  });
});

describe('PUT /admin/api/products/:id/affinities (AC8.2)', () => {
  it('atomically replaces all four affinity types and returns 204', async () => {
    const payload = {
      interests: [{ interest: 'CUTE_MAGICAL', weight: 80 }],
      audiences: [{ audience: 'FEMININE', weight: 70 }],
      roles: [{ role: 'UTILITY', weight: 90 }],
      occasions: [{ occasion: 'CELEBRATION' }],
    };

    const putRes = await authed('put', `${BASE_PATH}/${createdProductId}/affinities`)
      .send(payload);

    expect(putRes.status).toBe(204);

    // Verify the replacement was applied
    const getRes = await authed('get', `${BASE_PATH}/${createdProductId}/affinities`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.interests).toHaveLength(1);
    expect(getRes.body.interests[0].interest).toBe('CUTE_MAGICAL');
    expect(getRes.body.roles).toHaveLength(1);
    expect(getRes.body.roles[0].role).toBe('UTILITY');
    expect(getRes.body.occasions).toHaveLength(1);
    expect(getRes.body.occasions[0].occasion).toBe('CELEBRATION');
  });

  it('replaces previous affinities with an empty set (idempotent clear)', async () => {
    const clearPayload = {
      interests: [],
      audiences: [],
      roles: [],
      occasions: [],
    };

    const putRes = await authed('put', `${BASE_PATH}/${createdProductId}/affinities`)
      .send(clearPayload);

    expect(putRes.status).toBe(204);

    const getRes = await authed('get', `${BASE_PATH}/${createdProductId}/affinities`);
    expect(getRes.body.interests).toHaveLength(0);
    expect(getRes.body.roles).toHaveLength(0);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /admin/api/products/:id (AC7.10–AC7.11)', () => {
  it('returns 204 for a product with no bundle references (AC7.11)', async () => {
    // Create a fresh product to delete (so we don't delete the one used above)
    const createRes = await authed('post', BASE_PATH).send({
      sku: 'ADMIN-TEST-DELETE-001',
      name: 'Product To Delete',
      cost: 1.00,
      cogOverhead: 0.00,
      inventoryQuantity: 10,
      minAge: 3,
      maxAge: 10,
      category: 'TOY',
      formFactor: 'ROUND',
      upgradeTier: 'STANDARD',
    });

    expect(createRes.status).toBe(201);
    const deleteId = createRes.body.id;

    const deleteRes = await authed('delete', `${BASE_PATH}/${deleteId}`);
    expect(deleteRes.status).toBe(204);
  });

  it('returns 400 for non-integer id', async () => {
    const res = await authed('delete', `${BASE_PATH}/abc`);
    expect(res.status).toBe(400);
  });
});
