/**
 * JWT verification middleware — Supabase Auth (HS256).
 *
 * Reads SUPABASE_JWT_SECRET from process.env at module initialisation (fail
 * fast on cold start, mirroring the pattern in db.ts).
 *
 * On every request:
 *   1. Extracts the Bearer token from the Authorization header.
 *   2. Verifies the token with jose jwtVerify (HS256).
 *   3. On success → sets req.user = { id, email } and calls next().
 *   4. On any failure → returns HTTP 401 RFC 7807 ProblemDetail.
 *
 * Requirements: R7 (AC7.1 – AC7.5)
 */
import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

// ── Fail fast: SUPABASE_JWT_SECRET must be present at cold start ─────────────
if (!process.env.SUPABASE_JWT_SECRET) {
  throw new Error('SUPABASE_JWT_SECRET environment variable is required.');
}

const secretKey = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

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
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    req.user = {
      id:    payload.sub as string,
      email: payload.email as string,
    };

    next();
  } catch {
    sendUnauthorized(res, req, 'Token is invalid or has expired.');
  }
}
