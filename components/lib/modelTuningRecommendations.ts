import type { Fixture } from "./sampleData";
import type {
  PredictionResult,
  ResultAccuracy,
  RuleLearningSummary,
  RuleWeights,
} from "./scoringEngine";
import type { OutcomeProbabilities } from "./probabilityModel";
import type { ProbabilityCalibrationSummary } from "./probabilityCalibration";

export type TuningRecommendationPriority = "low" | "medium" | "high";
export type TuningRecommendationCategory =
  | "data"
  | "probability"
  | "confidence"
  | "draw"
  | "gate"
  | "conflict"
  | "maintain";

export type ModelTuningRecommendation = {
  id: string;
  title: string;
  priority: TuningRecommendationPriority;
  category: TuningRecommendationCategory;
  affectedSetting: string;
  reason: string;
  suggestedAction: string;
  evidence: string[];
};

export type ModelTuningInput = {
  fixture: Fixture;
  prediction: PredictionResult;
  probabilities: OutcomeProbabilities;
  accuracy: ResultAccuracy;
};

export type ModelTuningSummary = {
  settledFixtures: number;
  publishedTips: number;
  highConfidenceMisses: number;
  drawResults: number;
  averageDrawProbabilityOnDraws: number;
  recommendationCount: number;
  highPriorityCount: number;
  recommendations: ModelTuningRecommendation[];
  evidence: string[];
  warnings: string[];
};

function round(value: number): number {
  return Math.round(value);
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function gateSettingName(gateId: string): string {
  const map: Record<string, string> = {
    edge: "confidenceEdgeMultiplier / minimumPublishConfidence",
    quality: "qualityGap weight or Quality Gate threshold",
    form: "recentFormGap weight or Form Gate threshold",
    availability: "injuryRisk weight or Availability Gate threshold",
    context: "motivationEdge weight or Context Gate threshold",
    market: "oddsSupport weight or market blend weight",
    conflict: "conflictScore weight / reviewConflictThreshold",
  };
  return map[gateId] ?? "related gate weight/threshold";
}

function priorityRank(priority: TuningRecommendationPriority): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

export function summariseModelTuningRecommendations(args: {
  items: ModelTuningInput[];
  calibration: ProbabilityCalibrationSummary;
  ruleLearning: RuleLearningSummary;
  ruleWeights: RuleWeights;
}): ModelTuningSummary {
  const settledItems = args.items.filter((item) => item.accuracy.isSettled);
  const publishedItems = settledItems.filter((item) => item.accuracy.isTipPublished);
  const missedPublishedItems = publishedItems.filter((item) => item.accuracy.isCorrect === false);
  const highConfidenceMisses = missedPublishedItems.filter(
    (item) => item.probabilities[item.probabilities.favourite] >= 65,
  );
  const drawItems = settledItems.filter((item) => item.accuracy.actualOutcome === "draw");
  const averageDrawProbabilityOnDraws = round(
    average(drawItems.map((item) => item.probabilities.draw)),
  );
  const thinSpreadMisses = missedPublishedItems.filter((item) => item.probabilities.spread < 8);
  const highConflictMisses = missedPublishedItems.filter((item) => item.prediction.warnings.some((warning) => warning.toLowerCase().includes("conflict")));
  const marketBlendItems = publishedItems.filter((item) => item.probabilities.marketBlendUsed);
  const recommendations: ModelTuningRecommendation[] = [];

  if (settledItems.length < 10) {
    recommendations.push({
      id: "collect-more-results",
      title: "Collect more final results before changing weights",
      priority: "low",
      category: "data",
      affectedSetting: "No model setting yet",
      reason: "The calibration sample is still small, so any tuning change could overfit one round or one league.",
      suggestedAction: "Keep collecting results until at least 10 settled fixtures exist, and preferably 20+ before making permanent model changes.",
      evidence: [
        `${settledItems.length} settled fixture(s) are available for tuning review.`,
        `Current minimum publish confidence is ${args.ruleWeights.minimumPublishConfidence}%.`,
      ],
    });
  }

  const highConfidenceMissRate = percentage(highConfidenceMisses.length, publishedItems.length);
  if (publishedItems.length >= 5 && highConfidenceMisses.length >= 2 && highConfidenceMissRate >= 25) {
    recommendations.push({
      id: "reduce-strong-favourite-overconfidence",
      title: "Reduce overconfidence on strong favourites",
      priority: "high",
      category: "confidence",
      affectedSetting: "confidenceEdgeMultiplier / confidenceConflictPenalty / minimumPublishConfidence",
      reason: "Multiple high-probability favourites have missed, which means the model may be separating outcomes too strongly.",
      suggestedAction: "Consider lowering the confidence edge multiplier, increasing the conflict penalty, or raising the minimum publish confidence before publishing strong tips.",
      evidence: [
        `${highConfidenceMisses.length} high-confidence favourite miss(es) from ${publishedItems.length} published settled tip(s).`,
        `High-confidence miss rate: ${highConfidenceMissRate}%.`,
      ],
    });
  }

  if (settledItems.length >= 10 && args.calibration.averageBrierScore > 0.25) {
    recommendations.push({
      id: "review-probability-layer",
      title: "Review probability calibration before trusting percentages",
      priority: "high",
      category: "probability",
      affectedSetting: "Probability layer / draw pressure / market blend",
      reason: "The average Brier score is above the watch threshold, so the probability layer is not yet behaving reliably against final results.",
      suggestedAction: "Review high-confidence misses first, then reduce probability spread or increase draw/conflict compression before changing gate weights.",
      evidence: [
        `Average Brier score: ${args.calibration.averageBrierScore.toFixed(2)}.`,
        `Calibration grade: ${args.calibration.calibrationGrade}.`,
      ],
    });
  }

  if (drawItems.length >= 2 && averageDrawProbabilityOnDraws < 28) {
    recommendations.push({
      id: "raise-draw-pressure",
      title: "Increase draw pressure for real draw outcomes",
      priority: "medium",
      category: "draw",
      affectedSetting: "P28 draw inflation logic / review policy for thin edges",
      reason: "Actual draws are receiving a low draw probability, which usually means thin-edge and conflict fixtures are still being pushed too hard toward home/away.",
      suggestedAction: "Increase draw pressure for near-zero edges, high-conflict fixtures, or fixtures with elevated external draw probability. Do not auto-publish tight home/away calls.",
      evidence: [
        `${drawItems.length} settled draw result(s) in the sample.`,
        `Average draw probability on actual draws: ${averageDrawProbabilityOnDraws}%.`,
      ],
    });
  }

  if (thinSpreadMisses.length >= 2) {
    recommendations.push({
      id: "hold-tight-spread-fixtures",
      title: "Hold tight probability spreads for review",
      priority: "medium",
      category: "confidence",
      affectedSetting: "minimumPublishConfidence / reviewConflictThreshold",
      reason: "Several missed tips came from fixtures where the top probabilities were tightly grouped.",
      suggestedAction: "Treat spreads under 8 percentage points as review-only unless another strong gate confirms the pick.",
      evidence: [
        `${thinSpreadMisses.length} missed published tip(s) had a probability spread under 8 points.`,
        `Current review conflict threshold is ${args.ruleWeights.reviewConflictThreshold}.`,
      ],
    });
  }

  if (highConflictMisses.length >= 2) {
    recommendations.push({
      id: "increase-conflict-penalty",
      title: "Increase penalty for conflicting evidence",
      priority: "medium",
      category: "conflict",
      affectedSetting: "conflictScore weight / confidenceConflictPenalty",
      reason: "Misses are clustering around predictions that already carried conflict warnings.",
      suggestedAction: "Increase conflictScore weight or confidence conflict penalty, then review whether more fixtures should be held instead of published.",
      evidence: [
        `${highConflictMisses.length} missed published tip(s) included conflict warnings.`,
        `Current conflict weight is ${args.ruleWeights.conflictScore}.`,
      ],
    });
  }

  for (const gate of args.ruleLearning.learningItems) {
    if (gate.passPublishedTips >= 3 && gate.passHitRate < 50) {
      recommendations.push({
        id: `tighten-${gate.gateId}`,
        title: `Tighten or down-weight ${gate.gateName}`,
        priority: "medium",
        category: "gate",
        affectedSetting: gateSettingName(gate.gateId),
        reason: `${gate.gateName} is passing published tips that are not landing often enough.`,
        suggestedAction: "Reduce this gate's weight or tighten its pass threshold, then re-check the calibration dashboard after more results settle.",
        evidence: [
          `${gate.gateName} pass hit rate: ${gate.passHitRate}% (${gate.passCorrectTips}/${gate.passPublishedTips}).`,
          `Current gate recommendation: ${gate.recommendation}`,
        ],
      });
    }

    if (gate.failPublishedTips >= 2 && gate.failHitRate >= Math.max(gate.passHitRate, 50)) {
      recommendations.push({
        id: `loosen-${gate.gateId}`,
        title: `Review whether ${gate.gateName} is too strict`,
        priority: "medium",
        category: "gate",
        affectedSetting: gateSettingName(gate.gateId),
        reason: `Published tips where ${gate.gateName} failed are still landing at least as well as tips where it passed.`,
        suggestedAction: "Check this gate's fail conditions. It may be over-blocking valid predictions or being overruled by stronger evidence elsewhere.",
        evidence: [
          `${gate.gateName} fail hit rate: ${gate.failHitRate}% (${gate.failCorrectTips}/${gate.failPublishedTips}).`,
          `${gate.gateName} pass hit rate: ${gate.passHitRate}% (${gate.passCorrectTips}/${gate.passPublishedTips}).`,
        ],
      });
    }
  }

  if (marketBlendItems.length >= 5) {
    const marketBlendHitRate = percentage(
      marketBlendItems.filter((item) => item.accuracy.isCorrect === true).length,
      marketBlendItems.length,
    );
    recommendations.push({
      id: "monitor-market-blend",
      title: "Monitor the 25% external probability blend",
      priority: "low",
      category: "probability",
      affectedSetting: "market blend weight / oddsSupport weight",
      reason: "Enough market-blended fixtures exist to start tracking whether the external sanity check is helping or hurting.",
      suggestedAction: "Do not change the 25% blend yet. Compare blended fixtures against model-only fixtures over a larger sample first.",
      evidence: [
        `${marketBlendItems.length} published settled tip(s) used market blending.`,
        `Market-blended hit rate: ${marketBlendHitRate}%.`,
      ],
    });
  }

  const hasActionableRecommendation = recommendations.some((item) => item.priority === "high" || item.priority === "medium");
  if (settledItems.length >= 10 && !hasActionableRecommendation && args.calibration.calibrationGrade === "good") {
    recommendations.push({
      id: "maintain-current-settings",
      title: "Maintain current model settings",
      priority: "low",
      category: "maintain",
      affectedSetting: "No change recommended",
      reason: "Calibration and rule-learning checks do not currently point to a clear model weakness.",
      suggestedAction: "Keep collecting results and review again after the next round settles. Avoid changing weights without a stronger signal.",
      evidence: [
        `Calibration grade is ${args.calibration.calibrationGrade}.`,
        `Favourite hit rate is ${args.calibration.favouriteHitRate}%.`,
      ],
    });
  }

  const orderedRecommendations = recommendations
    .filter((recommendation, index, list) => list.findIndex((item) => item.id === recommendation.id) === index)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.title.localeCompare(b.title))
    .slice(0, 10);

  const warnings: string[] = [];
  if (settledItems.length < 10) warnings.push("Tuning recommendations are provisional until at least 10 final fixtures exist.");
  if (orderedRecommendations.some((item) => item.priority === "high")) warnings.push("At least one high-priority tuning issue was found. Review before increasing model confidence.");

  const evidence = [
    `Settled fixtures reviewed: ${settledItems.length}.`,
    `Published settled tips reviewed: ${publishedItems.length}.`,
    `High-confidence misses: ${highConfidenceMisses.length}.`,
    `Draw results reviewed: ${drawItems.length}.`,
    "Recommendations are advisory only; P30 does not auto-change rule weights or probability settings.",
  ];

  return {
    settledFixtures: settledItems.length,
    publishedTips: publishedItems.length,
    highConfidenceMisses: highConfidenceMisses.length,
    drawResults: drawItems.length,
    averageDrawProbabilityOnDraws,
    recommendationCount: orderedRecommendations.length,
    highPriorityCount: orderedRecommendations.filter((item) => item.priority === "high").length,
    recommendations: orderedRecommendations,
    evidence,
    warnings,
  };
}
