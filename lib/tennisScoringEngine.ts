// Deliberately NOT reusing football's TeamStats/MatchScores/Fixture shapes.
// Tennis has no draws, no teams, no home/away, and no league table — forcing
// it into those types would mean fields like "draws" or "homeAdvantage" that
// don't mean anything here. Same gate *names* and prediction UX as football
// for a consistent mental model; different fields underneath, same as the
// project's own README describes for any future sport.

export type TennisTour = "atp" | "wta";
export type TennisFormResult = "W" | "L";

export type TennisPlayerSummary = {
  id: number;
  name: string;
  countryAcr: string | null;
  currentRank: number | null;
  points: number | null;
};

export type TennisPlayerForm = {
  currentRank: number | null;
  points: number | null;
  recentForm: TennisFormResult[]; // most recent last, same convention as football's homeRecentForm
};

export type TennisManualFactors = {
  headToHeadEdge: number; // manual, same spirit as football's headToHeadEdge — no automated H2H source wired up yet
  otherFactorsEdge: number; // manual catch-all, same spirit as football's otherStatsEdge
};

export const emptyTennisManualFactors: TennisManualFactors = {
  headToHeadEdge: 0,
  otherFactorsEdge: 0,
};

export type TennisQualityResult = {
  qualityGap: number; // positive favours player A, same sign convention as football's qualityGap
  playerAStrength: number;
  playerBStrength: number;
  evidence: string[];
};

export type TennisFormGapResult = {
  formGap: number; // positive favours player A
  playerAFormScore: number;
  playerBFormScore: number;
  evidence: string[];
};

export type TennisPredictionLabel =
  | "Very Strong Player A Win"
  | "Strong Player A Win"
  | "Lean Player A Win"
  | "Too Close to Call"
  | "Lean Player B Win"
  | "Strong Player B Win"
  | "Very Strong Player B Win"
  | "Review Required";

export type TennisPredictionResult = {
  playerAEdge: number;
  confidence: number;
  prediction: TennisPredictionLabel;
  reviewRequired: boolean;
  evidence: string[];
};

// --- Quality Gate: ranking points, not a league table -----------------------
// Ranking points follow a roughly logarithmic quality curve (the gap between
// #1 and #2 matters far more than the gap between #101 and #102), so this
// compares points on a log scale rather than a flat difference or raw ranking
// position, which would badly overweight small moves at the bottom of the
// list.
export function calculateQualityFromRanking(
  playerA: TennisPlayerSummary,
  playerB: TennisPlayerSummary,
): TennisQualityResult {
  const pointsA = Math.max(1, playerA.points ?? 1);
  const pointsB = Math.max(1, playerB.points ?? 1);

  const strengthA = Math.round(Math.log10(pointsA) * 20);
  const strengthB = Math.round(Math.log10(pointsB) * 20);
  const qualityGap = Math.max(-10, Math.min(10, Math.round((strengthA - strengthB) / 2)));

  return {
    qualityGap,
    playerAStrength: strengthA,
    playerBStrength: strengthB,
    evidence: [
      `${playerA.name}: rank ${playerA.currentRank ?? "unranked"}, ${playerA.points ?? 0} points.`,
      `${playerB.name}: rank ${playerB.currentRank ?? "unranked"}, ${playerB.points ?? 0} points.`,
      `Quality gap ${qualityGap >= 0 ? "+" : ""}${qualityGap} (positive favours ${playerA.name}).`,
    ],
  };
}

// --- Form Gate: win rate over recent matches ---------------------------------
// Tennis has no per-game goal difference to weight form by, so this is a
// straightforward recent win rate, converted to the same -10..+10 gap scale
// as the Quality Gate so the two combine sensibly in runTennisPrediction.
export function calculateFormFromRecentResults(
  playerAName: string,
  playerBName: string,
  formA: TennisFormResult[],
  formB: TennisFormResult[],
): TennisFormGapResult {
  const winRate = (form: TennisFormResult[]) =>
    form.length > 0 ? form.filter((result) => result === "W").length / form.length : 0.5;

  const rateA = winRate(formA);
  const rateB = winRate(formB);
  const playerAFormScore = Math.round(rateA * 100);
  const playerBFormScore = Math.round(rateB * 100);
  const formGap = Math.max(-10, Math.min(10, Math.round((rateA - rateB) * 20)));

  return {
    formGap,
    playerAFormScore,
    playerBFormScore,
    evidence: [
      `${playerAName} recent form: ${formA.join("-") || "no recent matches on record"} (${playerAFormScore}/100).`,
      `${playerBName} recent form: ${formB.join("-") || "no recent matches on record"} (${playerBFormScore}/100).`,
      `Form gap ${formGap >= 0 ? "+" : ""}${formGap} (positive favours ${playerAName}).`,
    ],
  };
}

// --- Serve Gate: weighted serve strength --------------------------------
// Unlike a fixed 0.63/0.37 first/second-serve split applied to everyone,
// this weights each player's own first-serve-in rate — a player who lands
// 68% of first serves should have their 1st-serve win rate count for more
// than one who lands 55%, since it reflects how often they actually get to
// use it. This also naturally supports per-surface stats later (grass vs
// clay serve stats plugged into the same function) without any changes here.
export type TennisServeStats = {
  firstServeInPct: number; // 0-100: % of first serves landed in
  firstServeWinPct: number; // 0-100: % of points won when the first serve lands
  secondServeWinPct: number; // 0-100: % of points won on second serve
};

export type TennisServeGapResult = {
  serveGap: number; // -10..+10, positive favours player A
  playerAServeScore: number; // 0-100 weighted serve strength
  playerBServeScore: number;
  evidence: string[];
};

export function calculateServeStrength(stats: TennisServeStats): number {
  const firstServeWeight = Math.max(0, Math.min(1, stats.firstServeInPct / 100));
  return firstServeWeight * stats.firstServeWinPct + (1 - firstServeWeight) * stats.secondServeWinPct;
}

export function calculateServeGap(
  playerAName: string,
  playerBName: string,
  statsA: TennisServeStats | null,
  statsB: TennisServeStats | null,
): TennisServeGapResult {
  if (!statsA || !statsB) {
    return {
      serveGap: 0,
      playerAServeScore: 0,
      playerBServeScore: 0,
      evidence: ["Serve stats not available for one or both players — Serve Gate stays neutral."],
    };
  }

  const scoreA = calculateServeStrength(statsA);
  const scoreB = calculateServeStrength(statsB);
  const serveGap = Math.max(-10, Math.min(10, Math.round((scoreA - scoreB) / 2)));

  return {
    serveGap,
    playerAServeScore: Math.round(scoreA),
    playerBServeScore: Math.round(scoreB),
    evidence: [
      `${playerAName} weighted serve strength: ${Math.round(scoreA)}/100 (1st serve in ${statsA.firstServeInPct}%, 1st-serve win ${statsA.firstServeWinPct}%, 2nd-serve win ${statsA.secondServeWinPct}%).`,
      `${playerBName} weighted serve strength: ${Math.round(scoreB)}/100 (1st serve in ${statsB.firstServeInPct}%, 1st-serve win ${statsB.firstServeWinPct}%, 2nd-serve win ${statsB.secondServeWinPct}%).`,
      `Serve gap ${serveGap >= 0 ? "+" : ""}${serveGap} (positive favours ${playerAName}).`,
    ],
  };
}

// --- Surface Gate: actual win/loss record on the match surface --------------
// A different signal from the Serve Gate — this is real match outcomes on a
// given court surface (hard/clay/grass/etc.), not serve percentages. Recent
// years matter more than a player's game from a decade ago, so this expects
// an already-windowed win/loss count (see SURFACE_HISTORY_YEARS_BACK in
// tennisDataClient.ts) rather than a full career total.
export type TennisSurfaceRecord = { wins: number; losses: number } | null;

export type TennisSurfaceGapResult = {
  surfaceGap: number; // -10..+10, positive favours player A
  playerASurfaceWinRate: number | null; // 0-100, null if no recent matches on this surface
  playerBSurfaceWinRate: number | null;
  evidence: string[];
};

export function calculateSurfaceGap(
  playerAName: string,
  playerBName: string,
  recordA: TennisSurfaceRecord,
  recordB: TennisSurfaceRecord,
  surfaceName: string,
): TennisSurfaceGapResult {
  const winRate = (record: TennisSurfaceRecord) => {
    if (!record) return null;
    const total = record.wins + record.losses;
    return total > 0 ? (record.wins / total) * 100 : null;
  };

  const rateA = winRate(recordA);
  const rateB = winRate(recordB);

  if (rateA === null || rateB === null) {
    return {
      surfaceGap: 0,
      playerASurfaceWinRate: rateA,
      playerBSurfaceWinRate: rateB,
      evidence: [`Not enough recent ${surfaceName} matches for one or both players — Surface Gate stays neutral.`],
    };
  }

  const surfaceGap = Math.max(-10, Math.min(10, Math.round((rateA - rateB) / 10)));

  return {
    surfaceGap,
    playerASurfaceWinRate: Math.round(rateA * 10) / 10,
    playerBSurfaceWinRate: Math.round(rateB * 10) / 10,
    evidence: [
      `${playerAName} recent ${surfaceName} record: ${recordA?.wins}-${recordA?.losses} (${Math.round(rateA)}% win rate).`,
      `${playerBName} recent ${surfaceName} record: ${recordB?.wins}-${recordB?.losses} (${Math.round(rateB)}% win rate).`,
      `Surface gap ${surfaceGap >= 0 ? "+" : ""}${surfaceGap} (positive favours ${playerAName}).`,
    ],
  };
}

// --- Prediction: combine gates, no draw outcome exists -----------------------
// --- Head-to-Head Gate: real pairwise history, not aggregate career stats ---
// Verified against getH2HInfo (not the misleadingly-named getH2HVsAllOppStats,
// which turned out to be one player's career totals vs. the whole field).
// This is genuine two-player history, win/loss by surface, summed across all
// surfaces for an overall record — small samples are typical for H2H, so
// this isn't windowed by recency the way Surface Gate is.
export type TennisHeadToHeadRecord = { playerAWins: number; playerBWins: number } | null;

export type TennisHeadToHeadGapResult = {
  headToHeadGap: number; // -10..+10, positive favours player A
  evidence: string[];
};

export function calculateHeadToHeadGap(
  playerAName: string,
  playerBName: string,
  record: TennisHeadToHeadRecord,
): TennisHeadToHeadGapResult {
  if (!record || record.playerAWins + record.playerBWins === 0) {
    return {
      headToHeadGap: 0,
      evidence: ["No head-to-head history between these two players yet — H2H Gate stays neutral."],
    };
  }

  const total = record.playerAWins + record.playerBWins;
  const rateA = record.playerAWins / total;
  const headToHeadGap = Math.max(-10, Math.min(10, Math.round((rateA - 0.5) * 20)));

  return {
    headToHeadGap,
    evidence: [
      `Head-to-head: ${playerAName} ${record.playerAWins}-${record.playerBWins} ${playerBName} (all-time, all surfaces).`,
      `H2H gap ${headToHeadGap >= 0 ? "+" : ""}${headToHeadGap} (positive favours ${playerAName}).`,
    ],
  };
}

export function runTennisPrediction(
  playerAName: string,
  playerBName: string,
  quality: TennisQualityResult,
  form: TennisFormGapResult,
  manual: TennisManualFactors,
  serve: TennisServeGapResult | null = null,
  surface: TennisSurfaceGapResult | null = null,
  headToHead: TennisHeadToHeadGapResult | null = null,
): TennisPredictionResult {
  const serveGap = serve?.serveGap ?? 0;
  const surfaceGap = surface?.surfaceGap ?? 0;
  // Manual head-to-head edge now acts as an override, not an addition on top
  // of automatic H2H — typing in a non-zero value replaces the fetched H2H
  // gap rather than stacking with it, avoiding double-counting the exact
  // same signal (same override pattern already used for serve stats).
  const usingManualH2H = manual.headToHeadEdge !== 0;
  const h2hGap = usingManualH2H ? manual.headToHeadEdge : headToHead?.headToHeadGap ?? 0;
  const playerAEdge =
    quality.qualityGap + form.formGap + serveGap + surfaceGap + h2hGap + manual.otherFactorsEdge;

  // Quality and form pulling in opposite directions by a wide margin is a
  // genuine reason for caution, same principle as football's Conflict Gate —
  // simplified here to the two gates this first slice actually has.
  const signalsConflict =
    Math.sign(quality.qualityGap) !== 0 &&
    Math.sign(form.formGap) !== 0 &&
    Math.sign(quality.qualityGap) !== Math.sign(form.formGap) &&
    Math.abs(quality.qualityGap - form.formGap) >= 8;

  const confidence = Math.max(0, Math.min(100, 50 + Math.abs(playerAEdge) * 4));

  let prediction: TennisPredictionLabel;
  if (signalsConflict) {
    prediction = "Review Required";
  } else if (playerAEdge >= 8) {
    prediction = "Very Strong Player A Win";
  } else if (playerAEdge >= 4) {
    prediction = "Strong Player A Win";
  } else if (playerAEdge >= 1) {
    prediction = "Lean Player A Win";
  } else if (playerAEdge <= -8) {
    prediction = "Very Strong Player B Win";
  } else if (playerAEdge <= -4) {
    prediction = "Strong Player B Win";
  } else if (playerAEdge <= -1) {
    prediction = "Lean Player B Win";
  } else {
    prediction = "Too Close to Call";
  }

  const evidence = [
    ...quality.evidence,
    ...form.evidence,
    ...(serve?.evidence ?? []),
    ...(surface?.evidence ?? []),
    usingManualH2H
      ? `Manual head-to-head edge (overrides automatic H2H): ${manual.headToHeadEdge >= 0 ? "+" : ""}${manual.headToHeadEdge}.`
      : (headToHead?.evidence ?? []).join(" "),
    manual.otherFactorsEdge !== 0
      ? `Manual other-factors edge: ${manual.otherFactorsEdge >= 0 ? "+" : ""}${manual.otherFactorsEdge}.`
      : null,
    `Combined edge ${playerAEdge >= 0 ? "+" : ""}${playerAEdge} (positive favours ${playerAName}, negative favours ${playerBName}).`,
  ].filter((line): line is string => Boolean(line));

  return { playerAEdge, confidence, prediction, reviewRequired: signalsConflict, evidence };
}
