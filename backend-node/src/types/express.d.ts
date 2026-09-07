/**
 * Express Request type augmentation.
 *
 * Adds the `user` property to Express.Request so TypeScript recognises
 * req.user after the jwtAuth middleware has run.
 *
 * This file is picked up automatically by TypeScript via tsconfig.json's
 * `include: ["src/**/*"]` glob — no import needed anywhere.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
declare namespace Express {
  interface Request {
    user?: {
      /** Supabase user UUID — taken from the JWT `sub` claim. */
      id: string;
      /** User email address — taken from the JWT `email` claim. */
      email: string;
    };
  }
}
