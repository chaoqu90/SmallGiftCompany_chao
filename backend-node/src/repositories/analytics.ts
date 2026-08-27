/**
 * Analytics event repository.
 */
import { sql } from '../db.js';
import type { AnalyticsEventRow } from '../types/entities.js';

/**
 * Inserts an analytics event row.
 * bundle_id is stored as VARCHAR (not FK) — intentional (AC6.3).
 */
export async function recordEvent(data: {
  eventType: string;
  sessionId?: string | null;
  bundleId?: string | null;
  metadataJson?: string | null;
}): Promise<AnalyticsEventRow> {
  const rows = await sql<AnalyticsEventRow[]>`
    INSERT INTO analytics_event (event_type, session_id, bundle_id, metadata_json, created_at)
    VALUES (
      ${data.eventType},
      ${data.sessionId ?? null},
      ${data.bundleId ?? null},
      ${data.metadataJson ?? null},
      now()
    )
    RETURNING *
  `;
  return rows[0];
}

/**
 * Returns the count of events with a given event_type (AC10.1).
 */
export async function countByEventType(eventType: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM analytics_event
    WHERE event_type = ${eventType}
  `;
  return parseInt(rows[0].count, 10);
}
