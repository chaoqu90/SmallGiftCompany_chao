/**
 * Integration test: GET /api/health
 *
 * AC3.1 — health endpoint returns 200 with { status: 'UP' }
 * AC3.3 — responds within 500 ms
 *
 * Requires DATABASE_URL to be set (checked by setup.ts).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with status UP', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP' });
  });

  it('responds within 500 ms', async () => {
    const start = Date.now();
    await request(app).get('/api/health');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
