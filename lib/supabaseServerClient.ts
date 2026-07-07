import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service role key so the cron job can write to
// public.live_fixtures, which has no insert/update/delete RLS policy for
// anon/authenticated clients (see supabase/schema.sql).
//
// Never import this from a "use client" component or from lib/supabaseClient.ts
// — the service role key must never reach the browser bundle.
export function getSupabaseServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
