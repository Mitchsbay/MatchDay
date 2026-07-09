import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LIVE_FIXTURE_COMPETITION,
  DEFAULT_LIVE_FIXTURE_DAYS_AHEAD,
  syncLiveFixtures,
} from "../../../../lib/liveFixtureSync";
import { getSupabaseServiceRoleClient } from "../../../../lib/supabaseServerClient";
import { cleanupOldLiveFixtures } from "../../../../lib/liveFixtureMaintenance";

// Sequential per-team recent-form calls can take a couple of minutes on a
// busy matchday, so give this route plenty of runway.
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitionCode = req.nextUrl.searchParams.get("competition") ?? DEFAULT_LIVE_FIXTURE_COMPETITION;
  const daysAhead = positiveInteger(req.nextUrl.searchParams.get("daysAhead"), DEFAULT_LIVE_FIXTURE_DAYS_AHEAD);
  const cleanupRetentionDays = positiveInteger(req.nextUrl.searchParams.get("cleanupRetentionDays"), 14);

  try {
    const refresh = await syncLiveFixtures(competitionCode, daysAhead);
    const cleanup = await cleanupOldLiveFixtures(getSupabaseServiceRoleClient(), cleanupRetentionDays);

    return NextResponse.json({
      ...refresh,
      cleanup,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
