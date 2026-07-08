import {
  Entrant,
  Fixture,
  TipPick,
  UserTip,
} from "./sampleData";
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

export const STORAGE_KEY = "tipping-gates-app-p25-state-v1";
export const LEGACY_STORAGE_KEYS = [
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
export const CLOUD_WORKSPACE_ID_KEY = "tipping-gates-app-p25-cloud-workspace-id";
export const LEGACY_CLOUD_WORKSPACE_ID_KEYS = [
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
  entrants?: Entrant[];
  userTips?: UserTip[];
};

export function normaliseRound(round: string): string {
  const trimmed = round.trim();
  return trimmed || "Unassigned";
}

export function cloneFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((fixture) => ({
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
  }));
}

export function cloneEntrants(entrants: Entrant[]): Entrant[] {
  return entrants.map((entrant) => ({ ...entrant }));
}

export function cloneUserTips(userTips: UserTip[]): UserTip[] {
  return userTips.map((tip) => ({ ...tip }));
}

export function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedAppState>;
  return (
    Array.isArray(candidate.fixtures) &&
    typeof candidate.activeFixtureId === "string" &&
    !!candidate.ruleWeights &&
    typeof candidate.ruleWeights === "object"
  );
}

export function createPersistedState(
  fixtures: Fixture[],
  activeFixtureId: string,
  selectedRound: string,
  ruleWeights: RuleWeights,
  entrants: Entrant[],
  userTips: UserTip[],
): PersistedAppState {
  return {
    version: "0.25.0",
    savedAt: new Date().toISOString(),
    fixtures: cloneFixtures(fixtures),
    activeFixtureId,
    selectedRound,
    ruleWeights: { ...ruleWeights },
    entrants: cloneEntrants(entrants),
    userTips: cloneUserTips(userTips),
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
  };
}

export type FixtureBatchMode = "append" | "replace" | "replaceCompetition" | "update";

export type FixtureBatchApplyResult = {
  fixtures: Fixture[];
  tips: UserTip[];
  orphanedTipsCount: number;
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
  duplicateImportCount: number;
  matchingFixtureCount: number;
  updatedFixtureCount: number;
  addedFixtureCount: number;
  preservedFixtureCount: number;
  replacedCompetitionCount: number;
  orphanedTipsCount: number;
  tipsPreservedCount: number;
  currentFixtureCount: number;
  finalFixtureCount: number;
  summaryLines: string[];
  warnings: string[];
};

function fixtureMatchKey(fixture: Fixture): string {
  return [
    fixture.competition.trim().toLowerCase(),
    normaliseRound(fixture.round).trim().toLowerCase(),
    fixture.date.trim().toLowerCase(),
    fixture.homeTeam.trim().toLowerCase(),
    fixture.awayTeam.trim().toLowerCase(),
  ].join("|");
}

function getCompetitionScope(newFixtures: Fixture[], requestedScope?: string[]): Set<string> {
  const source = requestedScope?.length ? requestedScope : newFixtures.map((fixture) => fixture.competition);
  return new Set(source.map((competition) => competition.trim().toLowerCase()).filter(Boolean));
}

function filterTipsForFixtures(tips: UserTip[], fixtures: Fixture[]) {
  const survivingIds = new Set(fixtures.map((fixture) => fixture.id));
  const keptTips = tips.filter((tip) => survivingIds.has(tip.fixtureId));
  return { keptTips, orphanedTipsCount: tips.length - keptTips.length };
}


export function getFixtureBatchPreview(
  newFixtures: Fixture[],
  currentFixtures: Fixture[],
  currentTips: UserTip[],
  mode: FixtureBatchMode,
  scopeCompetitions?: string[]
): FixtureBatchPreview {
  const applied = applyFixtureBatch(newFixtures, currentFixtures, currentTips, mode, scopeCompetitions);
  const importedCompetitions = Array.from(
    getCompetitionScope(newFixtures, scopeCompetitions)
  ).sort();

  const seenKeys = new Set<string>();
  let duplicateImportCount = 0;
  newFixtures.forEach((fixture) => {
    const key = fixtureMatchKey(fixture);
    if (seenKeys.has(key)) duplicateImportCount += 1;
    seenKeys.add(key);
  });

  const currentKeys = new Set(currentFixtures.map(fixtureMatchKey));
  const matchingFixtureCount = newFixtures.filter((fixture) => currentKeys.has(fixtureMatchKey(fixture))).length;
  const warnings: string[] = [];
  if (duplicateImportCount > 0) {
    warnings.push(`${duplicateImportCount} duplicate fixture row${duplicateImportCount === 1 ? "" : "s"} detected inside the import file.`);
  }
  if (mode === "replace") {
    warnings.push("Replace entire workspace will remove every current fixture before importing this file.");
  }
  if (mode === "replaceCompetition") {
    warnings.push(`Only imported competition scope will be replaced: ${importedCompetitions.join(", ") || "unknown"}.`);
  }
  if (applied.orphanedTipsCount > 0) {
    warnings.push(`${applied.orphanedTipsCount} existing tip${applied.orphanedTipsCount === 1 ? "" : "s"} would be orphaned by this import mode.`);
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
    duplicateImportCount,
    matchingFixtureCount,
    updatedFixtureCount: applied.updatedFixtureCount,
    addedFixtureCount: applied.addedFixtureCount,
    preservedFixtureCount: applied.preservedFixtureCount,
    replacedCompetitionCount: applied.replacedCompetitionCount,
    orphanedTipsCount: applied.orphanedTipsCount,
    tipsPreservedCount: applied.tips.length,
    currentFixtureCount: currentFixtures.length,
    finalFixtureCount: applied.fixtures.length,
    warnings,
    summaryLines: [
      `Mode: ${modeLabel[mode]}.`,
      `Imported ${newFixtures.length} fixture${newFixtures.length === 1 ? "" : "s"} across ${importedCompetitions.length || 0} competition${importedCompetitions.length === 1 ? "" : "s"}.`,
      `Will update ${applied.updatedFixtureCount} matching fixture${applied.updatedFixtureCount === 1 ? "" : "s"}, add ${applied.addedFixtureCount} new fixture${applied.addedFixtureCount === 1 ? "" : "s"}, and preserve ${applied.preservedFixtureCount} existing fixture${applied.preservedFixtureCount === 1 ? "" : "s"}.`,
      `Workspace fixture count will change from ${currentFixtures.length} to ${applied.fixtures.length}.`,
      `Tips preserved: ${applied.tips.length}; tips at risk: ${applied.orphanedTipsCount}.`,
    ],
  };
}

// Shared by every fixture-batch entry point (CSV import, custom competition import,
// round-robin generator, live fixture fetch).
// - append: prepends imported fixtures and leaves existing workspace fixtures/tips alone.
// - replace: swaps the entire fixture workspace and drops tips whose fixtures disappear.
// - replaceCompetition: replaces only competitions present in the import/scope.
// - update: updates matching fixtures in place, preserving existing IDs/tips, and adds new fixtures.
export function applyFixtureBatch(
  newFixtures: Fixture[],
  currentFixtures: Fixture[],
  currentTips: UserTip[],
  mode: FixtureBatchMode,
  scopeCompetitions?: string[]
): FixtureBatchApplyResult {
  const baseResult = {
    replacedCompetitionCount: 0,
    updatedFixtureCount: 0,
    addedFixtureCount: newFixtures.length,
    preservedFixtureCount: currentFixtures.length,
  };

  if (mode === "append") {
    return { fixtures: [...newFixtures, ...currentFixtures], tips: currentTips, orphanedTipsCount: 0, ...baseResult };
  }

  if (mode === "update") {
    const currentByKey = new Map(currentFixtures.map((fixture) => [fixtureMatchKey(fixture), fixture]));
    const updatedIds = new Set<string>();
    const updatedFixtures = newFixtures.map((fixture) => {
      const existing = currentByKey.get(fixtureMatchKey(fixture));
      if (!existing) return fixture;
      updatedIds.add(existing.id);
      return { ...fixture, id: existing.id };
    });
    const importedKeys = new Set(newFixtures.map(fixtureMatchKey));
    const preservedFixtures = currentFixtures.filter((fixture) => !importedKeys.has(fixtureMatchKey(fixture)));
    const finalFixtures = [...updatedFixtures, ...preservedFixtures];
    const { keptTips, orphanedTipsCount } = filterTipsForFixtures(currentTips, finalFixtures);
    return {
      fixtures: finalFixtures,
      tips: keptTips,
      orphanedTipsCount,
      replacedCompetitionCount: 0,
      updatedFixtureCount: updatedIds.size,
      addedFixtureCount: updatedFixtures.length - updatedIds.size,
      preservedFixtureCount: preservedFixtures.length,
    };
  }

  if (mode === "replaceCompetition") {
    const competitionScope = getCompetitionScope(newFixtures, scopeCompetitions);
    const preservedFixtures = currentFixtures.filter(
      (fixture) => !competitionScope.has(fixture.competition.trim().toLowerCase()),
    );
    const finalFixtures = [...newFixtures, ...preservedFixtures];
    const { keptTips, orphanedTipsCount } = filterTipsForFixtures(currentTips, finalFixtures);
    return {
      fixtures: finalFixtures,
      tips: keptTips,
      orphanedTipsCount,
      replacedCompetitionCount: competitionScope.size,
      updatedFixtureCount: 0,
      addedFixtureCount: newFixtures.length,
      preservedFixtureCount: preservedFixtures.length,
    };
  }

  const { keptTips, orphanedTipsCount } = filterTipsForFixtures(currentTips, newFixtures);
  return {
    fixtures: newFixtures,
    tips: keptTips,
    orphanedTipsCount,
    replacedCompetitionCount: 0,
    updatedFixtureCount: 0,
    addedFixtureCount: newFixtures.length,
    preservedFixtureCount: 0,
  };
}

export function getActualOutcomeFromScore(matchResult: MatchResultInput): TipPick | "pending" {
  if (matchResult.status !== "final") return "pending";
  if (matchResult.homeGoals > matchResult.awayGoals) return "home";
  if (matchResult.awayGoals > matchResult.homeGoals) return "away";
  return "draw";
}

export function getTipFor(userTips: UserTip[], fixtureId: string, entrantId: string): UserTip | undefined {
  return userTips.find((tip) => tip.fixtureId === fixtureId && tip.entrantId === entrantId);
}

export function calculateTipPoints(pick: TipPick | undefined, actualOutcome: TipPick | "pending") {
  if (!pick || actualOutcome === "pending") return 0;
  if (pick !== actualOutcome) return 0;
  return actualOutcome === "draw" ? 2 : 1;
}
