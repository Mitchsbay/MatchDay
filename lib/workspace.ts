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

export const STORAGE_KEY = "tipping-gates-app-p20-state-v1";
export const LEGACY_STORAGE_KEYS = [
  "tipping-gates-app-p16-state-v1",
  "tipping-gates-app-p15-state-v1",
  "tipping-gates-app-p14-state-v1",
  "tipping-gates-app-p13-state-v1",
  "tipping-gates-app-p12-state-v1",
  "tipping-gates-app-p11-state-v1",
];
export const CLOUD_WORKSPACE_ID_KEY = "tipping-gates-app-p20-cloud-workspace-id";
export const LEGACY_CLOUD_WORKSPACE_ID_KEYS = [
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
    version: "0.20.0",
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

export type FixtureBatchApplyResult = {
  fixtures: Fixture[];
  tips: UserTip[];
  orphanedTipsCount: number;
};

// Shared by every fixture-batch entry point (CSV import, round-robin generator,
// live fixture fetch): "append" just prepends, "replace" swaps in the new set
// and drops any tips that pointed at fixtures which no longer exist, rather
// than leaving them silently orphaned.
export function applyFixtureBatch(
  newFixtures: Fixture[],
  currentFixtures: Fixture[],
  currentTips: UserTip[],
  mode: "append" | "replace"
): FixtureBatchApplyResult {
  if (mode === "append") {
    return { fixtures: [...newFixtures, ...currentFixtures], tips: currentTips, orphanedTipsCount: 0 };
  }

  const survivingIds = new Set(newFixtures.map((fixture) => fixture.id));
  const keptTips = currentTips.filter((tip) => survivingIds.has(tip.fixtureId));
  return {
    fixtures: newFixtures,
    tips: keptTips,
    orphanedTipsCount: currentTips.length - keptTips.length,
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
