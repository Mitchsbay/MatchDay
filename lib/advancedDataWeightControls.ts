import type { Fixture } from "./sampleData";
import { buildAdvancedDataGate, type AdvancedDataGateResult } from "./advancedDataGate";
import type { PredictionResult, RuleWeights } from "./scoringEngine";

export type AdvancedDataInfluenceMode = "review-only" | "confidence-only";

export type AdvancedDataWeightControls = {
  enabled: boolean;
  mode: AdvancedDataInfluenceMode;
  maxConfidenceAdjustment: number;
  minimumSignalsRequired: number;
  allowReviewEscalation: boolean;
};

export type AdvancedDataIntegrationResult = {
  fixtureId: string;
  gateResult: AdvancedDataGateResult;
  settings: AdvancedDataWeightControls;
  applied: boolean;
  appliedAdjustment: number;
  originalConfidence: number;
  adjustedConfidence: number;
  reviewEscalated: boolean;
  notes: string[];
};

export type AdvancedDataIntegrationSummary = {
  fixtureCount: number;
  mode: AdvancedDataInfluenceMode;
  enabled: boolean;
  adjustedFixtureCount: number;
  reviewEscalationCount: number;
  averageAppliedAdjustment: number;
  maxConfidenceAdjustment: number;
  minimumSignalsRequired: number;
  topResults: AdvancedDataIntegrationResult[];
  notes: string[];
};

export const defaultAdvancedDataWeightControls: AdvancedDataWeightControls = {
  enabled: false,
  mode: "review-only",
  maxConfidenceAdjustment: 4,
  minimumSignalsRequired: 2,
  allowReviewEscalation: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normaliseAdvancedDataWeightControls(
  controls?: Partial<AdvancedDataWeightControls>,
): AdvancedDataWeightControls {
  const merged = { ...defaultAdvancedDataWeightControls, ...(controls ?? {}) };
  const maxConfidenceAdjustment = clamp(
    Number.isFinite(merged.maxConfidenceAdjustment) ? merged.maxConfidenceAdjustment : defaultAdvancedDataWeightControls.maxConfidenceAdjustment,
    0,
    8,
  );
  const minimumSignalsRequired = Math.round(
    clamp(
      Number.isFinite(merged.minimumSignalsRequired) ? merged.minimumSignalsRequired : defaultAdvancedDataWeightControls.minimumSignalsRequired,
      1,
      6,
    ),
  );
  return {
    enabled: Boolean(merged.enabled),
    mode: merged.enabled ? "confidence-only" : "review-only",
    maxConfidenceAdjustment,
    minimumSignalsRequired,
    allowReviewEscalation: Boolean(merged.allowReviewEscalation),
  };
}

export function cloneAdvancedDataWeightControls(
  controls?: Partial<AdvancedDataWeightControls>,
): AdvancedDataWeightControls {
  return { ...normaliseAdvancedDataWeightControls(controls) };
}

export function isAdvancedDataWeightControls(value: unknown): value is AdvancedDataWeightControls {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdvancedDataWeightControls>;
  return (
    typeof candidate.enabled === "boolean" &&
    (candidate.mode === "review-only" || candidate.mode === "confidence-only") &&
    typeof candidate.maxConfidenceAdjustment === "number" &&
    typeof candidate.minimumSignalsRequired === "number" &&
    typeof candidate.allowReviewEscalation === "boolean"
  );
}

function gateAdjustment(gateResult: AdvancedDataGateResult, controls: AdvancedDataWeightControls): number {
  if (gateResult.signalCount < controls.minimumSignalsRequired) return 0;
  if (gateResult.verdict === "insufficient-data") return 0;
  const capped = clamp(gateResult.confidenceAdjustment, -controls.maxConfidenceAdjustment, controls.maxConfidenceAdjustment);
  return round1(capped);
}

export function applyAdvancedDataWeightControls(args: {
  fixture: Fixture;
  prediction: PredictionResult;
  controls?: Partial<AdvancedDataWeightControls>;
  weights?: Partial<RuleWeights>;
}): { prediction: PredictionResult; integration: AdvancedDataIntegrationResult } {
  const settings = normaliseAdvancedDataWeightControls(args.controls);
  const gateResult = buildAdvancedDataGate({ fixture: args.fixture, prediction: args.prediction });
  const originalConfidence = args.prediction.confidence;
  const notes: string[] = [];

  if (!settings.enabled) {
    notes.push("Advanced data remains review-only. No live confidence adjustment was applied.");
    return {
      prediction: args.prediction,
      integration: {
        fixtureId: args.fixture.id,
        gateResult,
        settings,
        applied: false,
        appliedAdjustment: 0,
        originalConfidence,
        adjustedConfidence: originalConfidence,
        reviewEscalated: false,
        notes,
      },
    };
  }

  const appliedAdjustment = gateAdjustment(gateResult, settings);
  if (gateResult.signalCount < settings.minimumSignalsRequired) {
    notes.push(`Advanced data had ${gateResult.signalCount} signal(s); at least ${settings.minimumSignalsRequired} are required before confidence can move.`);
  }
  if (appliedAdjustment === 0 && gateResult.signalCount >= settings.minimumSignalsRequired) {
    notes.push("Advanced data was available, but the capped adjustment was neutral.");
  }

  const adjustedConfidence = Math.round(clamp(originalConfidence + appliedAdjustment, 0, 100));
  const minimumPublishConfidence = args.weights?.minimumPublishConfidence ?? 50;
  const shouldEscalateForReview =
    settings.allowReviewEscalation &&
    (gateResult.verdict === "review" || adjustedConfidence < minimumPublishConfidence);

  const warnings = [...args.prediction.warnings];
  if (appliedAdjustment !== 0) {
    warnings.push(
      `Advanced Data Gate adjusted confidence ${appliedAdjustment > 0 ? "+" : ""}${appliedAdjustment} point(s) only; match edge and prediction side were not changed.`,
    );
  }
  if (shouldEscalateForReview && !args.prediction.reviewRequired) {
    warnings.push("Advanced Data Gate escalated this fixture to review without changing the predicted side.");
  }

  const prediction: PredictionResult = {
    ...args.prediction,
    confidence: adjustedConfidence,
    reviewRequired: args.prediction.reviewRequired || shouldEscalateForReview,
    gateStatus: args.prediction.reviewRequired || shouldEscalateForReview ? "review" : args.prediction.gateStatus,
    prediction:
      shouldEscalateForReview && args.prediction.prediction !== "Draw / Low Confidence"
        ? "Review Required"
        : args.prediction.prediction,
    warnings,
  };

  if (settings.mode === "confidence-only") {
    notes.push("Advanced data is enabled in confidence-only mode. It cannot alter home/draw/away edge or override core gates.");
  }

  return {
    prediction,
    integration: {
      fixtureId: args.fixture.id,
      gateResult,
      settings,
      applied: appliedAdjustment !== 0,
      appliedAdjustment,
      originalConfidence,
      adjustedConfidence,
      reviewEscalated: shouldEscalateForReview && !args.prediction.reviewRequired,
      notes,
    },
  };
}

export function summariseAdvancedDataIntegration(
  integrations: AdvancedDataIntegrationResult[],
  controls?: Partial<AdvancedDataWeightControls>,
): AdvancedDataIntegrationSummary {
  const settings = normaliseAdvancedDataWeightControls(controls);
  const adjusted = integrations.filter((item) => item.applied);
  const averageAppliedAdjustment = adjusted.length
    ? round1(adjusted.reduce((sum, item) => sum + item.appliedAdjustment, 0) / adjusted.length)
    : 0;
  const topResults = [...integrations]
    .filter((item) => item.applied || item.reviewEscalated || item.gateResult.verdict === "review")
    .sort((a, b) => Math.abs(b.appliedAdjustment) - Math.abs(a.appliedAdjustment) || b.gateResult.signalCount - a.gateResult.signalCount)
    .slice(0, 12);

  return {
    fixtureCount: integrations.length,
    mode: settings.mode,
    enabled: settings.enabled,
    adjustedFixtureCount: adjusted.length,
    reviewEscalationCount: integrations.filter((item) => item.reviewEscalated).length,
    averageAppliedAdjustment,
    maxConfidenceAdjustment: settings.maxConfidenceAdjustment,
    minimumSignalsRequired: settings.minimumSignalsRequired,
    topResults,
    notes: [
      settings.enabled
        ? "P46 confidence-only integration is enabled. Advanced data may move confidence within the cap, but it cannot change the predicted side."
        : "P46 is review-only by default. Enable the toggle only after calibration supports using advanced evidence live.",
      "Guardrails: minimum signal count, confidence cap, no home/draw/away edge changes, and optional review escalation.",
    ],
  };
}
