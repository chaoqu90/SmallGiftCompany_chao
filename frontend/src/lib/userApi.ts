/**
 * Typed fetch wrappers for the /api/user/profile endpoints.
 *
 * Both functions require a Supabase access token (from session.access_token)
 * and send it as a Bearer token. VITE_API_BASE_URL is set at build time.
 *
 * Requirements: R6 (AC6.1–AC6.6)
 */

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export interface ProfileDto {
  userId:      string;
  email:       string;
  displayName: string | null;
  phoneNumber: string | null;
  createdAt:   string | null;
}

/**
 * Fetches the authenticated user's profile.
 * Throws on non-2xx responses.
 */
export async function getProfile(accessToken: string): Promise<ProfileDto> {
  const res = await fetch(`${BASE}/api/user/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json() as Promise<ProfileDto>;
}

/**
 * Updates the authenticated user's profile.
 * Throws on non-2xx responses.
 */
export async function updateProfile(
  accessToken: string,
  body: { displayName?: string | null; phoneNumber?: string | null },
): Promise<ProfileDto> {
  const res = await fetch(`${BASE}/api/user/profile`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json() as Promise<ProfileDto>;
}
