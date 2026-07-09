import type { Fixture } from "./sampleData";
import type { PredictionResult, ResultAccuracy } from "./scoringEngine";
import type { AdvancedDataGateVerdict } from "./advancedDataGate";
import type { AdvancedDataIntegrationResult, AdvancedDataWeightControls } from "./advancedDataWeightControls";

export type AdvancedDataSandboxOutcome = {
  fixtureId: string;
  fixtureLabel: string;
  baselinePrediction: string;
  proposedPrediction: string;
  actualOutcome: string;
  baselineCorrect: boolean | null;
  proposedCorrect: boolean | null;
  baselinePublished: boolean;
  proposedPublished: boolean;
  confidenceDelta: number;
  appliedAdjustment: number;
  reviewEscalated: boolean;
  gateVerdict: AdvancedDataGateVerdict;
  signalCount: number;
  note: string;
};

export type AdvancedDataWeightSandboxSummary = {
  fixtureCount: number;
  settledFixtureCount: number;
  proposedEnabled: boolean;
  maxConfidenceAdjustment: number;
  minimumSignalsRequired: number;
  baselinePublishedCount: number;
  proposedPublishedCount: number;
  baselineCorrectCount: number;
  proposedCorrectCount: number;
  baselineHitRatePct: number;
  proposedHitRatePct: number;
  netCorrectDelta: number;
  confidenceMovedCount: number;
  averageConfidenceDelta: number;
  reviewEscalationCount: number;
  protectedMissCount: number;
  blockedCorrectTipCount: number;
  status: "needs-data" | "favourable" | "mixed" | "unfavourable";
  recommendation: string;
  outcomes: AdvancedDataSandboxOutcome[];
  notes: string[];
};

export type AdvancedDataSandboxComparisonInput = {
  fixture: Fixture;
  baselinePrediction: PredictionResult;
  baselineAccuracy: ResultAccuracy;
  baselineIntegration: AdvancedDataIntegrationResult;
  proposedPrediction: PredictionResult;
  proposedAccuracy: ResultAccuracy;
  proposedIntegration: AdvancedDataIntegrationResult;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function labelActual(outcome: unknown): string {
  const text = String(outcome ?? "pending");
  if (text === "home") return "Home";
  if (text === "away") return "Away";
  if (text === "draw") return "Draw";
  return text;
}

function isPublishedTip(accuracy: ResultAccuracy): boolean {
  return Boolean(accuracy.isTipPublished && accuracy.isSettled);
}

function sandboxStatus(args: {
  settled: number;
  netCorrectDelta: number;
  protectedMissCount: number;
  blockedCorrectTipCount: number;
}): AdvancedDataWeightSandboxSummary["status"] {
  if (args.settled < 8) return "needs-data";
  if (args.netCorrectDelta > 0 && args.blockedCorrectTipCount <= args.protectedMissCount) return "favourable";
  if (args.netCorrectDelta < 0 || args.blockedCorrectTipCount > args.protectedMissCount) return "unfavourable";
  return "mixed";
}

function recommendationForStatus(status: AdvancedDataWeightSandboxSummary["status"]): string {
  if (status === "favourable") {
    return "Sandbox results are favourable. Keep the P46 cap conservative and continue monitoring before increasing advanced-data influence.";
  }
  if (status === "mixed") {
    return "Sandbox results are mixed. Keep advanced data review-first and use it mainly for confidence/review decisions until more settled fixtures confirm the pattern.";
  }
  if (status === "unfavourable") {
    return "Sandbox results do not support live confidence influence yet. Disable the P46 toggle and investigate source quality/provenance before using advanced data live.";
  }
  return "Not enough settled fixtures yet. Keep collecting results and use this panel as a pre-apply check before trusting the P46 toggle.";
}

export function summariseAdvancedDataWeightSandbox(
  inputs: AdvancedDataSandboxComparisonInput[],
  controls: AdvancedDataWeightControls,
): AdvancedDataWeightSandboxSummary {
  const settled = inputs.filter((item) => item.baselineAccuracy.isSettled || item.proposedAccuracy.isSettled);
  const baselinePublished = settled.filter((item) => isPublishedTip(item.baselineAccuracy));
  const proposedPublished = settled.filter((item) => isPublishedTip(item.proposedAccuracy));
  const baselineCorrectCount = baselinePublished.filter((item) => item.baselineAccuracy.isCorrect === true).length;
  const proposedCorrectCount = proposedPublished.filter((item) => item.proposedAccuracy.isCorrect === true).length;
  const confidenceMoved = inputs.filter((item) => item.proposedIntegration.applied);
  const reviewEscalations = inputs.filter((item) => item.proposedIntegration.reviewEscalated);

  const protectedMissCount = reviewEscalations.filter(
    (item) => item.baselineAccuracy.isSettled && item.baselineAccuracy.isTipPublished && item.baselineAccuracy.isCorrect === false,
  ).length;
  const blockedCorrectTipCount = reviewEscalations.filter(
    (item) => item.baselineAccuracy.isSettled && item.baselineAccuracy.isTipPublished && item.baselineAccuracy.isCorrect === true,
  ).length;

  const netCorrectDelta = proposedCorrectCount - baselineCorrectCount;
  const averageConfidenceDelta = confidenceMoved.length
    ? round1(confidenceMoved.reduce((sum, item) => sum + (item.proposedPrediction.confidence - item.baselinePrediction.confidence), 0) / confidenceMoved.length)
    : 0;
  const status = sandboxStatus({
    settled: settled.length,
    netCorrectDelta,
    protectedMissCount,
    blockedCorrectTipCount,
  });

  const outcomes = inputs
    .filter(
      (item) =>
        item.proposedIntegration.applied ||
        item.proposedIntegration.reviewEscalated ||
        item.proposedIntegration.gateResult.verdict === "review" ||
        item.baselineAccuracy.isSettled,
    )
    .map((item) => {
      const confidenceDelta = item.proposedPrediction.confidence - item.baselinePrediction.confidence;
      const baselineCorrect = item.baselineAccuracy.isSettled ? item.baselineAccuracy.isCorrect : null;
      const proposedCorrect = item.proposedAccuracy.isSettled ? item.proposedAccuracy.isCorrect : null;
      let note = "No meaningful sandbox difference.";
      if (item.proposedIntegration.reviewEscalated && baselineCorrect === false) note = "Would have protected against a missed published tip by escalating to review.";
      else if (item.proposedIntegration.reviewEscalated && baselineCorrect === true) note = "Would have blocked a correct published tip for review.";
      else if (item.proposedIntegration.applied) note = "Would have moved confidence only; prediction side remains unchanged.";
      else if (item.proposedIntegration.gateResult.verdict === "review") note = "Advanced gate still recommends review, but guardrails prevented a live move.";
      return {
        fixtureId: item.fixture.id,
        fixtureLabel: `${item.fixture.homeTeam} vs ${item.fixture.awayTeam}`,
        baselinePrediction: item.baselinePrediction.prediction,
        proposedPrediction: item.proposedPrediction.prediction,
        actualOutcome: labelActual(item.baselineAccuracy.actualOutcome),
        baselineCorrect,
        proposedCorrect,
        baselinePublished: isPublishedTip(item.baselineAccuracy),
        proposedPublished: isPublishedTip(item.proposedAccuracy),
        confidenceDelta,
        appliedAdjustment: item.proposedIntegration.appliedAdjustment,
        reviewEscalated: item.proposedIntegration.reviewEscalated,
        gateVerdict: item.proposedIntegration.gateResult.verdict,
        signalCount: item.proposedIntegration.gateResult.signalCount,
        note,
      };
    })
    .sort((a, b) => Math.abs(b.confidenceDelta) - Math.abs(a.confidenceDelta) || b.signalCount - a.signalCount)
    .slice(0, 12);

  return {
    fixtureCount: inputs.length,
    settledFixtureCount: settled.length,
    proposedEnabled: controls.enabled,
    maxConfidenceAdjustment: controls.maxConfidenceAdjustment,
    minimumSignalsRequired: controls.minimumSignalsRequired,
    baselinePublishedCount: baselinePublished.length,
    proposedPublishedCount: proposedPublished.length,
    baselineCorrectCount,
    proposedCorrectCount,
    baselineHitRatePct: pct(baselineCorrectCount, baselinePublished.length),
    proposedHitRatePct: pct(proposedCorrectCount, proposedPublished.length),
    netCorrectDelta,
    confidenceMovedCount: confidenceMoved.length,
    averageConfidenceDelta,
    reviewEscalationCount: reviewEscalations.length,
    protectedMissCount,
    blockedCorrectTipCount,
    status,
    recommendation: recommendationForStatus(status),
    outcomes,
    notes: [
      "P47 compares review-only baseline behaviour against the current P46 advanced-data settings before relying on them live.",
      "The sandbox measures confidence moves and review escalations only; advanced data still cannot change home/draw/away edge or tennis scoring.",
      "Treat small samples cautiously. A favourable sandbox should not automatically increase the confidence cap.",
    ],
  };
}
