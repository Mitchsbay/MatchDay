import { NextRequest, NextResponse } from "next/server";
import { assessFixtureWeather } from "../../../../lib/weatherClient";
import { verifyRequestSession } from "../../../../lib/serverAuth";

// Called from the client for the fixtures currently loaded in the user's own
// workspace — not a cron job. advancedEvidence lives inside each user's
// workspace payload (see supabase/schema.sql), so there's no server-side
// table of fixtures a background job could safely bulk-update; the client
// fetches assessments here, then writes them into its own workspace state
// the same way any other advanced-evidence edit happens.

type WeatherAssessRequestItem = {
  fixtureId: string;
  venueCity: string;
  venueCountry?: string;
  kickoffUtc: string;
};

const MAX_BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  if (!(await verifyRequestSession(req))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { fixtures?: WeatherAssessRequestItem[] };
  const items = Array.isArray(body.fixtures) ? body.fixtures : [];

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "No fixtures provided." }, { status: 400 });
  }
  if (items.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { ok: false, error: `Too many fixtures in one request (max ${MAX_BATCH_SIZE}).` },
      { status: 400 },
    );
  }

  const invalid = items.filter((item) => !item.fixtureId || !item.venueCity || !item.kickoffUtc);
  if (invalid.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Every fixture needs fixtureId, venueCity, and kickoffUtc." },
      { status: 400 },
    );
  }

  // Sequential rather than Promise.all: Open-Meteo's free tier has no hard
  // documented per-second cap the way football-data.org does, but there's no
  // upside to hammering it with 50 parallel requests from one batch either.
  const results: Array<{ fixtureId: string; assessment: Awaited<ReturnType<typeof assessFixtureWeather>> }> = [];
  for (const item of items) {
    const assessment = await assessFixtureWeather({
      venueCity: item.venueCity,
      venueCountry: item.venueCountry,
      kickoffUtc: item.kickoffUtc,
    });
    results.push({ fixtureId: item.fixtureId, assessment });
  }

  return NextResponse.json({ ok: true, results });
}
