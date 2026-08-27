/**
 * Integration tests: POST /api/analytics/events
 *
 * AC6.1 — accepts and records analytics events
 * AC6.2 — eventType is required and non-blank
 * AC6.3 — bundleId stored as-is (no FK check)
 * AC6.5 — returns 201 with no body on success
 * AC11.2 — Zod validation failures map to 400 about:validation-error
 *
 * Cleans up analytics_event table in beforeAll and afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { cleanAnalyticsEvents } from './helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await cleanAnalyticsEvents();
});

afterAll(async () => {
  await cleanAnalyticsEvents();
});

describe('POST /api/analytics/events', () => {
  it('returns 201 with no body for a minimal valid event (AC6.5)', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ eventType: 'FINDER_COMPLETED' });

    expect(res.status).toBe(201);
    // Body should be empty
    expect(res.text).toBe('');
  });

  it('accepts optional fields: bundleId, sessionId, metadataJson (AC6.1)', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({
        eventType: 'BUNDLE_VIEWED',
        bundleId: 'gb_abc123def456',
        sessionId: 'sess_xyz',
        metadataJson: '{"source":"finder"}',
      });

    expect(res.status).toBe(201);
  });

  it('accepts a non-FK bundleId string (survivability — AC6.3)', async () => {
    // bundleId is VARCHAR with no FK constraint — any string is accepted
    const res = await request(app)
      .post('/api/analytics/events')
      .send({
        eventType: 'BUNDLE_VIEWED',
        bundleId: 'gb_doesnotexist',
      });

    expect(res.status).toBe(201);
  });

  it('returns 400 ProblemDetail when eventType is missing (AC6.2)', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ sessionId: 'sess_abc' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });

  it('returns 400 ProblemDetail when eventType is blank (AC6.2)', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ eventType: '' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: 'about:validation-error',
      status: 400,
    });
  });
});
