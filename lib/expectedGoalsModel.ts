import type { Fixture } from "./sampleData";
import type { TeamStats } from "./scoringEngine";

// Replaces the "Dixon-Coles Poisson" label the original spec doc used on a
// plain logistic function with the real thing: attack/defense ratings
// derived from actual goals for/against, expected goals (lambda) per side,
// and outcome probabilities from the Poisson score grid with the low-score
// correlation adjustment Dixon & Coles (1997) introduced.

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeDiv(value: number, divisor: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) return 0;
  return value / divisor;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

// --- League goal averages -----------------------------------------------

export type LeagueGoalAverages = {
  avgHomeGoalsFor: number;
  avgAwayGoalsFor: number;
  sampleTeams: number;
  source: "league-data" | "fallback";
};

// Long-run empirical averages across professional soccer leagues generally
// (home teams score somewhat more than away teams). Used only when there
// isn't enough played-match data yet (early season, or a competition with
// no standings loaded) so the model still produces a sane estimate instead
// of dividing by zero.
export const FALLBACK_LEAGUE_GOAL_AVERAGES: Omit<LeagueGoalAverages, "sampleTeams" | "source"> = {
  avgHomeGoalsFor: 1.5,
  avgAwayGoalsFor: 1.15,
};

/**
 * Averages each team's own goals-for-per-game (split by home/away context)
 * across every team in the given competition. Fixtures carry full-season
 * TeamStats redundantly (each team's stats appear on every fixture they're
 * part of), so teams are deduplicated by name before averaging.
 */
export function calculateLeagueGoalAverages(fixtures: Fixture[], competition: string): LeagueGoalAverages {
  const teamsByName = new Map<string, TeamStats>();
  fixtures
    .filter((f) => f.competition === competition)
    .forEach((f) => {
      if (!teamsByName.has(f.homeTeam)) teamsByName.set(f.homeTeam, f.homeStats);
      if (!teamsByName.has(f.awayTeam)) teamsByName.set(f.awayTeam, f.awayStats);
    });

  const teams = [...teamsByName.values()];
  const withHomeGames = teams.filter((t) => t.homePlayed > 0);
  const withAwayGames = teams.filter((t) => t.awayPlayed > 0);

  if (withHomeGames.length === 0 || withAwayGames.length === 0) {
    return { ...FALLBACK_LEAGUE_GOAL_AVERAGES, sampleTeams: teams.length, source: "fallback" };
  }

  return {
    avgHomeGoalsFor: average(withHomeGames.map((t) => safeDiv(t.homeGoalsFor, t.homePlayed))),
    avgAwayGoalsFor: average(withAwayGames.map((t) => safeDiv(t.awayGoalsFor, t.awayPlayed))),
    sampleTeams: teams.length,
    source: "league-data",
  };
}

// --- Expected goals (lambda) ----------------------------------------------

export type ExpectedGoals = {
  homeXg: number;
  awayXg: number;
  homeAttackStrength: number;
  homeDefenseStrength: number;
  awayAttackStrength: number;
  awayDefenseStrength: number;
};

// Expected goals below ~0.15 or above 5 per side reflect a data problem
// (near-zero sample size, a wild early-season outlier) rather than a real
// footballing edge — clamped so one bad ratio can't blow up the outcome
// probabilities downstream.
const MIN_XG = 0.15;
const MAX_XG = 5;

/**
 * Standard attack/defense-strength expected-goals model: each side's
 * scoring rate relative to the league average, multiplied by the
 * opponent's conceding rate relative to the league average, scaled back up
 * by the league's average goals for that home/away context.
 */
export function calculateExpectedGoals(
  homeStats: TeamStats,
  awayStats: TeamStats,
  league: LeagueGoalAverages,
): ExpectedGoals {
  const homeAttackStrength = safeDiv(safeDiv(homeStats.homeGoalsFor, homeStats.homePlayed), league.avgHomeGoalsFor);
  const homeDefenseStrength = safeDiv(safeDiv(homeStats.homeGoalsAgainst, homeStats.homePlayed), league.avgAwayGoalsFor);
  const awayAttackStrength = safeDiv(safeDiv(awayStats.awayGoalsFor, awayStats.awayPlayed), league.avgAwayGoalsFor);
  const awayDefenseStrength = safeDiv(safeDiv(awayStats.awayGoalsAgainst, awayStats.awayPlayed), league.avgHomeGoalsFor);

  // A team with zero games played has strength 0 from safeDiv, which would
  // otherwise force xG to 0 for both sides — fall back to league-average
  // strength (1.0) for a side with no data yet rather than asserting they
  // can't score at all.
  const homeAttack = homeStats.homePlayed > 0 ? homeAttackStrength : 1;
  const homeDefense = homeStats.homePlayed > 0 ? homeDefenseStrength : 1;
  const awayAttack = awayStats.awayPlayed > 0 ? awayAttackStrength : 1;
  const awayDefense = awayStats.awayPlayed > 0 ? awayDefenseStrength : 1;

  const homeXg = clamp(homeAttack * awayDefense * league.avgHomeGoalsFor, MIN_XG, MAX_XG);
  const awayXg = clamp(awayAttack * homeDefense * league.avgAwayGoalsFor, MIN_XG, MAX_XG);

  return {
    homeXg: Math.round(homeXg * 100) / 100,
    awayXg: Math.round(awayXg * 100) / 100,
    homeAttackStrength: Math.round(homeAttack * 100) / 100,
    homeDefenseStrength: Math.round(homeDefense * 100) / 100,
    awayAttackStrength: Math.round(awayAttack * 100) / 100,
    awayDefenseStrength: Math.round(awayDefense * 100) / 100,
  };
}

// --- Poisson + Dixon-Coles outcome probabilities --------------------------

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

// Dixon & Coles (1997) low-score adjustment: independent Poisson
// systematically under-predicts 0-0 and 1-1 draws and over-predicts 1-0 and
// 0-1, because real match goals aren't quite independent at low scores.
// rho is typically small and negative (-0.05 to -0.15 is standard); 0
// reduces this to plain independent Poisson.
export function dixonColesTau(homeGoals: number, awayGoals: number, homeXg: number, awayXg: number, rho: number): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - homeXg * awayXg * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + homeXg * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + awayXg * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

export type PoissonOutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
  mostLikelyScoreline: { home: number; away: number; probability: number };
  expectedTotalGoals: number;
  homeXg: number;
  awayXg: number;
};

const DEFAULT_RHO = -0.1;
const MAX_GOALS_IN_GRID = 10;

/**
 * Sums the Poisson score grid (0..maxGoals for each side), applying the
 * Dixon-Coles correction to the four low-score cells, then normalises so
 * home+draw+away always sum to exactly 1 regardless of how much probability
 * mass the truncated grid or the tau adjustment pushed around.
 */
export function calculatePoissonOutcomeProbabilities(
  homeXg: number,
  awayXg: number,
  rho: number = DEFAULT_RHO,
  maxGoals: number = MAX_GOALS_IN_GRID,
): PoissonOutcomeProbabilities {
  let home = 0;
  let draw = 0;
  let away = 0;
  let mostLikely = { home: 0, away: 0, probability: 0 };
  let total = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, homeXg) * poissonPmf(a, awayXg) * dixonColesTau(h, a, homeXg, awayXg, rho);
      const clamped = Math.max(0, p); // tau can theoretically push a cell slightly negative at extreme rho/xg combos
      total += clamped;
      if (clamped > mostLikely.probability) mostLikely = { home: h, away: a, probability: clamped };
      if (h > a) home += clamped;
      else if (h === a) draw += clamped;
      else away += clamped;
    }
  }

  // Normalise so the three outcomes always sum to exactly 1, whether `total`
  // came in under 1 (grid truncation losing high-score tail mass) or drifted
  // slightly from 1 (tau adjustment redistributing without perfectly
  // conserving mass at the edges of the grid).
  const safeTotal = total > 0 ? total : 1;

  return {
    home: Math.round((home / safeTotal) * 10000) / 100,
    draw: Math.round((draw / safeTotal) * 10000) / 100,
    away: Math.round((away / safeTotal) * 10000) / 100,
    mostLikelyScoreline: {
      home: mostLikely.home,
      away: mostLikely.away,
      probability: Math.round((mostLikely.probability / safeTotal) * 10000) / 100,
    },
    expectedTotalGoals: Math.round((homeXg + awayXg) * 100) / 100,
    homeXg,
    awayXg,
  };
}

/**
 * End-to-end convenience: league averages -> expected goals -> outcome
 * probabilities, for a single fixture within a competition's fixture list.
 */
export function calculateFixturePoissonProbabilities(
  fixture: Fixture,
  fixturesInCompetition: Fixture[],
  rho: number = DEFAULT_RHO,
): PoissonOutcomeProbabilities & { expectedGoals: ExpectedGoals; league: LeagueGoalAverages } {
  const league = calculateLeagueGoalAverages(fixturesInCompetition, fixture.competition);
  const expectedGoals = calculateExpectedGoals(fixture.homeStats, fixture.awayStats, league);
  const outcome = calculatePoissonOutcomeProbabilities(expectedGoals.homeXg, expectedGoals.awayXg, rho);
  return { ...outcome, expectedGoals, league };
}
