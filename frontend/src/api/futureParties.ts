/**
 * Public API client for future party lead-capture submissions.
 *
 * POST /api/future-parties — submit a future party registration.
 *
 * Requirements: AC3.1, AC2.7, AC2.8
 * Design: specs/future-party/design.md §4.2
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface FuturePartySubmission {
  email:     string
  partyDate: string          // YYYY-MM-DD
  kidGender: 'BOY' | 'GIRL' | 'MIXED'
  kidAge:    number
}

export interface FuturePartyResponse {
  id:                   number
  email:                string
  partyDate:            string
  kidGender:            string
  kidAge:               number
  submittedAt:          string
  linkedBundlePublicId: string | null
  bundleSentAt:         string | null
}

/**
 * Submit a future party registration.
 * Throws on non-2xx responses so the caller can display an error.
 */
export async function submitFutureParty(data: FuturePartySubmission): Promise<FuturePartyResponse> {
  const res = await fetch(`${BASE_URL}/api/future-parties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<FuturePartyResponse>
}
