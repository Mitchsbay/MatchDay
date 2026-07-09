import type { Fixture, TipPick } from "./sampleData";
import type { ResultAccuracy } from "./scoringEngine";
import { buildAdvancedDataGate, type AdvancedDataGateResult } from "./advancedDataGate";
import { buildAdvancedEvidenceImpactSummary, type AdvancedImpactSignal } from "./advancedEvidenceImpact";

export type AdvancedDataCalibrationGrade = "needs-data" | "promising" | "mixed" | "weak";

export type AdvancedDataCalibrationCategory = {
  category: string;
  sampleSize: number;
  correctCount: number;
  missedCount: number;
  hitRatePct: number;
  note: string;
};

export type AdvancedDataCalibrationExample = {
  fixtureId: string;
  fixtureLabel: string;
  category: string;
  signal: string;
  gateVerdict: string;
  prediction: string;
  actualOutcome: string;
  result: "helped" | "warned-correctly" | "false-warning" | "missed" | "review-only";
};

export type AdvancedDataCalibrationSummary = {
  fixtureCount: number;
  settledFixtureCount: number;
  fixturesWithAdvancedGateData: number;
  supportiveSignalSampleSize: number;
  supportiveSignalHitRatePct: number;
  warningSignalSampleSize: number;
  warningSignalMissRatePct: number;
  reviewGateCount: number;
  supportsGateHitRatePct: number;
  weakensGateMissRatePct: number;
  categoryBreakdown: AdvancedDataCalibrationCategory[];
  examples: AdvancedDataCalibrationExample[];
  grade: AdvancedDataCalibrationGrade;
  recommendation: string;
  notes: string[];
};

export type AdvancedDataCalibrationInput = {
  fixture: Fixture;
  prediction?: {
    label?: string;
    prediction?: string;
    pick?: TipPick | "review";
    confidence?: number;
  };
  accuracy?: ResultAccuracy;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function fixtureLabel(fixture: Fixture): string {
  return `${fixture.homeTeam} vs ${fixture.awayTeam}`;
}

function outcomeLabel(outcome: unknown): string {
  const text = String(outcome ?? "pending");
  if (text === "home") return "Home";
  if (text === "away") return "Away";
  if (text === "draw") return "Draw";
  if (text === "review") return "Review";
  return text;
}

function predictionLabel(item: AdvancedDataCalibrationInput): string {
  return String(item.prediction?.label ?? item.prediction?.prediction ?? item.prediction?.pick ?? "No prediction");
}

function getGateResult(item: AdvancedDataCalibrationInput): AdvancedDataGateResult {
  return buildAdvancedDataGate({ fixture: item.fixture, prediction: item.prediction });
}

function getImpactSignals(items: AdvancedDataCalibrationInput[]): AdvancedImpactSignal[] {
  return buildAdvancedEvidenceImpactSummary(items.map((item) => ({ fixture: item.fixture, prediction: item.prediction }))).topSignals;
}

function categoryFromSignal(signal: AdvancedImpactSignal): string {
  const category = signal.category.toLowerCase();
  if (category.includes("xg")) return "xG";
  if (category.includes("fatigue")) return "Fatigue";
  if (category.includes("market")) return "Market movement";
  if (category.includes("player")) return "Player impact";
  if (category.includes("discipline")) return "Discipline";
  if (category.includes("set")) return "Set pieces";
  if (category.includes("schedule")) return "Schedule strength";
  return signal.category;
}

function buildCategoryBreakdown(examples: AdvancedDataCalibrationExample[]): AdvancedDataCalibrationCategory[] {
  const categories = Array.from(new Set(examples.map((example) => example.category))).sort();
  return categories.map((category) => {
    const scoped = examples.filter((example) => example.category === category);
    const correctCount = scoped.filter((example) => example.result === "helped" || example.result === "warned-correctly").length;
    const missedCount = scoped.filter((example) => example.result === "missed" || example.result === "false-warning").length;
    const hitRatePct = pct(correctCount, correctCount + missedCount);
    return {
      category,
      sampleSize: scoped.length,
      correctCount,
      missedCount,
      hitRatePct,
      note:
        scoped.length < 5
          ? "Needs more settled examples before tuning from this category."
          : hitRatePct >= 60
            ? "Promising signal; consider controlled weighting only after more review."
            : "Mixed/weak signal; keep advisory until evidence improves.",
    };
  });
}

function gradeFromSummary(settledCount: number, hitRate: number, missRate: number, gateDataCount: number): AdvancedDataCalibrationGrade {
  if (settledCount < 8 || gateDataCount < 5) return "needs-data";
  if (hitRate >= 60 && missRate >= 55) return "promising";
  if (hitRate >= 45 || missRate >= 45) return "mixed";
  return "weak";
}

function recommendationForGrade(grade: AdvancedDataCalibrationGrade): string {
  if (grade === "promising") {
    return "Advanced data is showing useful settled-result signals. Keep it conservative, but consider testing a small sandbox weight in the next tuning cycle.";
  }
  if (grade === "mixed") {
    return "Advanced data is useful for review flags, but not consistent enough for stronger live scoring yet. Keep collecting results and use the P31 sandbox before applying any weight.";
  }
  if (grade === "weak") {
    return "Advanced signals are not yet improving review quality. Leave P44 advisory-only and review imported data quality before weighting them.";
  }
  return "Not enough settled advanced-evidence examples yet. Keep importing advanced fields and review again after more final results.";
}

export function summariseAdvancedDataCalibration(items: AdvancedDataCalibrationInput[]): AdvancedDataCalibrationSummary {
  const settled = items.filter((item) => item.accuracy?.isSettled);
  const gateResults = items.map((item) => ({ item, gate: getGateResult(item) }));
  const gateWithData = gateResults.filter(({ gate }) => gate.signalCount > 0);

  const supportsSettled = gateResults.filter(({ item, gate }) => item.accuracy?.isSettled && gate.verdict === "supports" && item.accuracy.isTipPublished);
  const supportsCorrect = supportsSettled.filter(({ item }) => item.accuracy?.isCorrect === true).length;

  const weakensSettled = gateResults.filter(({ item, gate }) => item.accuracy?.isSettled && (gate.verdict === "weakens" || gate.verdict === "review") && item.accuracy.isTipPublished);
  const weakensMissed = weakensSettled.filter(({ item }) => item.accuracy?.isCorrect === false).length;

  const impactSignals = getImpactSignals(items);
  const examples: AdvancedDataCalibrationExample[] = [];

  for (const signal of impactSignals) {
    const source = items.find((item) => item.fixture.id === signal.fixtureId);
    if (!source?.accuracy?.isSettled) continue;
    const gate = gateResults.find(({ item }) => item.fixture.id === signal.fixtureId)?.gate;
    const isCorrect = source.accuracy.isCorrect;
    const warningLike = signal.direction === "volatility" || signal.direction === "draw-risk" || gate?.verdict === "weakens" || gate?.verdict === "review";
    examples.push({
      fixtureId: signal.fixtureId,
      fixtureLabel: signal.fixtureLabel,
      category: categoryFromSignal(signal),
      signal: signal.title,
      gateVerdict: gate?.verdict ?? "unknown",
      prediction: predictionLabel(source),
      actualOutcome: outcomeLabel(source.accuracy.actualOutcome),
      result: warningLike
        ? isCorrect === false
          ? "warned-correctly"
          : "false-warning"
        : isCorrect === true
          ? "helped"
          : isCorrect === false
            ? "missed"
            : "review-only",
    });
  }

  const supportiveSignalSampleSize = supportsSettled.length;
  const supportiveSignalHitRatePct = pct(supportsCorrect, supportiveSignalSampleSize);
  const warningSignalSampleSize = weakensSettled.length;
  const warningSignalMissRatePct = pct(weakensMissed, warningSignalSampleSize);
  const grade = gradeFromSummary(settled.length, supportiveSignalHitRatePct, warningSignalMissRatePct, gateWithData.length);

  return {
    fixtureCount: items.length,
    settledFixtureCount: settled.length,
    fixturesWithAdvancedGateData: gateWithData.length,
    supportiveSignalSampleSize,
    supportiveSignalHitRatePct,
    warningSignalSampleSize,
    warningSignalMissRatePct,
    reviewGateCount: gateResults.filter(({ gate }) => gate.verdict === "review").length,
    supportsGateHitRatePct: supportiveSignalHitRatePct,
    weakensGateMissRatePct: warningSignalMissRatePct,
    categoryBreakdown: buildCategoryBreakdown(examples),
    examples: examples.slice(0, 12),
    grade,
    recommendation: recommendationForGrade(grade),
    notes: [
      "P45 reviews advanced-data usefulness only; it does not auto-retune the model.",
      "Small samples should stay advisory until more final results are entered.",
      "Use this panel with P31/P32 sandbox presets before changing live weights.",
    ],
  };
}
