import type {
  ConflictCalculation,
  MatchScores,
  OddsCalculation,
  PredictionResult,
  RuleWeights,
} from "./scoringEngine";
import type { PoissonOutcomeProbabilities } from "./expectedGoalsModel";

export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
  favourite: "home" | "draw" | "away";
  spread: number;
  confidenceBand: "low" | "medium" | "high";
  modelOnly: {
    home: number;
    draw: number;
    away: number;
  };
  marketBlendUsed: boolean;
  poissonBlendUsed: boolean;
  expectedGoals?: { home: number; away: number };
  evidence: string[];
  warnings: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function normaliseToHundred(values: { home: number; draw: number; away: number }) {
  const raw = {
    home: Math.max(0, values.home),
    draw: Math.max(0, values.draw),
    away: Math.max(0, values.away),
  };
  const total = raw.home + raw.draw + raw.away;
  if (total <= 0) return { home: 33, draw: 34, away: 33 };

  const homeFloat = (raw.home / total) * 100;
  const drawFloat = (raw.draw / total) * 100;
  let home = round(homeFloat);
  let draw = round(drawFloat);
  let away = 100 - home - draw;

  // Rounding home and draw independently can occasionally push away
  // negative — this is reachable in practice (verified by brute-force sweep
  // across edge/conflict/market combinations, not just a theoretical edge
  // case), most easily hit when a large edge combines with an external
  // market input that assigns ~0% to away. Reclaim the deficit from
  // whichever of home/draw is larger, since that's the one most likely
  // responsible for the rounding overshoot, rather than displaying a
  // nonsensical negative percentage to the user.
  if (away < 0) {
    const deficit = -away;
    if (home >= draw) home -= deficit;
    else draw -= deficit;
    away = 0;
  }

  return { home, draw, away };
}

function getFavourite(probabilities: { home: number; draw: number; away: number }): "home" | "draw" | "away" {
  if (probabilities.home >= probabilities.draw && probabilities.home >= probabilities.away) return "home";
  if (probabilities.away >= probabilities.home && probabilities.away >= probabilities.draw) return "away";
  return "draw";
}

function getSpread(probabilities: { home: number; draw: number; away: number }): number {
  const sorted = [probabilities.home, probabilities.draw, probabilities.away].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
}

function confidenceBand(spread: number, conflictScore: number, reviewRequired: boolean): OutcomeProbabilities["confidenceBand"] {
  if (reviewRequired || conflictScore >= 3 || spread < 8) return "low";
  if (spread >= 18 && conflictScore <= 1) return "high";
  return "medium";
}

function marketIsUsable(odds: OddsCalculation): boolean {
  const total = odds.homeProbability + odds.drawProbability + odds.awayProbability;
  return total > 0 && Math.abs(total - 100) <= 12;
}

function poissonIsUsable(poisson: PoissonOutcomeProbabilities | undefined): poisson is PoissonOutcomeProbabilities {
  if (!poisson) return false;
  const total = poisson.home + poisson.draw + poisson.away;
  return total > 0 && Math.abs(total - 100) <= 2; // the model normalises internally, so this only guards against a malformed input
}

export function calculateOutcomeProbabilities(args: {
  scores: MatchScores;
  prediction: PredictionResult;
  odds: OddsCalculation;
  conflict: ConflictCalculation;
  weights: RuleWeights;
  poisson?: PoissonOutcomeProbabilities;
}): OutcomeProbabilities {
  const edge = args.prediction.homeEdge;
  const absEdge = Math.abs(edge);
  const conflictScore = args.conflict.conflictScore;

  const directionalStrength = clamp(absEdge / 12, 0, 1);
  const drawFromEdge = 34 - directionalStrength * 18;
  const drawFromConflict = conflictScore * 3;
  const drawProbability = clamp(drawFromEdge + drawFromConflict, 14, 44);
  const remaining = 100 - drawProbability;
  const homeShare = logistic(edge / 5);

  const modelOnly = normaliseToHundred({
    home: remaining * homeShare,
    draw: drawProbability,
    away: remaining * (1 - homeShare),
  });

  const useMarket = marketIsUsable(args.odds);
  const usePoisson = poissonIsUsable(args.poisson);
  // Poisson gets more weight than the market sanity signal when both are
  // present, since it's a fitted statistical model rather than a
  // plausibility check — but the gate-based model-only score still holds
  // the majority weight either way.
  const poissonWeight = usePoisson ? 0.3 : 0;
  const marketWeight = useMarket ? 0.25 : 0;
  const modelWeight = 1 - marketWeight - poissonWeight;
  const blended = normaliseToHundred({
    home:
      modelOnly.home * modelWeight +
      args.odds.homeProbability * marketWeight +
      (usePoisson ? args.poisson!.home * poissonWeight : 0),
    draw:
      modelOnly.draw * modelWeight +
      args.odds.drawProbability * marketWeight +
      (usePoisson ? args.poisson!.draw * poissonWeight : 0),
    away:
      modelOnly.away * modelWeight +
      args.odds.awayProbability * marketWeight +
      (usePoisson ? args.poisson!.away * poissonWeight : 0),
  });

  const favourite = getFavourite(blended);
  const spread = getSpread(blended);
  const warnings: string[] = [];

  if (args.prediction.reviewRequired) {
    warnings.push("Prediction is still in review, so probabilities should not be treated as a publish-ready tip.");
  }
  if (conflictScore >= 3) {
    warnings.push("Conflict score is high, so probability separation is intentionally compressed.");
  }
  if (spread < 8) {
    warnings.push("Top probabilities are tightly grouped; this is effectively a low-confidence fixture.");
  }
  if (!useMarket && args.odds.homeProbability + args.odds.drawProbability + args.odds.awayProbability > 0) {
    warnings.push("External probability inputs were ignored because they do not add close enough to 100%.");
  }

  const evidence = [
    `Model edge ${edge >= 0 ? "+" : ""}${edge} was converted into a model-only probability split of Home ${modelOnly.home}%, Draw ${modelOnly.draw}%, Away ${modelOnly.away}%.`,
    `Conflict score ${conflictScore}/5 ${conflictScore > 0 ? "raised draw/uncertainty pressure" : "did not add extra uncertainty pressure"}.`,
    useMarket
      ? `External probabilities were blended at 25% weight: Home ${args.odds.homeProbability}%, Draw ${args.odds.drawProbability}%, Away ${args.odds.awayProbability}%.`
      : "No usable external probability blend was applied; the split is model-only.",
    usePoisson
      ? `Expected-goals model (${args.poisson!.homeXg} v ${args.poisson!.awayXg} xG) was blended at 30% weight: Home ${args.poisson!.home}%, Draw ${args.poisson!.draw}%, Away ${args.poisson!.away}%. Most likely scoreline ${args.poisson!.mostLikelyScoreline.home}-${args.poisson!.mostLikelyScoreline.away}.`
      : "No expected-goals model input was supplied; the split does not include a Poisson blend.",
    `Final estimated probabilities: Home ${blended.home}%, Draw ${blended.draw}%, Away ${blended.away}%. Favourite: ${favourite}, spread ${spread} point(s).`,
    "These are heuristic estimated probabilities from the gate model, not a statistically calibrated bookmaker line.",
  ];

  return {
    ...blended,
    favourite,
    spread,
    confidenceBand: confidenceBand(spread, conflictScore, args.prediction.reviewRequired),
    modelOnly,
    marketBlendUsed: useMarket,
    poissonBlendUsed: usePoisson,
    expectedGoals: usePoisson ? { home: args.poisson!.homeXg, away: args.poisson!.awayXg } : undefined,
    evidence,
    warnings,
  };
}

export function probabilityForOutcome(probabilities: OutcomeProbabilities, outcome: "home" | "draw" | "away"): number {
  return probabilities[outcome];
}
