import { PersistedAppState } from "./workspace";

export type WorkspacePreservationMetrics = {
  fixtureCount: number;
  competitionCount: number;
  finalFixtureCount: number;
  userTipCount: number;
  entrantCount: number;
  aliasCount: number;
  tuningPresetCount: number;
  modelChangeLogCount: number;
  savedAtMs: number;
  richnessScore: number;
};

function safeDateMs(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getWorkspacePreservationMetrics(state: PersistedAppState): WorkspacePreservationMetrics {
  const competitions = new Set(
    state.fixtures.map((fixture) => fixture.competition.trim()).filter(Boolean),
  );
  const finalFixtureCount = state.fixtures.filter((fixture) => fixture.matchResult.status === "final").length;
  const userTipCount = state.userTips?.length ?? 0;
  const entrantCount = state.entrants?.length ?? 0;
  const aliasCount = state.teamAliases?.length ?? 0;
  const tuningPresetCount = state.tuningPresets?.length ?? 0;
  const modelChangeLogCount = state.modelChangeLog?.length ?? 0;
  const savedAtMs = safeDateMs(state.savedAt);

  return {
    fixtureCount: state.fixtures.length,
    competitionCount: competitions.size,
    finalFixtureCount,
    userTipCount,
    entrantCount,
    aliasCount,
    tuningPresetCount,
    modelChangeLogCount,
    savedAtMs,
    richnessScore:
      state.fixtures.length * 100 +
      competitions.size * 150 +
      finalFixtureCount * 40 +
      userTipCount * 20 +
      entrantCount * 5 +
      aliasCount * 5 +
      tuningPresetCount * 25 +
      modelChangeLogCount * 15 +
      Math.min(savedAtMs / 1_000_000_000_000, 10),
  };
}

export function describeWorkspaceMetrics(metrics: WorkspacePreservationMetrics): string {
  return `${metrics.fixtureCount} fixtures, ${metrics.competitionCount} competitions, ${metrics.userTipCount} tips, ${metrics.tuningPresetCount} presets, ${metrics.modelChangeLogCount} model-log entries`;
}

export function shouldBlockWeakerWorkspaceOverwrite(incoming: PersistedAppState, existing: PersistedAppState): boolean {
  const incomingMetrics = getWorkspacePreservationMetrics(incoming);
  const existingMetrics = getWorkspacePreservationMetrics(existing);

  if (incomingMetrics.fixtureCount === 0 && existingMetrics.fixtureCount > 0) return true;
  if (incomingMetrics.competitionCount === 0 && existingMetrics.competitionCount > 0) return true;

  const fixtureDrop = existingMetrics.fixtureCount - incomingMetrics.fixtureCount;
  const competitionDrop = existingMetrics.competitionCount - incomingMetrics.competitionCount;
  const tipDrop = existingMetrics.userTipCount - incomingMetrics.userTipCount;

  if (fixtureDrop >= 2 && competitionDrop >= 1) return true;
  if (competitionDrop >= 1 && tipDrop > 0) return true;

  return incomingMetrics.richnessScore + 150 < existingMetrics.richnessScore;
}

export function chooseSaferWorkspaceState(localState: PersistedAppState | null, cloudState: PersistedAppState | null): PersistedAppState | null {
  if (!localState) return cloudState;
  if (!cloudState) return localState;

  const localMetrics = getWorkspacePreservationMetrics(localState);
  const cloudMetrics = getWorkspacePreservationMetrics(cloudState);

  if (localMetrics.richnessScore !== cloudMetrics.richnessScore) {
    return localMetrics.richnessScore > cloudMetrics.richnessScore ? localState : cloudState;
  }

  return localMetrics.savedAtMs >= cloudMetrics.savedAtMs ? localState : cloudState;
}
