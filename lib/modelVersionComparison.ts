import type { Fixture } from "./sampleData";
import { defaultRuleWeights, ruleWeightDefinitions, type RuleWeights } from "./scoringEngine";
import type { ModelChangeLogEntry } from "./modelChangeLog";
import type { TuningPreset } from "./tuningPresets";
import { summariseTuningSandbox, type TuningSandboxComparison } from "./tuningSandbox";

export type ModelVersionComparisonTargetType = "default" | "change-log-before" | "change-log-after" | "preset";

export type ModelVersionComparisonTarget = {
  id: string;
  label: string;
  type: ModelVersionComparisonTargetType;
  weights: RuleWeights;
  sourceDescription: string;
};

export type ModelWeightDifference = {
  key: keyof RuleWeights;
  label: string;
  currentValue: number;
  comparisonValue: number;
  delta: number;
  direction: "increased" | "decreased" | "unchanged";
  affectedGate: string;
};

export type ModelVersionComparisonSummary = {
  target: ModelVersionComparisonTarget;
  changedWeights: ModelWeightDifference[];
  changedWeightCount: number;
  largestChange: ModelWeightDifference | null;
  performance: TuningSandboxComparison;
  warnings: string[];
  evidence: string[];
};

const definitionMap = new Map(ruleWeightDefinitions.map((definition) => [definition.key, definition]));

function cloneWeights(weights: RuleWeights): RuleWeights {
  return { ...defaultRuleWeights, ...weights };
}

function affectedGateForKey(key: keyof RuleWeights): string {
  if (key === "qualityGap") return "Quality Gate";
  if (key === "homeAdvantage") return "Home Advantage";
  if (key === "recentFormGap") return "Form Gate";
  if (key === "headToHeadEdge") return "Head-to-Head";
  if (key === "injuryRisk") return "Availability Gate";
  if (key === "motivationEdge") return "Context Gate";
  if (key === "otherStatsEdge") return "Other Stats";
  if (key === "oddsSupport") return "Odds Gate";
  if (key === "conflictScore" || key === "confidenceConflictPenalty" || key === "reviewConflictThreshold" || key === "reviewFailedGateThreshold") return "Conflict / Review Gate";
  if (key === "confidenceEdgeMultiplier" || key === "minimumPublishConfidence") return "Confidence / Publish Gate";
  return "Model Setting";
}

export function buildModelVersionComparisonTargets(args: {
  changeLog: ModelChangeLogEntry[];
  presets: TuningPreset[];
}): ModelVersionComparisonTarget[] {
  const targets: ModelVersionComparisonTarget[] = [
    {
      id: "default",
      label: "Default model weights",
      type: "default",
      weights: cloneWeights(defaultRuleWeights),
      sourceDescription: "Original built-in default weights.",
    },
  ];

  for (const entry of args.changeLog.slice(0, 12)) {
    targets.push({
      id: `change-before-${entry.id}`,
      label: `Before: ${entry.label}`,
      type: "change-log-before",
      weights: cloneWeights(entry.beforeWeights),
      sourceDescription: `${entry.reason} · ${new Date(entry.createdAt).toLocaleString()}`,
    });
    targets.push({
      id: `change-after-${entry.id}`,
      label: `After: ${entry.label}`,
      type: "change-log-after",
      weights: cloneWeights(entry.afterWeights),
      sourceDescription: `${entry.reason} · ${new Date(entry.createdAt).toLocaleString()}`,
    });
  }

  for (const preset of args.presets) {
    targets.push({
      id: `preset-${preset.id}`,
      label: `Preset: ${preset.name}`,
      type: "preset",
      weights: cloneWeights(preset.weights),
      sourceDescription: preset.description || `Updated ${new Date(preset.updatedAt).toLocaleString()}`,
    });
  }

  return targets;
}

export function summariseModelVersionComparison(args: {
  fixtures: Fixture[];
  currentWeights: RuleWeights;
  comparisonWeights: RuleWeights;
  target: ModelVersionComparisonTarget;
}): ModelVersionComparisonSummary {
  const currentWeights = cloneWeights(args.currentWeights);
  const comparisonWeights = cloneWeights(args.comparisonWeights);
  const changedWeights = (Object.keys(currentWeights) as Array<keyof RuleWeights>)
    .map((key) => {
      const currentValue = currentWeights[key];
      const comparisonValue = comparisonWeights[key];
      const delta = Number((currentValue - comparisonValue).toFixed(2));
      const definition = definitionMap.get(key);
      return {
        key,
        label: definition?.label ?? String(key),
        currentValue,
        comparisonValue,
        delta,
        direction: delta > 0 ? "increased" as const : delta < 0 ? "decreased" as const : "unchanged" as const,
        affectedGate: affectedGateForKey(key),
      };
    })
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || String(a.key).localeCompare(String(b.key)));

  const performance = summariseTuningSandbox({
    fixtures: args.fixtures,
    baselineWeights: comparisonWeights,
    sandboxWeights: currentWeights,
  });
  const largestChange = changedWeights[0] ?? null;
  const warnings: string[] = [];
  if (performance.settledFixtures < 10) warnings.push("Version comparison is provisional until at least 10 settled fixtures exist.");
  if (changedWeights.length === 0) warnings.push("Current live weights match the selected comparison target.");
  if (performance.hitRateDelta < 0) warnings.push("Current live weights perform worse than the comparison target on the selected settled results.");
  if (performance.sandbox.highConfidenceMisses > performance.baseline.highConfidenceMisses) warnings.push("Current live weights create more high-confidence misses than the comparison target.");

  return {
    target: args.target,
    changedWeights,
    changedWeightCount: changedWeights.length,
    largestChange,
    performance,
    warnings,
    evidence: [
      `Comparison target: ${args.target.label}.`,
      `Changed weight keys: ${changedWeights.length}.`,
      `Prediction labels changed on ${performance.predictionChanges} fixture(s).`,
      `Publish/review status changed on ${performance.publishStatusChanges} fixture(s).`,
      "P34 is read-only; it compares versions but does not change live weights.",
    ],
  };
}
