import { NextRequest, NextResponse } from "next/server";
import { fetchTennisRecentForm, fetchTennisServeStats } from "../../../../lib/tennisDataClient";
import {
  calculateQualityFromRanking,
  calculateFormFromRecentResults,
  calculateServeGap,
  runTennisPrediction,
  emptyTennisManualFactors,
  type TennisManualFactors,
  type TennisPlayerSummary,
  type TennisServeStats,
  type TennisTour,
} from "../../../../lib/tennisScoringEngine";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tour?: string;
      playerA?: TennisPlayerSummary;
      playerB?: TennisPlayerSummary;
      manual?: Partial<TennisManualFactors>;
      // Optional manual override — if provided, takes precedence over the
      // automatic fetch below (e.g. if you have fresher or surface-specific
      // numbers from elsewhere). Leave unset to use the automatic fetch.
      serveStatsA?: TennisServeStats;
      serveStatsB?: TennisServeStats;
    };

    if (!body.playerA || !body.playerB) {
      return NextResponse.json({ ok: false, error: "Both playerA and playerB are required." }, { status: 400 });
    }

    const tour: TennisTour = body.tour === "wta" ? "wta" : "atp";
    const manual: TennisManualFactors = { ...emptyTennisManualFactors, ...body.manual };
    const playerA = body.playerA;
    const playerB = body.playerB;

    // Rank/points already came from the rankings list the dropdown loaded —
    // no need to re-fetch a player profile just for that. Form and serve
    // stats each need their own call: 4 requests per prediction total,
    // comfortably inside the 50/day free quota (~12 predictions/day).
    const [playerARecentForm, playerBRecentForm, fetchedServeStatsA, fetchedServeStatsB] = await Promise.all([
      fetchTennisRecentForm(tour, playerA.id),
      fetchTennisRecentForm(tour, playerB.id),
      body.serveStatsA ? Promise.resolve(null) : fetchTennisServeStats(tour, playerA.id),
      body.serveStatsB ? Promise.resolve(null) : fetchTennisServeStats(tour, playerB.id),
    ]);

    const serveStatsA = body.serveStatsA ?? fetchedServeStatsA;
    const serveStatsB = body.serveStatsB ?? fetchedServeStatsB;

    const quality = calculateQualityFromRanking(playerA, playerB);
    const form = calculateFormFromRecentResults(playerA.name, playerB.name, playerARecentForm, playerBRecentForm);
    const serve = calculateServeGap(playerA.name, playerB.name, serveStatsA, serveStatsB);
    const prediction = runTennisPrediction(playerA.name, playerB.name, quality, form, manual, serve);

    return NextResponse.json({
      ok: true,
      tour,
      playerA,
      playerB,
      playerARecentForm,
      playerBRecentForm,
      quality,
      form,
      serve,
      prediction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
