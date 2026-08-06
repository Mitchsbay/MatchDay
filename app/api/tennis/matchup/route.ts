import { NextRequest, NextResponse } from "next/server";
import {
  fetchTennisRecentForm,
  fetchTennisServeStats,
  fetchTennisSurfaceWinRate,
  fetchTennisHeadToHead,
} from "../../../../lib/tennisDataClient";
import { verifyRequestSession } from "../../../../lib/serverAuth";
import {
  calculateQualityFromRanking,
  calculateFormFromRecentResults,
  calculateServeGap,
  calculateSurfaceGap,
  calculateHeadToHeadGap,
  runTennisPrediction,
  emptyTennisManualFactors,
  type TennisManualFactors,
  type TennisPlayerSummary,
  type TennisServeStats,
  type TennisTour,
} from "../../../../lib/tennisScoringEngine";

export async function POST(req: NextRequest) {
  if (!(await verifyRequestSession(req))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

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
      // Which court surface this matchup is being played on. Omit or leave
      // empty to skip the Surface Gate entirely (it stays neutral).
      surface?: string;
    };

    if (!body.playerA || !body.playerB) {
      return NextResponse.json({ ok: false, error: "Both playerA and playerB are required." }, { status: 400 });
    }

    const tour: TennisTour = body.tour === "wta" ? "wta" : "atp";
    const manual: TennisManualFactors = { ...emptyTennisManualFactors, ...body.manual };
    const playerA = body.playerA;
    const playerB = body.playerB;
    const surfaceName = body.surface?.trim();

    // Rank/points already came from the rankings list the dropdown loaded —
    // no need to re-fetch a player profile just for that. Form, serve, and
    // surface each need two calls; H2H needs only one (it's inherently
    // pairwise, not per-player). Up to 7 requests per prediction when a
    // surface is specified (~7 predictions/day), or 5 without one — still
    // comfortably inside the 50/day free quota.
    const [
      playerARecentForm,
      playerBRecentForm,
      fetchedServeStatsA,
      fetchedServeStatsB,
      surfaceRecordA,
      surfaceRecordB,
      headToHeadRecord,
    ] = await Promise.all([
      fetchTennisRecentForm(tour, playerA.id),
      fetchTennisRecentForm(tour, playerB.id),
      body.serveStatsA ? Promise.resolve(null) : fetchTennisServeStats(tour, playerA.id),
      body.serveStatsB ? Promise.resolve(null) : fetchTennisServeStats(tour, playerB.id),
      surfaceName ? fetchTennisSurfaceWinRate(tour, playerA.id, surfaceName) : Promise.resolve(null),
      surfaceName ? fetchTennisSurfaceWinRate(tour, playerB.id, surfaceName) : Promise.resolve(null),
      fetchTennisHeadToHead(tour, playerA.id, playerB.id),
    ]);

    const serveStatsA = body.serveStatsA ?? fetchedServeStatsA;
    const serveStatsB = body.serveStatsB ?? fetchedServeStatsB;

    const quality = calculateQualityFromRanking(playerA, playerB);
    const form = calculateFormFromRecentResults(playerA.name, playerB.name, playerARecentForm, playerBRecentForm);
    const serve = calculateServeGap(playerA.name, playerB.name, serveStatsA, serveStatsB);
    const surface = surfaceName
      ? calculateSurfaceGap(playerA.name, playerB.name, surfaceRecordA, surfaceRecordB, surfaceName)
      : null;
    const headToHead = calculateHeadToHeadGap(playerA.name, playerB.name, headToHeadRecord);
    const prediction = runTennisPrediction(
      playerA.name,
      playerB.name,
      quality,
      form,
      manual,
      serve,
      surface,
      headToHead,
    );

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
      surface,
      headToHead,
      prediction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
