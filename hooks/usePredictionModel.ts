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
import { calculateOutcomeProbabilities } from "../lib/probabilityModel";
import { summariseProbabilityCalibration } from "../lib/probabilityCalibration";
import {
  applyAdvancedDataWeightControls,
  normaliseAdvancedDataWeightControls,
  summariseAdvancedDataIntegration,
  type AdvancedDataWeightControls,
} from "../lib/advancedDataWeightControls";
import { summariseAdvancedDataWeightSandbox } from "../lib/advancedDataWeightSandbox";

export function calculateFixturePrediction(
  fixture: Fixture,
  ruleWeights: RuleWeights,
  advancedDataControls?: Partial<AdvancedDataWeightControls>,
) {
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
  const basePrediction = runPrediction(scores, ruleWeights);
  const { prediction, integration: advancedDataIntegration } = applyAdvancedDataWeightControls({
    fixture,
    prediction: basePrediction,
    controls: advancedDataControls,
    weights: ruleWeights,
  });
  const probabilities = calculateOutcomeProbabilities({
    scores,
    prediction,
    odds,
    conflict,
    weights: ruleWeights,
  });
  const accuracy = calculateResultAccuracy(prediction, fixture.matchResult);

  return {
    accuracy,
    advancedDataIntegration,
    availability,
    confidence: prediction.confidence,
    conflict,
    context,
    form,
    odds,
    prediction,
    probabilities,
    quality,
    scores,
  };
}

export function usePredictionModel(
  fixtures: Fixture[],
  activeFixtureId: string,
  ruleWeights: RuleWeights,
  advancedDataControls?: Partial<AdvancedDataWeightControls>,
) {
  const activeFixture = fixtures.find((fixture) => fixture.id === activeFixtureId) ?? fixtures[0];

  const activePrediction = useMemo(
    () => calculateFixturePrediction(activeFixture, ruleWeights, advancedDataControls),
    [activeFixture, ruleWeights, advancedDataControls],
  );

  const computedFixtureResults = useMemo(
    () =>
      fixtures.map((fixture) => ({
        fixture,
        ...calculateFixturePrediction(fixture, ruleWeights, advancedDataControls),
      })),
    [fixtures, ruleWeights, advancedDataControls],
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


  const advancedDataIntegrationSummary = useMemo(
    () =>
      summariseAdvancedDataIntegration(
        computedFixtureResults.map((item) => item.advancedDataIntegration),
        advancedDataControls,
      ),
    [computedFixtureResults, advancedDataControls],
  );

  const advancedDataWeightSandboxSummary = useMemo(() => {
    const normalised = normaliseAdvancedDataWeightControls(advancedDataControls);
    const proposedControls = { ...normalised, enabled: true, mode: "confidence-only" as const };
    const reviewOnlyControls = { ...normalised, enabled: false, mode: "review-only" as const };
    return summariseAdvancedDataWeightSandbox(
      fixtures.map((fixture) => {
        const baseline = calculateFixturePrediction(fixture, ruleWeights, reviewOnlyControls);
        const proposed = calculateFixturePrediction(fixture, ruleWeights, proposedControls);
        return {
          fixture,
          baselinePrediction: baseline.prediction,
          baselineAccuracy: baseline.accuracy,
          baselineIntegration: baseline.advancedDataIntegration,
          proposedPrediction: proposed.prediction,
          proposedAccuracy: proposed.accuracy,
          proposedIntegration: proposed.advancedDataIntegration,
        };
      }),
      proposedControls,
    );
  }, [fixtures, ruleWeights, advancedDataControls]);

  const probabilityCalibration = useMemo(
    () =>
      summariseProbabilityCalibration(
        computedFixtureResults.map((item) => ({
          fixture: item.fixture,
          probabilities: item.probabilities,
          accuracy: item.accuracy,
        })),
      ),
    [computedFixtureResults],
  );

  return {
    activeFixture,
    accuracySummary,
    advancedDataIntegrationSummary,
    advancedDataWeightSandboxSummary,
    computedFixtureResults,
    ruleLearning,
    probabilityCalibration,
    ...activePrediction,
  };
}
