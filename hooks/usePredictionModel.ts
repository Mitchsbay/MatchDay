"use client";

import { useMemo } from "react";
import { Fixture } from "../lib/sampleData";
import {
  RuleWeights,
  applyCalculatedGaps,
  calculateAccuracySummary,
  calculateAvailabilityFromMissingPlayers,
  calculateContextFromFlags,
  calculateConflictFromSignals,
  calculateFormFromRecentResults,
  calculateOddsFromMarket,
  calculateQualityFromTeamStats,
  calculateResultAccuracy,
  calculateRuleLearningSummary,
  runPrediction,
} from "../lib/scoringEngine";

export function calculateFixturePrediction(fixture: Fixture, ruleWeights: RuleWeights) {
  const quality = calculateQualityFromTeamStats(fixture.homeStats, fixture.awayStats);
  const form = calculateFormFromRecentResults(fixture.homeRecentForm, fixture.awayRecentForm);
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
    weights: ruleWeights,
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
  const prediction = runPrediction(scores, ruleWeights);
  const accuracy = calculateResultAccuracy(prediction, fixture.matchResult);

  return {
    accuracy,
    availability,
    confidence: prediction.confidence,
    conflict,
    context,
    form,
    odds,
    prediction,
    quality,
    scores,
  };
}

export function usePredictionModel(fixtures: Fixture[], activeFixtureId: string, ruleWeights: RuleWeights) {
  const activeFixture = fixtures.find((fixture) => fixture.id === activeFixtureId) ?? fixtures[0];

  const activePrediction = useMemo(
    () => calculateFixturePrediction(activeFixture, ruleWeights),
    [activeFixture, ruleWeights],
  );

  const computedFixtureResults = useMemo(
    () =>
      fixtures.map((fixture) => ({
        fixture,
        ...calculateFixturePrediction(fixture, ruleWeights),
      })),
    [fixtures, ruleWeights],
  );

  const accuracySummary = useMemo(
    () =>
      calculateAccuracySummary(
        computedFixtureResults.map((item) => item.accuracy),
        computedFixtureResults.map((item) => item.confidence),
      ),
    [computedFixtureResults],
  );

  const ruleLearning = useMemo(
    () =>
      calculateRuleLearningSummary(
        computedFixtureResults.map((item) => ({
          prediction: item.prediction,
          accuracy: item.accuracy,
        })),
      ),
    [computedFixtureResults],
  );

  return {
    activeFixture,
    accuracySummary,
    computedFixtureResults,
    ruleLearning,
    ...activePrediction,
  };
}
