import type { Fixture } from "./sampleData";
import type { OutcomeProbabilities } from "./probabilityModel";
import type { ResultAccuracy } from "./scoringEngine";

export type ProbabilityCalibrationItem = {
  fixtureId: string;
  fixtureLabel: string;
  actualOutcome: "home" | "draw" | "away";
  favourite: "home" | "draw" | "away";
  favouriteProbability: number;
  actualOutcomeProbability: number;
  confidenceBand: "low" | "medium" | "high";
  spread: number;
  brierScore: number;
};

export type ProbabilityCalibrationBucket = {
  label: string;
  fixtures: number;
  averagePredictedProbability: number;
  actualHitRate: number;
  averageBrierScore: number;
};

export type ProbabilityCalibrationSummary = {
  settledFixtures: number;
  favouriteTips: number;
  favouriteHits: number;
  favouriteHitRate: number;
  averageActualOutcomeProbability: number;
  averageBrierScore: number;
  calibrationGrade: "insufficient-data" | "good" | "watch" | "poor";
  buckets: ProbabilityCalibrationBucket[];
  evidence: string[];
  warnings: string[];
  fixturesToReview: ProbabilityCalibrationItem[];
};

export type ProbabilityCalibrationInput = {
  fixture: Fixture;
  probabilities: OutcomeProbabilities;
  accuracy: ResultAccuracy;
};

const OUTCOMES = ["home", "draw", "away"] as const;

function round(value: number): number {
  return Math.round(value);
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampProbability(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function calculateMulticlassBrierScore(
  probabilities: Pick<OutcomeProbabilities, "home" | "draw" | "away">,
  actualOutcome: "home" | "draw" | "away",
): number {
  const rawScore = OUTCOMES.reduce((total, outcome) => {
    const predicted = clampProbability(probabilities[outcome]) / 100;
    const actual = outcome === actualOutcome ? 1 : 0;
    return total + (predicted - actual) ** 2;
  }, 0);

  // Divide by two so the score is displayed on a 0–1 scale.
  return roundTwo(rawScore / 2);
}

function getBucketLabel(probability: number): string {
  if (probability < 45) return "Under 45%";
  if (probability < 55) return "45–54%";
  if (probability < 65) return "55–64%";
  if (probability < 75) return "65–74%";
  return "75%+";
}

function getCalibrationGrade(settledFixtures: number, averageBrierScore: number): ProbabilityCalibrationSummary["calibrationGrade"] {
  if (settledFixtures < 10) return "insufficient-data";
  if (averageBrierScore <= 0.18) return "good";
  if (averageBrierScore <= 0.25) return "watch";
  return "poor";
}

export function summariseProbabilityCalibration(
  items: ProbabilityCalibrationInput[],
): ProbabilityCalibrationSummary {
  const settledItems = items
    .filter((item) =>
      item.accuracy.actualOutcome === "home" ||
      item.accuracy.actualOutcome === "draw" ||
      item.accuracy.actualOutcome === "away",
    )
    .map((item): ProbabilityCalibrationItem => {
      const actualOutcome = item.accuracy.actualOutcome as "home" | "draw" | "away";
      const favourite = item.probabilities.favourite;
      const favouriteProbability = item.probabilities[favourite];
      const actualOutcomeProbability = item.probabilities[actualOutcome];
      return {
        fixtureId: item.fixture.id,
        fixtureLabel: `${item.fixture.homeTeam} vs ${item.fixture.awayTeam}`,
        actualOutcome,
        favourite,
        favouriteProbability,
        actualOutcomeProbability,
        confidenceBand: item.probabilities.confidenceBand,
        spread: item.probabilities.spread,
        brierScore: calculateMulticlassBrierScore(item.probabilities, actualOutcome),
      };
    });

  const favouriteHits = settledItems.filter((item) => item.favourite === item.actualOutcome).length;
  const averageActualOutcomeProbability = round(average(settledItems.map((item) => item.actualOutcomeProbability)));
  const averageBrierScore = roundTwo(average(settledItems.map((item) => item.brierScore)));

  const bucketMap = new Map<string, ProbabilityCalibrationItem[]>();
  settledItems.forEach((item) => {
    const label = getBucketLabel(item.favouriteProbability);
    bucketMap.set(label, [...(bucketMap.get(label) ?? []), item]);
  });

  const bucketOrder = ["Under 45%", "45–54%", "55–64%", "65–74%", "75%+"];
  const buckets = bucketOrder.map((label) => {
    const bucketItems = bucketMap.get(label) ?? [];
    return {
      label,
      fixtures: bucketItems.length,
      averagePredictedProbability: round(average(bucketItems.map((item) => item.favouriteProbability))),
      actualHitRate: bucketItems.length > 0
        ? round((bucketItems.filter((item) => item.favourite === item.actualOutcome).length / bucketItems.length) * 100)
        : 0,
      averageBrierScore: roundTwo(average(bucketItems.map((item) => item.brierScore))),
    };
  });

  const calibrationGrade = getCalibrationGrade(settledItems.length, averageBrierScore);
  const warnings: string[] = [];

  if (settledItems.length < 10) {
    warnings.push("Calibration needs more final results before the probability layer can be judged reliably.");
  }
  if (settledItems.some((item) => item.favouriteProbability >= 75 && item.favourite !== item.actualOutcome)) {
    warnings.push("At least one high-probability favourite missed; review whether the model is overconfident on strong edges.");
  }
  if (settledItems.length >= 10 && averageBrierScore > 0.25) {
    warnings.push("Average Brier score is high, so probability tuning should be reviewed before treating percentages as reliable.");
  }

  const evidence = [
    `Settled fixtures analysed: ${settledItems.length}.`,
    `Favourite hit rate: ${settledItems.length > 0 ? round((favouriteHits / settledItems.length) * 100) : 0}% (${favouriteHits}/${settledItems.length}).`,
    `Average probability assigned to the actual result: ${averageActualOutcomeProbability}%.`,
    `Average multiclass Brier score: ${averageBrierScore} on a 0–1 scale, where lower is better.`,
    "This dashboard evaluates probability quality after final results exist; it does not change the prediction engine automatically.",
  ];

  return {
    settledFixtures: settledItems.length,
    favouriteTips: settledItems.length,
    favouriteHits,
    favouriteHitRate: settledItems.length > 0 ? round((favouriteHits / settledItems.length) * 100) : 0,
    averageActualOutcomeProbability,
    averageBrierScore,
    calibrationGrade,
    buckets,
    evidence,
    warnings,
    fixturesToReview: settledItems
      .filter((item) => item.favouriteProbability >= 65 && item.favourite !== item.actualOutcome)
      .sort((a, b) => b.favouriteProbability - a.favouriteProbability)
      .slice(0, 8),
  };
}
