import { NextRequest, NextResponse } from "next/server";
import { suggestMissingPlayersForTeam } from "../../../../lib/apiFootballClient";
import { verifyRequestSession } from "../../../../lib/serverAuth";

// Called from the client for a single active fixture — this is a per-fixture
// "help me fill this in" action, not a bulk background job, so there's no
// batching concern like the weather route has.

function currentSeasonStartYear(): number {
  // API-Football indexes European domestic seasons by their start year (a
  // 2025-26 season is "season=2025"). Seasons typically start in July/August,
  // so before July we're still in the previous start-year's season.
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestSession(req))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { homeTeam?: string; awayTeam?: string; season?: number };
  if (!body.homeTeam || !body.awayTeam) {
    return NextResponse.json({ ok: false, error: "homeTeam and awayTeam are required." }, { status: 400 });
  }

  const season = body.season ?? currentSeasonStartYear();

  try {
    const [home, away] = await Promise.all([
      suggestMissingPlayersForTeam(body.homeTeam, season),
      suggestMissingPlayersForTeam(body.awayTeam, season),
    ]);

    return NextResponse.json({
      ok: true,
      home: home.suggestions,
      away: away.suggestions,
      warnings: [home.warning, away.warning].filter((w): w is string => Boolean(w)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching availability suggestions.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
