/**
 * Analytics service — event recording and dashboard counts.
 *
 * R6: Record analytics events (AC6.1–AC6.5)
 * R10: Dashboard counts (AC10.1)
 */
import type { EventCaptureRequest } from '../types/dtos.js';
import * as analyticsRepo from '../repositories/analytics.js';

/**
 * Validates and records an analytics event.
 */
export async function recordEvent(data: EventCaptureRequest): Promise<void> {
  await analyticsRepo.recordEvent({
    eventType: data.eventType,
    sessionId: data.sessionId ?? null,
    bundleId: data.bundleId ?? null,
    metadataJson: data.metadataJson ?? null,
  });
}

/**
 * Returns the dashboard analytics counts (AC10.1).
 */
export async function getDashboardCounts(): Promise<{
  finderCompletions: number;
  bundleViews: number;
}> {
  const [finderCompletions, bundleViews] = await Promise.all([
    analyticsRepo.countByEventType('FINDER_COMPLETED'),
    analyticsRepo.countByEventType('BUNDLE_VIEWED'),
  ]);

  return { finderCompletions, bundleViews };
}
