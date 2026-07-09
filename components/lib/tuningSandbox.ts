import type { Fixture } from "./sampleData";
import {
  RuleWeights,
  applyCalculatedGaps,
  calculateAvailabilityFromMissingPlayers,
  calculateConflictFromSignals,
  calculateContextFromFlags,
  calculateFormFromRecentResults,
  calculateOddsFromMarket,
  calculateQualityFromTeamStats,
  calculateResultAccuracy,
  runPrediction,
} from "./scoringEngine";
import { calculateOutcomeProbabilities } from "./probabilityModel";

export type TuningSandboxMetrics = {
  publishedTips: number;
  correctTips: number;
  hitRate: number;
  reviewHeldFixtures: number;
  averageConfidence: number;
  averageFavouriteProbability: number;
  highConfidenceMisses: number;
};

export type TuningSandboxComparison = {
  fixtureCount: number;
  settledFixtures: number;
  baseline: TuningSandboxMetrics;
  sandbox: TuningSandboxMetrics;
  predictionChanges: number;
  publishStatusChanges: number;
  confidenceDelta: number;
  favouriteProbabilityDelta: number;
  hitRateDelta: number;
  warnings: string[];
  evidence: string[];
};

function round(value: number): number {
  return Math.round(value);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateFixtureWithWeights(fixture: Fixture, weights: RuleWeights) {
  const quality = calculateQualityFromTeamStats(fixture.homeStats, fixture.awayStats);
  const form = calculateFormFromRecentResults(fixture.homeRecentForm, fixture.awayRecentForm);
  const availability = calculateAvailabilityFromMissingPlayers(fixture.homeMissingPlayers, fixture.awayMissingPlayers);
  const context = calculateContextFromFlags(fixture.homeContext, fixture.awayContext, fixture.matchContext);
  const odds = calculateOddsFromMarket(fixture.oddsMarket);
  const preConflictScores = applyCalculatedGaps(
    fixture.scores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    0,
  );
  const conflict = calculateConflictFromSignals({
    scores: preConflictScores,
    weights,
    contextWarnings: context.warnings,
    oddsWarnings: odds.warnings,
    volatilityScore: context.volatilityScore,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  const scores = applyCalculatedGaps(
    preConflictScores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    conflict.conflictScore,
  );
  const prediction = runPrediction(scores, weights);
  const probabilities = calculateOutcomeProbabilities({
    scores,
    prediction,
    odds,
    conflict,
    weights,
  });
  const accuracy = calculateResultAccuracy(prediction, fixture.matchResult);
  return { accuracy, prediction, probabilities };
}

function summariseMetrics(results: ReturnType<typeof calculateFixtureWithWeights>[]): TuningSandboxMetrics {
  const settled = results.filter((item) => item.accuracy.isSettled);
  const published = settled.filter((item) => item.accuracy.isTipPublished);
  const correct = published.filter((item) => item.accuracy.isCorrect === true);
  const highConfidenceMisses = published.filter(
    (item) => item.accuracy.isCorrect === false && item.probabilities[item.probabilities.favourite] >= 65,
  );
  return {
    publishedTips: published.length,
    correctTips: correct.length,
    hitRate: published.length > 0 ? round((correct.length / published.length) * 100) : 0,
    reviewHeldFixtures: settled.length - published.length,
    averageConfidence: round(average(results.map((item) => item.prediction.confidence))),
    averageFavouriteProbability: round(average(results.map((item) => item.probabilities[item.probabilities.favourite]))),
    highConfidenceMisses: highConfidenceMisses.length,
  };
}

export function summariseTuningSandbox(args: {
  fixtures: Fixture[];
  baselineWeights: RuleWeights;
  sandboxWeights: RuleWeights;
}): TuningSandboxComparison {
  const baselineResults = args.fixtures.map((fixture) => calculateFixtureWithWeights(fixture, args.baselineWeights));
  const sandboxResults = args.fixtures.map((fixture) => calculateFixtureWithWeights(fixture, args.sandboxWeights));
  const baseline = summariseMetrics(baselineResults);
  const sandbox = summariseMetrics(sandboxResults);

  const predictionChanges = baselineResults.filter((baselineResult, index) => {
    const sandboxResult = sandboxResults[index];
    return sandboxResult && baselineResult.prediction.prediction !== sandboxResult.prediction.prediction;
  }).length;
  const publishStatusChanges = baselineResults.filter((baselineResult, index) => {
    const sandboxResult = sandboxResults[index];
    return sandboxResult && baselineResult.accuracy.isTipPublished !== sandboxResult.accuracy.isTipPublished;
  }).length;
  const settledFixtures = baselineResults.filter((item) => item.accuracy.isSettled).length;

  const warnings: string[] = [];
  if (settledFixtures < 10) warnings.push("Sandbox comparison is provisional until at least 10 final fixtures exist.");
  if (sandbox.highConfidenceMisses > baseline.highConfidenceMisses) warnings.push("Sandbox settings create more high-confidence misses than the live settings on current results.");
  if (sandbox.publishedTips > baseline.publishedTips && sandbox.hitRate < baseline.hitRate) warnings.push("Sandbox settings publish more tips but lower the historical hit rate.");
  if (publishStatusChanges > 0) warnings.push("Sandbox settings change which settled fixtures would be published versus held for review.");

  const evidence = [
    `Fixtures compared: ${args.fixtures.length}.`,
    `Settled fixtures compared: ${settledFixtures}.`,
    `Prediction labels changed on ${predictionChanges} fixture(s).`,
    `Publish/review status changed on ${publishStatusChanges} fixture(s).`,
    "P31 is a what-if sandbox only; it does not change the live model until you manually copy settings into the rule weight panel.",
  ];

  return {
    fixtureCount: args.fixtures.length,
    settledFixtures,
    baseline,
    sandbox,
    predictionChanges,
    publishStatusChanges,
    confidenceDelta: sandbox.averageConfidence - baseline.averageConfidence,
    favouriteProbabilityDelta: sandbox.averageFavouriteProbability - baseline.averageFavouriteProbability,
    hitRateDelta: sandbox.hitRate - baseline.hitRate,
    warnings,
    evidence,
  };
}
