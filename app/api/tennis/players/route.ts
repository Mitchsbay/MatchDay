import { NextRequest, NextResponse } from "next/server";
import { fetchTennisRankings } from "../../../../lib/tennisDataClient";
import type { TennisTour } from "../../../../lib/tennisScoringEngine";

export async function GET(req: NextRequest) {
  const tourParam = req.nextUrl.searchParams.get("tour");
  const tour: TennisTour = tourParam === "wta" ? "wta" : "atp";

  try {
    const players = await fetchTennisRankings(tour);
    if (players.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No ranking snapshot found in the last few weeks. The ranking data may not be published yet, or the API may be having issues.",
      });
    }
    return NextResponse.json({ ok: true, tour, players });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
