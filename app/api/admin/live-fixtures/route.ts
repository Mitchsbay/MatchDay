import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "../../../../lib/supabaseServerClient";
import {
  DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
  cleanupOldLiveFixtures,
  getLiveFixtureMaintenanceSummary,
} from "../../../../lib/liveFixtureMaintenance";
import {
  DEFAULT_LIVE_FIXTURE_COMPETITION,
  DEFAULT_LIVE_FIXTURE_DAYS_AHEAD,
  syncLiveFixtures,
} from "../../../../lib/liveFixtureSync";

export const maxDuration = 300;

type AdminAction = "status" | "refresh" | "cleanup" | "refresh-and-cleanup";

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

  try {
    const retentionDays = positiveInteger(
      req.nextUrl.searchParams.get("retentionDays"),
      DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
    );
    const supabase = getSupabaseServiceRoleClient();
    const status = await getLiveFixtureMaintenanceSummary(supabase, retentionDays);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: AdminAction;
      competition?: string;
      daysAhead?: number;
      retentionDays?: number;
    };

    const action = body.action ?? "status";
    const competition = body.competition || DEFAULT_LIVE_FIXTURE_COMPETITION;
    const daysAhead = Number.isFinite(body.daysAhead) && Number(body.daysAhead) > 0
      ? Math.floor(Number(body.daysAhead))
      : DEFAULT_LIVE_FIXTURE_DAYS_AHEAD;
    const retentionDays = Number.isFinite(body.retentionDays) && Number(body.retentionDays) > 0
      ? Math.floor(Number(body.retentionDays))
      : DEFAULT_LIVE_FIXTURE_RETENTION_DAYS;

    const supabase = getSupabaseServiceRoleClient();
    const response: Record<string, unknown> = { ok: true, action };

    if (action === "refresh" || action === "refresh-and-cleanup") {
      response.refresh = await syncLiveFixtures(competition, daysAhead);
    }

    if (action === "cleanup" || action === "refresh-and-cleanup") {
      response.cleanup = await cleanupOldLiveFixtures(supabase, retentionDays);
    }

    response.status = await getLiveFixtureMaintenanceSummary(supabase, retentionDays);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
