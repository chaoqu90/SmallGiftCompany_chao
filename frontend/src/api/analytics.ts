const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

interface AnalyticsEventPayload {
  eventType: string
  bundleId?: string | null
  sessionId?: string | null
  metadataJson?: string | null
}

export async function trackEvent(payload: AnalyticsEventPayload): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // intentionally swallowed — analytics must never break the user experience
  }
}
