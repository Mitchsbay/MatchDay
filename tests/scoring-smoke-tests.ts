import assert from "assert/strict";
import { fixtures } from "../lib/sampleData";
import {
  applyCalculatedGaps,
  calculateAccuracySummary,
  calculateAvailabilityFromMissingPlayers,
  calculateConflictFromSignals,
  calculateContextFromFlags,
  calculateFormFromRecentResults,
  calculateOddsFromMarket,
  calculateQualityFromTeamStats,
  calculateResultAccuracy,
  calculateRuleLearningSummary,
  emptyMatchContext,
  emptyMissingPlayers,
  defaultRuleWeights,
  emptyScores,
  getPredictedOutcome,
  runPrediction,
  type MissingPlayer,
  type RecentFormGame,
} from "../lib/scoringEngine";
import {
  calculateTipPoints,
  cloneFixtures,
  createBlankFixture,
  createPersistedState,
  getActualOutcomeFromScore,
  normaliseRound,
} from "../lib/workspace";

function assertBetween(value: number, min: number, max: number, label: string) {
  assert.ok(
    value >= min && value <= max,
    `${label} expected between ${min} and ${max}, received ${value}`,
  );
}

function runQualityAndPredictionSmokeTest() {
  const fixture = fixtures[0];
  const quality = calculateQualityFromTeamStats(
    fixture.homeStats,
    fixture.awayStats,
  );
  const form = calculateFormFromRecentResults(
    fixture.homeRecentForm,
    fixture.awayRecentForm,
  );
  const availability = calculateAvailabilityFromMissingPlayers(
    fixture.homeMissingPlayers,
    fixture.awayMissingPlayers,
  );
  const context = calculateContextFromFlags(
    fixture.homeContext,
    fixture.awayContext,
    fixture.matchContext,
  );
  const odds = calculateOddsFromMarket(fixture.oddsMarket);

  assert.ok(quality.qualityGap > 0, "sample favourite should have quality edge");
  assert.ok(form.recentFormGap > 0, "sample favourite should have form edge");
  assert.ok(
    availability.injuryRisk < 0,
    "sample away absences should help home-side model edge",
  );
  assert.ok(
    context.motivationEdge >= 0,
    "sample context should not oppose home side",
  );
  assert.ok(odds.oddsSupport > 0, "sample odds should support home side");

  const scoresBeforeConflict = applyCalculatedGaps(
    fixture.scores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    0,
  );
  const conflict = calculateConflictFromSignals({
    scores: scoresBeforeConflict,
    contextWarnings: context.warnings,
    oddsWarnings: odds.warnings,
    volatilityScore: context.volatilityScore,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  assertBetween(conflict.conflictScore, 0, 5, "conflict score");

  const finalScores = applyCalculatedGaps(
    fixture.scores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    conflict.conflictScore,
  );
  const prediction = runPrediction(finalScores);
  assert.equal(getPredictedOutcome(prediction), "home");
  assert.ok(prediction.confidence >= 50, "sample prediction should be publishable");

  const accuracy = calculateResultAccuracy(prediction, fixture.matchResult);
  assert.equal(accuracy.actualOutcome, "home");
  assert.equal(accuracy.isCorrect, true);
  assert.equal(accuracy.pointsAwarded, 1);
}

function runDirectionalConversionSmokeTests() {
  const strongHome = fixtures[0];
  const reversedQuality = calculateQualityFromTeamStats(
    strongHome.awayStats,
    strongHome.homeStats,
  );
  assert.ok(
    reversedQuality.qualityGap < 0,
    "swapping strong/weak teams should produce away quality edge",
  );

  const wins: RecentFormGame[] = Array.from({ length: 5 }, () => ({
    result: "W",
    goalsFor: 3,
    goalsAgainst: 0,
  }));
  const losses: RecentFormGame[] = Array.from({ length: 5 }, () => ({
    result: "L",
    goalsFor: 0,
    goalsAgainst: 3,
  }));
  assert.equal(calculateFormFromRecentResults(wins, losses).recentFormGap, 4);
  assert.equal(calculateFormFromRecentResults(losses, wins).recentFormGap, -4);
}

function runAvailabilityAndConflictSmokeTests() {
  const criticalAbsence: MissingPlayer = {
    name: "Captain",
    role: "Central defender",
    importance: "critical",
    reason: "suspension",
    expectedStarter: true,
  };
  const homeHit = calculateAvailabilityFromMissingPlayers(
    [criticalAbsence],
    emptyMissingPlayers,
  );
  assert.ok(homeHit.injuryRisk > 0, "home absence should hurt home side");

  const awayHit = calculateAvailabilityFromMissingPlayers(
    emptyMissingPlayers,
    [criticalAbsence],
  );
  assert.ok(awayHit.injuryRisk < 0, "away absence should help home side");

  const odds = calculateOddsFromMarket({
    homeWinProbability: 15,
    drawProbability: 20,
    awayWinProbability: 65,
    sourceLabel: "Smoke test market",
  });
  assert.equal(odds.externalFavourite, "away");
  assert.ok(odds.oddsSupport < 0);

  const conflict = calculateConflictFromSignals({
    scores: {
      ...emptyScores,
      qualityGap: 4,
      homeAdvantage: 2,
      recentFormGap: 2,
      oddsSupport: odds.oddsSupport,
      conflictScore: 0,
    },
    oddsWarnings: odds.warnings,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  assert.ok(
    conflict.conflictScore >= 1,
    "market disagreement should create at least a caution conflict",
  );
}

function runResultAndLearningSmokeTests() {
  const publishedHome = runPrediction({
    ...emptyScores,
    qualityGap: 5,
    homeAdvantage: 2,
    recentFormGap: 2,
    conflictScore: 0,
  });
  const correctHome = calculateResultAccuracy(publishedHome, {
    status: "final",
    homeGoals: 2,
    awayGoals: 0,
  });
  assert.equal(correctHome.isCorrect, true);

  const reviewPrediction = runPrediction({
    ...emptyScores,
    qualityGap: 1,
    recentFormGap: -4,
    oddsSupport: -2,
    conflictScore: 5,
  });
  const reviewedAccuracy = calculateResultAccuracy(reviewPrediction, {
    status: "final",
    homeGoals: 0,
    awayGoals: 1,
  });
  assert.equal(reviewedAccuracy.isTipPublished, false);
  assert.equal(reviewedAccuracy.isCorrect, null);

  const summary = calculateAccuracySummary(
    [correctHome, reviewedAccuracy],
    [publishedHome.confidence, reviewPrediction.confidence],
  );
  assert.equal(summary.finalFixtures, 2);
  assert.equal(summary.publishedTips, 1);
  assert.equal(summary.correctTips, 1);
  assert.equal(summary.reviewOrNoTips, 1);

  const learning = calculateRuleLearningSummary([
    { prediction: publishedHome, accuracy: correctHome },
    { prediction: reviewPrediction, accuracy: reviewedAccuracy },
  ]);
  assert.equal(learning.settledFixtures, 2);
  assert.ok(learning.learningItems.length > 0);
}

function runWorkspaceSmokeTests() {
  assert.equal(normaliseRound("  "), "Unassigned");
  assert.equal(normaliseRound(" Round 3 "), "Round 3");

  const blank = createBlankFixture("Round 99");
  assert.equal(blank.round, "Round 99");
  assert.equal(blank.scores.homeAdvantage, 2);
  assert.equal(blank.homeRecentForm.length, 5);

  const cloned = cloneFixtures([fixtures[0]]);
  cloned[0].homeStats.points = 0;
  assert.notEqual(
    cloned[0].homeStats.points,
    fixtures[0].homeStats.points,
    "fixture clone should not mutate source fixture",
  );

  assert.equal(
    getActualOutcomeFromScore({ status: "final", homeGoals: 1, awayGoals: 1 }),
    "draw",
  );
  assert.equal(calculateTipPoints("draw", "draw"), 2);
  assert.equal(calculateTipPoints("home", "away"), 0);

  const persisted = createPersistedState(
    [blank],
    blank.id,
    blank.round,
    defaultRuleWeights,
    [],
    [],
  );
  assert.equal(persisted.fixtures.length, 1);
  assert.equal(persisted.selectedRound, "Round 99");
}

runQualityAndPredictionSmokeTest();
runDirectionalConversionSmokeTests();
runAvailabilityAndConflictSmokeTests();
runResultAndLearningSmokeTests();
runWorkspaceSmokeTests();

console.log("Smoke tests passed: scoring, gates, results, learning, workspace helpers.");
