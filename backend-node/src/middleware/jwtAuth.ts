/**
 * JWT verification middleware — Supabase Auth (RS256 via JWKS).
 *
 * Supabase has migrated from HS256 (legacy shared secret) to RS256 (asymmetric
 * signing keys). Tokens are now verified using Supabase's public JWKS endpoint
 * instead of the legacy JWT secret.
 *
 * JWKS URL: https://<project>.supabase.co/auth/v1/.well-known/jwks.json
 * SUPABASE_URL env var is used to construct the JWKS URL — must be set.
 *
 * On every request:
 *   1. Extracts the Bearer token from the Authorization header.
 *   2. Verifies the token via JWKS (RS256 / ES256).
 *   3. On success → sets req.user = { id, email } and calls next().
 *   4. On any failure → returns HTTP 401 RFC 7807 ProblemDetail.
 *
 * Requirements: R7 (AC7.1 – AC7.5)
 */
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required.');
}

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

// ── 401 helper ────────────────────────────────────────────────────────────────
function sendUnauthorized(res: Response, req: Request, detail: string): void {
  res.status(401).json({
    type: 'about:unauthorized',
    title: 'Unauthorized',
    status: 401,
    detail,
    instance: req.path,
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────
export async function jwtAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendUnauthorized(res, req, 'Authorization header with Bearer token is required.');
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = {
      id:    payload.sub as string,
      email: payload.email as string,
    };

    next();
  } catch {
    sendUnauthorized(res, req, 'Token is invalid or has expired.');
  }
}
