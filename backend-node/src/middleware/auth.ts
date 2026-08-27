/**
 * HTTP Basic authentication middleware for admin endpoints.
 *
 * Applied at the router level in each admin route file (not globally).
 * Public endpoints (/api/**) are not affected.
 *
 * AC7.1: All /admin/api/** endpoints require valid HTTP Basic credentials.
 * AC7.2: Uses timingSafeEqual (constant-time comparison) to prevent timing attacks.
 *
 * Mirrors Spring Boot SecurityConfig HTTP Basic filter chain.
 */
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

/**
 * Compares two strings in constant time to prevent timing oracle attacks.
 * Pads both strings to a fixed length before comparison.
 */
function timingSafeCompare(a: string, b: string): boolean {
  // Use a fixed 256-byte buffer to prevent length-based timing differences
  const bufA = Buffer.alloc(256, 0);
  const bufB = Buffer.alloc(256, 0);
  bufA.write(a ?? '');
  bufB.write(b ?? '');
  return timingSafeEqual(bufA, bufB);
}

function unauthorizedResponse(res: Response, path: string): Response {
  return res.status(401)
    .set('WWW-Authenticate', 'Basic realm="Admin"')
    .json({
      type: 'about:unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Valid HTTP Basic credentials are required for this endpoint.',
      instance: path,
    });
}

/**
 * Express middleware that enforces HTTP Basic authentication.
 * Must be applied at the router level for all admin routers.
 */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? '';

  if (!authHeader.startsWith('Basic ')) {
    unauthorizedResponse(res, req.path);
    return;
  }

  let username: string;
  let password: string;

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      unauthorizedResponse(res, req.path);
      return;
    }
    username = decoded.slice(0, colonIndex);
    password = decoded.slice(colonIndex + 1);
  } catch {
    unauthorizedResponse(res, req.path);
    return;
  }

  const usernameMatch = timingSafeCompare(username, ADMIN_USERNAME);
  const passwordMatch = timingSafeCompare(password, ADMIN_PASSWORD);

  if (!usernameMatch || !passwordMatch) {
    unauthorizedResponse(res, req.path);
    return;
  }

  next();
}
