/**
 * CORS middleware configuration.
 *
 * Allowed origin is controlled by the CORS_ALLOWED_ORIGIN environment variable
 * (never wildcard *). All other CORS settings match the Spring Boot SecurityConfig
 * and tech-overview.md §14.
 *
 * AC12.1–AC12.6:
 *   - Access-Control-Allow-Origin: CORS_ALLOWED_ORIGIN (single origin, not wildcard)
 *   - Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 *   - Allowed headers: *
 *   - Allow credentials: false
 *   - Max age: 3600
 */
import type { CorsOptions } from 'cors';

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN;

if (!allowedOrigin) {
  console.warn('[cors] CORS_ALLOWED_ORIGIN is not set — CORS will reject all cross-origin requests');
}

export const corsOptions: CorsOptions = {
  origin: allowedOrigin ?? false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  credentials: false,
  maxAge: 3600,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};
