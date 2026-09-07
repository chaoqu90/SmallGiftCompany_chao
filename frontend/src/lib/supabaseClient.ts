/**
 * Supabase JS client singleton.
 *
 * Initialised once at module scope and re-used everywhere. Never call
 * createClient() more than once — it creates duplicate realtime connections.
 *
 * Environment variables are embedded at build time by Vite.
 * For local dev, set them in frontend/.env.local (gitignored).
 * For CI/CD, they are passed as environment variables during `npm run build`.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
