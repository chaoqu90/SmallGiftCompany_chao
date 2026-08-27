/**
 * Integration test global setup.
 * Verifies DATABASE_URL is set before any integration test runs.
 * Vitest will fail with a clear message rather than a cryptic connection error.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'Integration tests require DATABASE_URL to be set.\n' +
    'Copy .env.example to .env and fill in your Supabase connection string,\n' +
    'then run: DATABASE_URL=<url> npm run test:integration'
  );
}
