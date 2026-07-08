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

// --- Prediction: combine gates, no draw outcome exists -----------------------
export function runTennisPrediction(
  playerAName: string,
  playerBName: string,
  quality: TennisQualityResult,
  form: TennisFormGapResult,
  manual: TennisManualFactors,
): TennisPredictionResult {
  const playerAEdge =
    quality.qualityGap + form.formGap + manual.headToHeadEdge + manual.otherFactorsEdge;

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
    manual.headToHeadEdge !== 0
      ? `Manual head-to-head edge: ${manual.headToHeadEdge >= 0 ? "+" : ""}${manual.headToHeadEdge}.`
      : null,
    manual.otherFactorsEdge !== 0
      ? `Manual other-factors edge: ${manual.otherFactorsEdge >= 0 ? "+" : ""}${manual.otherFactorsEdge}.`
      : null,
    `Combined edge ${playerAEdge >= 0 ? "+" : ""}${playerAEdge} (positive favours ${playerAName}, negative favours ${playerBName}).`,
  ].filter((line): line is string => Boolean(line));

  return { playerAEdge, confidence, prediction, reviewRequired: signalsConflict, evidence };
}
