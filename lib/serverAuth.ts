import { createClient } from "@supabase/supabase-js";

// Used by API routes that cost real per-request quota (tennis predictions
// hit a metered 50-requests/day external API) to make sure a request is
// actually coming from the authorized admin, not just anyone who finds the
// deployed URL, completes Google OAuth with their own account, or curls the
// route directly. This is a genuine server-side check, not just hiding the
// button in the UI — the UI-level sign-in gate alone wouldn't stop someone
// who bypasses the browser entirely, and OAuth alone doesn't restrict *who*
// can complete it, only that *some* real account did.
export async function verifyRequestSession(req: Request): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();

  // If Supabase isn't configured at all, there's no authentication mechanism
  // available anywhere in the app yet — fail open here to match the
  // client-side gate's same fallback, rather than bricking every tennis
  // route with literally no way for anyone (including the owner) to ever
  // authenticate.
  if (!url || !anonKey) return true;

  // Supabase IS configured but no admin has been designated yet — fail
  // closed. Letting any signed-in account through here would defeat the
  // single-admin model this check exists to enforce.
  if (!adminEmail) return false;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return false;

  return data.user.email.trim().toLowerCase() === adminEmail;
}
