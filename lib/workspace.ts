import { Fixture, TipPick } from "./sampleData";
import { cloneTeamAliases, TeamAliasRule } from "./teamAliases";
import { cloneAdvancedEvidence } from "./advancedEvidence";
import { cloneTuningPresets, TuningPreset } from "./tuningPresets";
import { cloneModelChangeLog, ModelChangeLogEntry } from "./modelChangeLog";
import type { WorkspaceRecoverySnapshot } from "./workspaceBackupVault";
import {
  cloneAdvancedDataWeightControls,
  defaultAdvancedDataWeightControls,
  isAdvancedDataWeightControls,
  type AdvancedDataWeightControls,
} from "./advancedDataWeightControls";
import {
  MatchResultInput,
  RuleWeights,
  emptyMatchContext,
  emptyMatchResult,
  emptyMissingPlayers,
  emptyOddsMarket,
  emptyRecentForm,
  emptyScores,
  emptyTeamContext,
  emptyTeamStats,
} from "./scoringEngine";

export const ALL_ROUNDS = "__all_rounds__";

export const STORAGE_KEY = "tipping-gates-app-p47-5-state-v1";
export const LEGACY_STORAGE_KEYS = [
  "tipping-gates-app-p47-4-state-v1",
  "tipping-gates-app-p47-2-state-v1",
  "tipping-gates-app-p47-state-v1",
  "tipping-gates-app-p46-state-v1",
  "tipping-gates-app-p44-state-v1",
  "tipping-gates-app-p43-state-v1",
  "tipping-gates-app-p42-state-v1",
  "tipping-gates-app-p41-state-v1",
  "tipping-gates-app-p40-state-v1",
  "tipping-gates-app-p39-state-v1",
  "tipping-gates-app-p38-state-v1",
  "tipping-gates-app-p37-1-state-v1",
  "tipping-gates-app-p37-state-v1",
  "tipping-gates-app-p36-state-v1",
  "tipping-gates-app-p35-state-v1",
  "tipping-gates-app-p34-state-v1",
  "tipping-gates-app-p33-state-v1",
  "tipping-gates-app-p32-state-v1",
  "tipping-gates-app-p31-state-v1",
  "tipping-gates-app-p30-state-v1",
  "tipping-gates-app-p29-state-v1",
  "tipping-gates-app-p28-state-v1",
  "tipping-gates-app-p27-state-v1",
  "tipping-gates-app-p26-state-v1",
  "tipping-gates-app-p25-state-v1",
  "tipping-gates-app-p24-3-state-v1",
  "tipping-gates-app-p24-2-state-v1",
  "tipping-gates-app-p24-state-v1",
  "tipping-gates-app-p23-state-v1",
  "tipping-gates-app-p22-state-v1",
  "tipping-gates-app-p21-state-v1",
  "tipping-gates-app-p20-state-v1",
  "tipping-gates-app-p16-state-v1",
  "tipping-gates-app-p15-state-v1",
  "tipping-gates-app-p14-state-v1",
  "tipping-gates-app-p13-state-v1",
  "tipping-gates-app-p12-state-v1",
  "tipping-gates-app-p11-state-v1",
];
export const CLOUD_WORKSPACE_ID_KEY = "tipping-gates-app-p47-5-cloud-workspace-id";
export const LEGACY_CLOUD_WORKSPACE_ID_KEYS = [
  "tipping-gates-app-p47-4-cloud-workspace-id",
  "tipping-gates-app-p47-2-cloud-workspace-id",
  "tipping-gates-app-p47-cloud-workspace-id",
  "tipping-gates-app-p46-cloud-workspace-id",
  "tipping-gates-app-p44-cloud-workspace-id",
  "tipping-gates-app-p43-cloud-workspace-id",
  "tipping-gates-app-p42-cloud-workspace-id",
  "tipping-gates-app-p41-cloud-workspace-id",
  "tipping-gates-app-p40-cloud-workspace-id",
  "tipping-gates-app-p39-cloud-workspace-id",
  "tipping-gates-app-p38-cloud-workspace-id",
  "tipping-gates-app-p37-1-cloud-workspace-id",
  "tipping-gates-app-p37-cloud-workspace-id",
  "tipping-gates-app-p36-cloud-workspace-id",
  "tipping-gates-app-p35-cloud-workspace-id",
  "tipping-gates-app-p34-cloud-workspace-id",
  "tipping-gates-app-p33-cloud-workspace-id",
  "tipping-gates-app-p32-cloud-workspace-id",
  "tipping-gates-app-p31-cloud-workspace-id",
  "tipping-gates-app-p30-cloud-workspace-id",
  "tipping-gates-app-p29-cloud-workspace-id",
  "tipping-gates-app-p28-cloud-workspace-id",
  "tipping-gates-app-p27-cloud-workspace-id",
  "tipping-gates-app-p26-cloud-workspace-id",
  "tipping-gates-app-p25-cloud-workspace-id",
  "tipping-gates-app-p24-3-cloud-workspace-id",
  "tipping-gates-app-p24-2-cloud-workspace-id",
  "tipping-gates-app-p24-cloud-workspace-id",
  "tipping-gates-app-p23-cloud-workspace-id",
  "tipping-gates-app-p22-cloud-workspace-id",
  "tipping-gates-app-p21-cloud-workspace-id",
  "tipping-gates-app-p20-cloud-workspace-id",
  "tipping-gates-app-p16-cloud-workspace-id",
  "tipping-gates-app-p15-cloud-workspace-id",
  "tipping-gates-app-p14-cloud-workspace-id",
  "tipping-gates-app-p13-cloud-workspace-id",
  "tipping-gates-app-p12-cloud-workspace-id",
  "tipping-gates-app-p11-cloud-workspace-id",
];

export type PersistedAppState = {
  version: string;
  savedAt: string;
  fixtures: Fixture[];
  activeFixtureId: string;
  selectedRound?: string;
  ruleWeights: RuleWeights;
  teamAliases?: TeamAliasRule[];
  tuningPresets?: TuningPreset[];
  modelChangeLog?: ModelChangeLogEntry[];
  advancedDataControls?: AdvancedDataWeightControls;
  // Optional and type-only imported (see below) to avoid a runtime circular
  // dependency: WorkspaceRecoverySnapshot.state is itself a PersistedAppState.
  // Deliberately NOT populated when building the state embedded inside an
  // individual snapshot (see createWorkspaceRecoverySnapshot call sites) —
  // only the top-level state written to localStorage's main key or mirrored
  // to Supabase carries the live vault, otherwise every snapshot would
  // recursively embed a copy of the entire vault including itself.
  recoverySnapshots?: WorkspaceRecoverySnapshot[];
};

export function normaliseRound(round: string): string {
  const trimmed = round.trim();
  return trimmed || "Unassigned";
}

export function cloneFixtures(fixtures: Fixture[]): Fixture[] {
  return dedupeFixturesByMatchKey(
    fixtures.map((fixture) => ({
      ...fixture,
      homeStats: { ...fixture.homeStats },
      awayStats: { ...fixture.awayStats },
      homeRecentForm: fixture.homeRecentForm.map((game) => ({ ...game })),
      awayRecentForm: fixture.awayRecentForm.map((game) => ({ ...game })),
      homeMissingPlayers: fixture.homeMissingPlayers.map((player) => ({
        ...player,
      })),
      awayMissingPlayers: fixture.awayMissingPlayers.map((player) => ({
        ...player,
      })),
      homeContext: { ...fixture.homeContext },
      awayContext: { ...fixture.awayContext },
      matchContext: { ...fixture.matchContext },
      oddsMarket: { ...fixture.oddsMarket },
      matchResult: { ...fixture.matchResult },
      scores: { ...fixture.scores },
      advancedEvidence: cloneAdvancedEvidence(fixture.advancedEvidence),
      betLog: fixture.betLog ? { ...fixture.betLog } : undefined,
    })),
  );
}

export function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedAppState>;
  return (
    Array.isArray(candidate.fixtures) &&
    typeof candidate.activeFixtureId === "string" &&
    !!candidate.ruleWeights &&
    typeof candidate.ruleWeights === "object" &&
    (!candidate.advancedDataControls || isAdvancedDataWeightControls(candidate.advancedDataControls))
  );
}


export type LocalWorkspaceCandidate = {
  key: string;
  state: PersistedAppState;
  fixtureCount: number;
  competitionCount: number;
  savedAtMs: number;
  score: number;
};

function getStateSavedAtMs(state: PersistedAppState): number {
  const parsed = Date.parse(state.savedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCompetitionCount(fixtures: Fixture[]): number {
  return new Set(fixtures.map((fixture) => fixture.competition.trim()).filter(Boolean)).size;
}

export function discoverLocalWorkspaceCandidates(storage: Storage): LocalWorkspaceCandidate[] {
  const orderedKeys = [
    STORAGE_KEY,
    ...LEGACY_STORAGE_KEYS,
    ...Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "").filter(
      (key) => key.startsWith("tipping-gates-app-") && key.includes("state"),
    ),
  ];
  const uniqueKeys = Array.from(new Set(orderedKeys.filter(Boolean)));

  return uniqueKeys.flatMap((key) => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedAppState(parsed)) return [];
      const state = parsed as PersistedAppState;
      const fixtureCount = state.fixtures.length;
      const competitionCount = getCompetitionCount(state.fixtures);
      const savedAtMs = getStateSavedAtMs(state);
      return [
        {
          key,
          state,
          fixtureCount,
          competitionCount,
          savedAtMs,
          score: fixtureCount * 100 + competitionCount * 25 + Math.min(savedAtMs / 1_000_000_000_000, 10),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function selectBestLocalWorkspaceCandidate(candidates: LocalWorkspaceCandidate[]): LocalWorkspaceCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.savedAtMs - a.savedAtMs;
  })[0] ?? null;
}

export function createPersistedState(
  fixtures: Fixture[],
  activeFixtureId: string,
  selectedRound: string,
  ruleWeights: RuleWeights,
  teamAliases: TeamAliasRule[] = [],
  tuningPresets: TuningPreset[] = [],
  modelChangeLog: ModelChangeLogEntry[] = [],
  advancedDataControls: AdvancedDataWeightControls = defaultAdvancedDataWeightControls,
  // Defaults to [] on purpose: every existing call site that doesn't pass
  // this stays exactly as before (an empty vault embedded), which is what
  // avoids the recursive-nesting problem when this function is used to
  // build the state embedded *inside* a single recovery snapshot. Only the
  // two call sites that build the top-level mirrored state (local autosave
  // write, Supabase mirror) should pass the real, current vault through.
  recoverySnapshots: WorkspaceRecoverySnapshot[] = [],
): PersistedAppState {
  return {
    version: "0.47.5",
    savedAt: new Date().toISOString(),
    fixtures: cloneFixtures(fixtures),
    activeFixtureId,
    selectedRound,
    ruleWeights: { ...ruleWeights },
    teamAliases: cloneTeamAliases(teamAliases),
    tuningPresets: cloneTuningPresets(tuningPresets),
    modelChangeLog: cloneModelChangeLog(modelChangeLog),
    advancedDataControls: cloneAdvancedDataWeightControls(advancedDataControls),
    recoverySnapshots: [...recoverySnapshots],
  };
}

export function createBlankFixture(round: string, competition = "New Competition"): Fixture {
  return {
    id: `fixture-${Date.now()}`,
    competition,
    round,
    date: "TBC",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    homeStats: { ...emptyTeamStats },
    awayStats: { ...emptyTeamStats },
    homeRecentForm: emptyRecentForm.map((game) => ({ ...game })),
    awayRecentForm: emptyRecentForm.map((game) => ({ ...game })),
    homeMissingPlayers: emptyMissingPlayers.map((player) => ({ ...player })),
    awayMissingPlayers: emptyMissingPlayers.map((player) => ({ ...player })),
    homeContext: { ...emptyTeamContext },
    awayContext: { ...emptyTeamContext },
    matchContext: { ...emptyMatchContext },
    oddsMarket: { ...emptyOddsMarket },
    matchResult: { ...emptyMatchResult },
    scores: { ...emptyScores },
    betLog: undefined,
  };
}

export type FixtureBatchMode = "append" | "replace" | "replaceCompetition" | "update";

export type FixtureBatchCompetitionPlan = {
  competition: string;
  existsInWorkspace: boolean;
};

export type FixtureBatchApplyResult = {
  fixtures: Fixture[];
  replacedCompetitionCount: number;
  updatedFixtureCount: number;
  addedFixtureCount: number;
  preservedFixtureCount: number;
};

export type FixtureBatchPreview = {
  mode: FixtureBatchMode;
  importedFixtureCount: number;
  importedCompetitionCount: number;
  importedCompetitions: string[];
  newCompetitions: string[];
  existingCompetitions: string[];
  competitionPlan: FixtureBatchCompetitionPlan[];
  duplicateImportCount: number;
  matchingFixtureCount: number;
  updatedFixtureCount: number;
  addedFixtureCount: number;
  preservedFixtureCount: number;
  replacedCompetitionCount: number;
  currentFixtureCount: number;
  finalFixtureCount: number;
  summaryLines: string[];
  warnings: string[];
};

export function fixtureMatchKey(fixture: Fixture): string {
  return [
    fixture.competition.trim().toLowerCase(),
    normaliseRound(fixture.round).trim().toLowerCase(),
    fixture.date.trim().toLowerCase(),
    fixture.homeTeam.trim().toLowerCase(),
    fixture.awayTeam.trim().toLowerCase(),
  ].join("|");
}


function mergeDuplicateFixture(existing: Fixture, incoming: Fixture): Fixture {
  const incomingHasResult = incoming.matchResult.status === "final";
  const existingHasResult = existing.matchResult.status === "final";
  return {
    ...incoming,
    id: existing.id,
    matchResult: existingHasResult && !incomingHasResult ? { ...existing.matchResult } : { ...incoming.matchResult },
    betLog: existing.betLog ? { ...existing.betLog } : incoming.betLog ? { ...incoming.betLog } : undefined,
  };
}

export function dedupeFixturesByMatchKey(fixtures: Fixture[]): Fixture[] {
  const deduped: Fixture[] = [];
  const indexByKey = new Map<string, number>();

  fixtures.forEach((fixture) => {
    const key = fixtureMatchKey(fixture);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduped.length);
      deduped.push(fixture);
      return;
    }

    deduped[existingIndex] = mergeDuplicateFixture(deduped[existingIndex], fixture);
  });

  return deduped;
}

function getCompetitionScope(newFixtures: Fixture[], requestedScope?: string[]): Set<string> {
  const source = requestedScope?.length ? requestedScope : newFixtures.map((fixture) => fixture.competition);
  return new Set(source.map((competition) => competition.trim().toLowerCase()).filter(Boolean));
}


export function getFixtureBatchPreview(
  newFixtures: Fixture[],
  currentFixtures: Fixture[],
  mode: FixtureBatchMode,
  scopeCompetitions?: string[]
): FixtureBatchPreview {
  const dedupedNewFixtures = dedupeFixturesByMatchKey(newFixtures);
  const dedupedCurrentFixtures = dedupeFixturesByMatchKey(currentFixtures);
  const applied = applyFixtureBatch(dedupedNewFixtures, dedupedCurrentFixtures, mode, scopeCompetitions);
  const importedCompetitions = Array.from(
    getCompetitionScope(dedupedNewFixtures, scopeCompetitions)
  ).sort();

  const duplicateImportCount = newFixtures.length - dedupedNewFixtures.length;

  const currentKeys = new Set(dedupedCurrentFixtures.map(fixtureMatchKey));
  const currentCompetitionNames = new Map<string, string>();
  dedupedCurrentFixtures.forEach((fixture) => {
    const key = fixture.competition.trim().toLowerCase();
    if (key && !currentCompetitionNames.has(key)) currentCompetitionNames.set(key, fixture.competition.trim());
  });
  const competitionPlan = importedCompetitions.map((competition) => ({
    competition,
    existsInWorkspace: currentCompetitionNames.has(competition.trim().toLowerCase()),
  }));
  const newCompetitions = competitionPlan
    .filter((item) => !item.existsInWorkspace)
    .map((item) => item.competition);
  const existingCompetitions = competitionPlan
    .filter((item) => item.existsInWorkspace)
    .map((item) => currentCompetitionNames.get(item.competition.trim().toLowerCase()) || item.competition);
  const matchingFixtureCount = dedupedNewFixtures.filter((fixture) => currentKeys.has(fixtureMatchKey(fixture))).length;
  const warnings: string[] = [];
  if (duplicateImportCount > 0) {
    warnings.push(`${duplicateImportCount} duplicate fixture row${duplicateImportCount === 1 ? "" : "s"} detected inside the import file.`);
  }
  if (mode === "replace") {
    warnings.push("Replace entire workspace will remove every current fixture before importing this file.");
  }
  if (mode === "append" && existingCompetitions.length > 0) {
    warnings.push(`Append/Add New will skip exact duplicate fixtures and only add new rows into existing competition scope: ${existingCompetitions.join(", ")}. Use Update or Replace imported competition only if you are refreshing that league.`);
  }
  if (mode === "replaceCompetition") {
    if (existingCompetitions.length > 0) {
      warnings.push(`Only existing imported competition scope will be replaced: ${existingCompetitions.join(", ")}.`);
    }
    if (newCompetitions.length > 0) {
      warnings.push(`No existing competition found for ${newCompetitions.join(", ")}; this mode will add it without replacing other competitions.`);
    }
  }

  const modeLabel: Record<FixtureBatchMode, string> = {
    append: "Append",
    update: "Update matching fixtures",
    replaceCompetition: "Replace imported competition only",
    replace: "Replace entire workspace",
  };

  return {
    mode,
    importedFixtureCount: newFixtures.length,
    importedCompetitionCount: importedCompetitions.length,
    importedCompetitions,
    newCompetitions,
    existingCompetitions,
    competitionPlan,
    duplicateImportCount,
    matchingFixtureCount,
    updatedFixtureCount: applied.updatedFixtureCount,
    addedFixtureCount: applied.addedFixtureCount,
    preservedFixtureCount: applied.preservedFixtureCount,
    replacedCompetitionCount: applied.replacedCompetitionCount,
    currentFixtureCount: currentFixtures.length,
    finalFixtureCount: applied.fixtures.length,
    warnings,
    summaryLines: [
      `Mode: ${modeLabel[mode]}.`,
      `Imported ${newFixtures.length} fixture${newFixtures.length === 1 ? "" : "s"} across ${importedCompetitions.length || 0} competition${importedCompetitions.length === 1 ? "" : "s"}.`,
      newCompetitions.length > 0
        ? `New competition${newCompetitions.length === 1 ? "" : "s"} to add: ${newCompetitions.join(", ")}.`
        : "No brand-new competition names detected in this import.",
      existingCompetitions.length > 0
        ? `Existing competition${existingCompetitions.length === 1 ? "" : "s"} touched: ${existingCompetitions.join(", ")}.`
        : "No existing competitions will be touched by competition name.",
      `Will update ${applied.updatedFixtureCount} matching fixture${applied.updatedFixtureCount === 1 ? "" : "s"}, add ${applied.addedFixtureCount} new fixture${applied.addedFixtureCount === 1 ? "" : "s"}, and preserve ${applied.preservedFixtureCount} existing fixture${applied.preservedFixtureCount === 1 ? "" : "s"}.`,
      `Workspace fixture count will change from ${currentFixtures.length} to ${applied.fixtures.length}.`,
    ],
  };
}

// Shared by every fixture-batch entry point (CSV import, custom competition import,
// round-robin generator, live fixture fetch).
// - append: prepends imported fixtures and leaves existing workspace fixtures alone.
// - replace: swaps the entire fixture workspace.
// - replaceCompetition: replaces only competitions present in the import/scope.
// - update: updates matching fixtures in place, preserving existing IDs, and adds new fixtures.
export function applyFixtureBatch(
  newFixtures: Fixture[],
  currentFixtures: Fixture[],
  mode: FixtureBatchMode,
  scopeCompetitions?: string[]
): FixtureBatchApplyResult {
  const dedupedNewFixtures = dedupeFixturesByMatchKey(newFixtures);
  const dedupedCurrentFixtures = dedupeFixturesByMatchKey(currentFixtures);
  const currentFixtureKeySet = new Set(dedupedCurrentFixtures.map(fixtureMatchKey));

  const baseResult = {
    replacedCompetitionCount: 0,
    updatedFixtureCount: 0,
    addedFixtureCount: dedupedNewFixtures.length,
    preservedFixtureCount: dedupedCurrentFixtures.length,
  };

  if (mode === "append") {
    const fixturesToAdd = dedupedNewFixtures.filter((fixture) => !currentFixtureKeySet.has(fixtureMatchKey(fixture)));
    return {
      fixtures: [...fixturesToAdd, ...dedupedCurrentFixtures],
      replacedCompetitionCount: 0,
      updatedFixtureCount: 0,
      addedFixtureCount: fixturesToAdd.length,
      preservedFixtureCount: dedupedCurrentFixtures.length,
    };
  }

  if (mode === "update") {
    const currentByKey = new Map(dedupedCurrentFixtures.map((fixture) => [fixtureMatchKey(fixture), fixture]));
    const updatedIds = new Set<string>();
    const updatedFixtures = dedupedNewFixtures.map((fixture) => {
      const existing = currentByKey.get(fixtureMatchKey(fixture));
      if (!existing) return fixture;
      updatedIds.add(existing.id);
      return { ...fixture, id: existing.id, betLog: existing.betLog ? { ...existing.betLog } : fixture.betLog };
    });
    const importedKeys = new Set(dedupedNewFixtures.map(fixtureMatchKey));
    const preservedFixtures = dedupedCurrentFixtures.filter((fixture) => !importedKeys.has(fixtureMatchKey(fixture)));
    const finalFixtures = [...updatedFixtures, ...preservedFixtures];
    return {
      fixtures: finalFixtures,
      replacedCompetitionCount: 0,
      updatedFixtureCount: updatedIds.size,
      addedFixtureCount: updatedFixtures.length - updatedIds.size,
      preservedFixtureCount: preservedFixtures.length,
    };
  }

  if (mode === "replaceCompetition") {
    const competitionScope = getCompetitionScope(dedupedNewFixtures, scopeCompetitions);
    const preservedFixtures = dedupedCurrentFixtures.filter(
      (fixture) => !competitionScope.has(fixture.competition.trim().toLowerCase()),
    );
    const finalFixtures = [...dedupedNewFixtures, ...preservedFixtures];
    return {
      fixtures: finalFixtures,
      replacedCompetitionCount: competitionScope.size,
      updatedFixtureCount: 0,
      addedFixtureCount: dedupedNewFixtures.length,
      preservedFixtureCount: preservedFixtures.length,
    };
  }

  return {
    fixtures: dedupedNewFixtures,
    replacedCompetitionCount: 0,
    updatedFixtureCount: 0,
    addedFixtureCount: dedupedNewFixtures.length,
    preservedFixtureCount: 0,
  };
}

export function getActualOutcomeFromScore(matchResult: MatchResultInput): TipPick | "pending" {
  if (matchResult.status !== "final") return "pending";
  if (matchResult.homeGoals > matchResult.awayGoals) return "home";
  if (matchResult.awayGoals > matchResult.homeGoals) return "away";
  return "draw";
}

