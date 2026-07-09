import { LocalWorkspaceCandidate, PersistedAppState } from "./workspace";
import { WorkspaceRecoverySnapshot } from "./workspaceBackupVault";
import {
  WorkspacePreservationMetrics,
  describeWorkspaceMetrics,
  getWorkspacePreservationMetrics,
} from "./workspacePreservation";

export type WorkspaceRestoreSourceType = "current" | "cloud" | "local" | "recovery";

export type WorkspaceRestoreCandidate = {
  id: string;
  label: string;
  sourceType: WorkspaceRestoreSourceType;
  state: PersistedAppState;
  metrics: WorkspacePreservationMetrics;
  lastUpdatedMs: number;
  warnings: string[];
  recommendation: "recommended" | "safe" | "review" | "avoid";
};

export type WorkspaceRestoreResolverSummary = {
  candidates: WorkspaceRestoreCandidate[];
  recommendedCandidateId: string | null;
  recommendedLabel: string;
  summaryMessage: string;
  warnings: string[];
};

function savedAtMs(state: PersistedAppState): number {
  const parsed = Date.parse(state.savedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidateWarnings(state: PersistedAppState, metrics: WorkspacePreservationMetrics): string[] {
  const warnings: string[] = [];
  if (metrics.fixtureCount === 0) warnings.push("No fixtures saved in this copy.");
  if (metrics.competitionCount === 0) warnings.push("No competitions found in this copy.");
  if (metrics.userTipCount === 0) warnings.push("No entrant tips saved in this copy.");
  if ((state.teamAliases?.length ?? 0) === 0) warnings.push("No team alias rules saved in this copy.");
  if (!state.savedAt || savedAtMs(state) === 0) warnings.push("Missing or invalid savedAt timestamp.");
  return warnings;
}

function makeCandidate(
  id: string,
  label: string,
  sourceType: WorkspaceRestoreSourceType,
  state: PersistedAppState,
): WorkspaceRestoreCandidate {
  const metrics = getWorkspacePreservationMetrics(state);
  const warnings = candidateWarnings(state, metrics);
  return {
    id,
    label,
    sourceType,
    state,
    metrics,
    lastUpdatedMs: savedAtMs(state),
    warnings,
    recommendation: warnings.some((warning) => warning.includes("No fixtures") || warning.includes("No competitions"))
      ? "avoid"
      : warnings.length
        ? "review"
        : "safe",
  };
}

export function buildWorkspaceRestoreResolverSummary(args: {
  currentState: PersistedAppState;
  cloudState: PersistedAppState | null;
  localCandidates: LocalWorkspaceCandidate[];
  recoverySnapshots: WorkspaceRecoverySnapshot[];
}): WorkspaceRestoreResolverSummary {
  const candidates: WorkspaceRestoreCandidate[] = [
    makeCandidate("current", "Current browser workspace", "current", args.currentState),
  ];

  if (args.cloudState) {
    candidates.push(makeCandidate("cloud", "Supabase cloud workspace", "cloud", args.cloudState));
  }

  args.localCandidates.slice(0, 8).forEach((candidate, index) => {
    candidates.push(makeCandidate(`local-${index}-${candidate.key}`, `Browser backup: ${candidate.key}`, "local", candidate.state));
  });

  args.recoverySnapshots.slice(0, 8).forEach((snapshot) => {
    candidates.push(makeCandidate(`recovery-${snapshot.id}`, `Recovery vault: ${snapshot.label}`, "recovery", snapshot.state));
  });

  const uniqueByShape = new Map<string, WorkspaceRestoreCandidate>();
  candidates.forEach((candidate) => {
    const key = [
      candidate.sourceType,
      candidate.metrics.fixtureCount,
      candidate.metrics.competitionCount,
      candidate.metrics.userTipCount,
      candidate.metrics.tuningPresetCount,
      candidate.metrics.modelChangeLogCount,
      candidate.lastUpdatedMs,
    ].join("::");
    if (!uniqueByShape.has(key)) uniqueByShape.set(key, candidate);
  });

  const deduped = Array.from(uniqueByShape.values()).sort((a, b) => {
    if (b.metrics.richnessScore !== a.metrics.richnessScore) return b.metrics.richnessScore - a.metrics.richnessScore;
    return b.lastUpdatedMs - a.lastUpdatedMs;
  });

  const recommended = deduped.find((candidate) => candidate.recommendation !== "avoid") ?? deduped[0] ?? null;
  const finalCandidates = deduped.map((candidate) => ({
    ...candidate,
    recommendation: recommended && candidate.id === recommended.id ? "recommended" as const : candidate.recommendation,
  }));

  const weakestCurrentWarning = recommended && recommended.id !== "current"
    ? [`A non-current copy looks safer/richer than the current browser workspace: ${recommended.label}. Review before saving over it.`]
    : [];

  return {
    candidates: finalCandidates,
    recommendedCandidateId: recommended?.id ?? null,
    recommendedLabel: recommended ? `${recommended.label} — ${describeWorkspaceMetrics(recommended.metrics)}` : "No valid restore candidates found.",
    summaryMessage: recommended
      ? `Recommended restore source: ${recommended.label}. ${describeWorkspaceMetrics(recommended.metrics)}.`
      : "No valid workspace copies were available for comparison.",
    warnings: [...weakestCurrentWarning],
  };
}
