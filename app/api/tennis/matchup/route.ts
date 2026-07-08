import { NextRequest, NextResponse } from "next/server";
import { fetchTennisRecentForm } from "../../../../lib/tennisDataClient";
import {
  calculateQualityFromRanking,
  calculateFormFromRecentResults,
  runTennisPrediction,
  emptyTennisManualFactors,
  type TennisManualFactors,
  type TennisPlayerSummary,
  type TennisTour,
} from "../../../../lib/tennisScoringEngine";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tour?: string;
      playerA?: TennisPlayerSummary;
      playerB?: TennisPlayerSummary;
      manual?: Partial<TennisManualFactors>;
    };

    if (!body.playerA || !body.playerB) {
      return NextResponse.json({ ok: false, error: "Both playerA and playerB are required." }, { status: 400 });
    }

    const tour: TennisTour = body.tour === "wta" ? "wta" : "atp";
    const manual: TennisManualFactors = { ...emptyTennisManualFactors, ...body.manual };
    const playerA = body.playerA;
    const playerB = body.playerB;

    // Rank/points already came from the rankings list the dropdown loaded —
    // no need to re-fetch a player profile just for that. Only recent form
    // needs its own call, keeping this at 2 requests per prediction instead
    // of 4, which matters on a 50-requests/day free quota.
    const [playerARecentForm, playerBRecentForm] = await Promise.all([
      fetchTennisRecentForm(tour, playerA.id),
      fetchTennisRecentForm(tour, playerB.id),
    ]);

    const quality = calculateQualityFromRanking(playerA, playerB);
    const form = calculateFormFromRecentResults(playerA.name, playerB.name, playerARecentForm, playerBRecentForm);
    const prediction = runTennisPrediction(playerA.name, playerB.name, quality, form, manual);

    return NextResponse.json({
      ok: true,
      tour,
      playerA,
      playerB,
      playerARecentForm,
      playerBRecentForm,
      quality,
      form,
      prediction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
