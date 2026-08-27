/**
 * postgres.js singleton — initialized at module scope so it is reused across
 * warm Lambda invocations. Never move this inside a handler function.
 *
 * prepare: false is REQUIRED for Supavisor transaction mode (port 6543).
 * Supavisor does not support PostgreSQL prepared statements.
 */
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
    'Set it to the Supabase transaction mode connection string (port 6543).'
  );
}

export const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,       // Required: Supavisor transaction mode does not support prepared statements
  max: 5,               // Conservative pool size for Lambda concurrency
  idle_timeout: 20,     // Seconds before idle connections are closed
  connect_timeout: 10,  // Seconds to wait for a connection before throwing
});
