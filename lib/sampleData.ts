import type { FixtureAdvancedEvidence } from "./advancedEvidence";
import type {
  MatchContext,
  MatchResultInput,
  MatchScores,
  MissingPlayer,
  OddsMarket,
  RecentFormGame,
  TeamContext,
  TeamStats,
} from "./scoringEngine";

export type TipPick = "home" | "draw" | "away";

export type FixtureBetLog = {
  outcomeBacked: TipPick;
  odds: string;
  stake: number;
};

export type Fixture = {
  id: string;
  competition: string;
  round: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeStats: TeamStats;
  awayStats: TeamStats;
  homeRecentForm: RecentFormGame[];
  awayRecentForm: RecentFormGame[];
  homeMissingPlayers: MissingPlayer[];
  awayMissingPlayers: MissingPlayer[];
  homeContext: TeamContext;
  awayContext: TeamContext;
  matchContext: MatchContext;
  oddsMarket: OddsMarket;
  matchResult: MatchResultInput;
  scores: MatchScores;
  advancedEvidence?: FixtureAdvancedEvidence;
  betLog?: FixtureBetLog;
};

// No bundled example/demo fixtures on purpose — a fresh workspace starts
// empty. Add real fixtures via CSV import, custom competition import, the
// fixture generator, or Fetch Live Fixtures.
export const fixtures: Fixture[] = [];

