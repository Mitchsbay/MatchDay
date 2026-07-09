import type { Fixture } from "./sampleData";

export type MarketMovementDirection = "home-shortening" | "draw-shortening" | "away-shortening" | "stable" | "unknown";
export type TravelBurden = "none" | "low" | "moderate" | "high";
export type StabilityFlag = "stable" | "watch" | "volatile" | "unknown";

export type TeamAdvancedEvidence = {
  expectedGoalsFor?: number;
  expectedGoalsAgainst?: number;
  recentExpectedGoalsFor?: number;
  recentExpectedGoalsAgainst?: number;
  recentOpponentAveragePointsPerGame?: number;
  recentOpponentAveragePosition?: number;
  daysSinceLastMatch?: number;
  daysUntilNextMatch?: number;
  matchesLast7Days?: number;
  matchesLast14Days?: number;
  travelBurden?: TravelBurden;
  missingStarters?: number;
  missingKeyAttackers?: number;
  missingKeyDefenders?: number;
  missingGoalkeepers?: number;
  returningKeyPlayers?: number;
  setPieceGoalsFor?: number;
  setPieceGoalsAgainst?: number;
  cornersForPerMatch?: number;
  cornersAgainstPerMatch?: number;
  yellowCardsPerMatch?: number;
  redCardsPerMatch?: number;
  stability?: StabilityFlag;
  notes?: string;
};

export type MatchAdvancedEvidence = {
  openingHomeProbability?: number;
  openingDrawProbability?: number;
  openingAwayProbability?: number;
  currentHomeProbability?: number;
  currentDrawProbability?: number;
  currentAwayProbability?: number;
  marketMovementDirection?: MarketMovementDirection;
  marketMovementStrength?: number;
  neutralVenue?: boolean;
  weatherDisruptionRisk?: boolean;
  dataSourceLabel?: string;
  notes?: string;
};

export type FixtureAdvancedEvidence = {
  home?: TeamAdvancedEvidence;
  away?: TeamAdvancedEvidence;
  match?: MatchAdvancedEvidence;
};

export type AdvancedEvidenceCategorySummary = {
  id: string;
  label: string;
  available: number;
  possible: number;
  coveragePct: number;
  detail: string;
};

export type AdvancedEvidenceSummary = {
  fixtureCount: number;
  fixturesWithAdvancedEvidence: number;
  coveragePct: number;
  categories: AdvancedEvidenceCategorySummary[];
  notes: string[];
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pct(available: number, possible: number): number {
  if (possible <= 0) return 0;
  return Math.round((available / possible) * 100);
}

function hasAnyAdvancedEvidence(fixture: Fixture): boolean {
  const evidence = fixture.advancedEvidence;
  if (!evidence) return false;
  return Boolean(
    Object.keys(evidence.home ?? {}).length ||
    Object.keys(evidence.away ?? {}).length ||
    Object.keys(evidence.match ?? {}).length,
  );
}

function countPair(fixtures: Fixture[], predicate: (side: TeamAdvancedEvidence | undefined) => boolean): number {
  return fixtures.reduce((count, fixture) => {
    return count + (predicate(fixture.advancedEvidence?.home) ? 1 : 0) + (predicate(fixture.advancedEvidence?.away) ? 1 : 0);
  }, 0);
}

function countMatch(fixtures: Fixture[], predicate: (match: MatchAdvancedEvidence | undefined) => boolean): number {
  return fixtures.reduce((count, fixture) => count + (predicate(fixture.advancedEvidence?.match) ? 1 : 0), 0);
}

export function cloneAdvancedEvidence(evidence?: FixtureAdvancedEvidence): FixtureAdvancedEvidence | undefined {
  if (!evidence) return undefined;
  return {
    home: evidence.home ? { ...evidence.home } : undefined,
    away: evidence.away ? { ...evidence.away } : undefined,
    match: evidence.match ? { ...evidence.match } : undefined,
  };
}

export function summariseAdvancedEvidence(fixtures: Fixture[]): AdvancedEvidenceSummary {
  const sidePossible = fixtures.length * 2;
  const fixturePossible = fixtures.length;
  const categories: AdvancedEvidenceCategorySummary[] = [
    {
      id: "xg",
      label: "Expected goals / xG",
      available: countPair(fixtures, (side) => isNumber(side?.expectedGoalsFor) || isNumber(side?.expectedGoalsAgainst) || isNumber(side?.recentExpectedGoalsFor) || isNumber(side?.recentExpectedGoalsAgainst)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "xG for/against and recent xG trend fields are ready for import and future scoring.",
    },
    {
      id: "schedule-strength",
      label: "Strength of schedule",
      available: countPair(fixtures, (side) => isNumber(side?.recentOpponentAveragePointsPerGame) || isNumber(side?.recentOpponentAveragePosition)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Recent opponent strength fields help avoid overrating easy form runs.",
    },
    {
      id: "fatigue",
      label: "Rest / fatigue",
      available: countPair(fixtures, (side) => isNumber(side?.daysSinceLastMatch) || isNumber(side?.matchesLast7Days) || isNumber(side?.matchesLast14Days) || Boolean(side?.travelBurden)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Rest, congestion, travel, and next-match timing fields are available.",
    },
    {
      id: "player-impact",
      label: "Player-impact availability",
      available: countPair(fixtures, (side) => isNumber(side?.missingStarters) || isNumber(side?.missingKeyAttackers) || isNumber(side?.missingKeyDefenders) || isNumber(side?.missingGoalkeepers) || isNumber(side?.returningKeyPlayers)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Missing starters, key attackers/defenders/goalkeepers, and returning players can be stored separately from the older generic availability gate.",
    },
    {
      id: "market-movement",
      label: "Market movement",
      available: countMatch(fixtures, (match) => isNumber(match?.openingHomeProbability) || isNumber(match?.currentHomeProbability) || Boolean(match?.marketMovementDirection)),
      possible: fixturePossible,
      coveragePct: 0,
      detail: "Opening/current market probabilities and movement strength are ready for later signal checks.",
    },
    {
      id: "set-pieces",
      label: "Set pieces",
      available: countPair(fixtures, (side) => isNumber(side?.setPieceGoalsFor) || isNumber(side?.setPieceGoalsAgainst) || isNumber(side?.cornersForPerMatch) || isNumber(side?.cornersAgainstPerMatch)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Set-piece and corner edges can be stored for tight-match review.",
    },
    {
      id: "discipline",
      label: "Discipline / card risk",
      available: countPair(fixtures, (side) => isNumber(side?.yellowCardsPerMatch) || isNumber(side?.redCardsPerMatch)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Yellow/red card risk fields are ready to support future volatility scoring.",
    },
    {
      id: "stability",
      label: "Team stability / context",
      available: countPair(fixtures, (side) => Boolean(side?.stability) || Boolean(side?.notes)),
      possible: sidePossible,
      coveragePct: 0,
      detail: "Manager/team stability and contextual notes can be stored without changing scoring yet.",
    },
  ].map((category) => ({ ...category, coveragePct: pct(category.available, category.possible) }));

  const available = categories.reduce((sum, category) => sum + category.available, 0);
  const possible = categories.reduce((sum, category) => sum + category.possible, 0);
  const fixturesWithAdvancedEvidence = fixtures.filter(hasAnyAdvancedEvidence).length;
  const notes = [
    "P41 is a schema/foundation patch only; it does not change prediction scoring aggressively.",
    "Use P42 imports to populate these fields, then P43/P44 can turn them into measured signals/gates.",
  ];
  if (fixturesWithAdvancedEvidence === 0) {
    notes.unshift("No advanced evidence has been imported yet. Existing predictions continue to use the current gates.");
  }

  return {
    fixtureCount: fixtures.length,
    fixturesWithAdvancedEvidence,
    coveragePct: pct(available, possible),
    categories,
    notes,
  };
}
