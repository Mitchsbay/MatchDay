import type { Fixture } from "./sampleData";
import type { MatchResultInput, TeamStats } from "./scoringEngine";
import { getActualOutcomeFromScore, normaliseRound } from "./workspace";

export type CompetitionTableRow = {
  team: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  pointsPerGame: number;
  homePlayed: number;
  homePoints: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayPlayed: number;
  awayPoints: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  form: string;
  sourceCount?: number;
};

export type CompetitionResultRow = {
  fixtureId: string;
  round: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
};

export type CompetitionInsights = {
  competition: string;
  fixtureCount: number;
  finalResultCount: number;
  pendingFixtureCount: number;
  teamCount: number;
  resultStandings: CompetitionTableRow[];
  evidenceStandings: CompetitionTableRow[];
  recentResults: CompetitionResultRow[];
  warnings: string[];
};

function teamKey(team: string): string {
  return team.trim().toLowerCase();
}

function cleanTeam(team: string): string {
  return team.trim() || "Unknown Team";
}

function isFinal(result: MatchResultInput): boolean {
  return result.status === "final" && Number.isFinite(result.homeGoals) && Number.isFinite(result.awayGoals);
}

function pointsFor(goalsFor: number, goalsAgainst: number): number {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function emptyRow(team: string): CompetitionTableRow {
  return {
    team,
    played: 0,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    pointsPerGame: 0,
    homePlayed: 0,
    homePoints: 0,
    homeGoalsFor: 0,
    homeGoalsAgainst: 0,
    awayPlayed: 0,
    awayPoints: 0,
    awayGoalsFor: 0,
    awayGoalsAgainst: 0,
    form: "",
  };
}

function applyTeamResult(row: CompetitionTableRow, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  const points = pointsFor(goalsFor, goalsAgainst);
  row.points += points;
  if (points === 3) row.wins += 1;
  else if (points === 1) row.draws += 1;
  else row.losses += 1;
}

function finaliseRow(row: CompetitionTableRow): CompetitionTableRow {
  return {
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    pointsPerGame: row.played > 0 ? Number((row.points / row.played).toFixed(2)) : 0,
  };
}

function sortTable(a: CompetitionTableRow, b: CompetitionTableRow): number {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.goalsAgainst - b.goalsAgainst ||
    a.team.localeCompare(b.team)
  );
}

function sortFixtureDate(a: Fixture, b: Fixture): number {
  const dateCompare = a.date.localeCompare(b.date, undefined, { numeric: true, sensitivity: "base" });
  if (dateCompare !== 0) return dateCompare;
  const roundCompare = normaliseRound(a.round).localeCompare(normaliseRound(b.round), undefined, { numeric: true, sensitivity: "base" });
  if (roundCompare !== 0) return roundCompare;
  return a.id.localeCompare(b.id);
}

export function getCompetitionNames(fixtures: Fixture[]): string[] {
  return Array.from(new Set(fixtures.map((fixture) => fixture.competition.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function buildResultsStandings(fixtures: Fixture[]): { rows: CompetitionTableRow[]; recentResults: CompetitionResultRow[] } {
  const rows = new Map<string, CompetitionTableRow>();
  const form = new Map<string, string[]>();
  const recentResults: CompetitionResultRow[] = [];

  fixtures
    .filter((fixture) => isFinal(fixture.matchResult))
    .sort(sortFixtureDate)
    .forEach((fixture) => {
      const homeTeam = cleanTeam(fixture.homeTeam);
      const awayTeam = cleanTeam(fixture.awayTeam);
      const homeKey = teamKey(homeTeam);
      const awayKey = teamKey(awayTeam);
      const homeGoals = Number(fixture.matchResult.homeGoals);
      const awayGoals = Number(fixture.matchResult.awayGoals);
      if (!rows.has(homeKey)) rows.set(homeKey, emptyRow(homeTeam));
      if (!rows.has(awayKey)) rows.set(awayKey, emptyRow(awayTeam));
      const homeRow = rows.get(homeKey)!;
      const awayRow = rows.get(awayKey)!;

      applyTeamResult(homeRow, homeGoals, awayGoals);
      homeRow.homePlayed += 1;
      homeRow.homePoints += pointsFor(homeGoals, awayGoals);
      homeRow.homeGoalsFor += homeGoals;
      homeRow.homeGoalsAgainst += awayGoals;

      applyTeamResult(awayRow, awayGoals, homeGoals);
      awayRow.awayPlayed += 1;
      awayRow.awayPoints += pointsFor(awayGoals, homeGoals);
      awayRow.awayGoalsFor += awayGoals;
      awayRow.awayGoalsAgainst += homeGoals;

      const homeOutcome = getActualOutcomeFromScore(fixture.matchResult);
      const awayOutcome = homeOutcome === "home" ? "L" : homeOutcome === "away" ? "W" : "D";
      const homeForm = homeOutcome === "home" ? "W" : homeOutcome === "away" ? "L" : "D";
      form.set(homeKey, [...(form.get(homeKey) ?? []), `${homeForm}:${homeGoals}-${awayGoals}`].slice(-5));
      form.set(awayKey, [...(form.get(awayKey) ?? []), `${awayOutcome}:${awayGoals}-${homeGoals}`].slice(-5));

      recentResults.push({
        fixtureId: fixture.id,
        round: normaliseRound(fixture.round),
        date: fixture.date,
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
      });
    });

  return {
    rows: Array.from(rows.entries())
      .map(([key, row]) => finaliseRow({ ...row, form: (form.get(key) ?? []).join(";") }))
      .sort(sortTable),
    recentResults: recentResults.slice(-12).reverse(),
  };
}

function scoreStatsForSelection(stats: TeamStats): number {
  return stats.played * 1000 + stats.points * 10 + stats.goalsFor - stats.goalsAgainst;
}

function rowFromStats(team: string, stats: TeamStats, sourceCount: number): CompetitionTableRow {
  return finaliseRow({
    team,
    played: stats.played,
    points: stats.points,
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
    goalDifference: 0,
    pointsPerGame: 0,
    homePlayed: stats.homePlayed,
    homePoints: stats.homePoints,
    homeGoalsFor: stats.homeGoalsFor,
    homeGoalsAgainst: stats.homeGoalsAgainst,
    awayPlayed: stats.awayPlayed,
    awayPoints: stats.awayPoints,
    awayGoalsFor: stats.awayGoalsFor,
    awayGoalsAgainst: stats.awayGoalsAgainst,
    form: "",
    sourceCount,
  });
}

function buildEvidenceStandings(fixtures: Fixture[]): CompetitionTableRow[] {
  const bestStats = new Map<string, { team: string; stats: TeamStats; score: number; sourceCount: number }>();
  fixtures.forEach((fixture) => {
    [
      { team: cleanTeam(fixture.homeTeam), stats: fixture.homeStats },
      { team: cleanTeam(fixture.awayTeam), stats: fixture.awayStats },
    ].forEach(({ team, stats }) => {
      const key = teamKey(team);
      const score = scoreStatsForSelection(stats);
      const existing = bestStats.get(key);
      if (!existing) {
        bestStats.set(key, { team, stats, score, sourceCount: 1 });
      } else {
        existing.sourceCount += 1;
        if (score > existing.score) {
          bestStats.set(key, { team, stats, score, sourceCount: existing.sourceCount });
        }
      }
    });
  });

  return Array.from(bestStats.values())
    .map((entry) => rowFromStats(entry.team, entry.stats, entry.sourceCount))
    .filter((row) => row.played > 0 || row.points > 0 || row.goalsFor > 0 || row.goalsAgainst > 0)
    .sort(sortTable);
}

export function summariseCompetition(fixtures: Fixture[], competition: string): CompetitionInsights {
  const targetCompetition = competition || getCompetitionNames(fixtures)[0] || "";
  const scopedFixtures = fixtures.filter((fixture) => fixture.competition === targetCompetition);
  const { rows: resultStandings, recentResults } = buildResultsStandings(scopedFixtures);
  const evidenceStandings = buildEvidenceStandings(scopedFixtures);
  const finalResultCount = scopedFixtures.filter((fixture) => isFinal(fixture.matchResult)).length;
  const teamNames = new Set(scopedFixtures.flatMap((fixture) => [cleanTeam(fixture.homeTeam), cleanTeam(fixture.awayTeam)]));
  const warnings: string[] = [];
  if (scopedFixtures.length === 0) warnings.push("No fixtures found for this competition.");
  if (finalResultCount === 0) warnings.push("No final results found yet, so the results-derived table is empty.");
  if (evidenceStandings.length === 0) warnings.push("No imported team evidence stats found for this competition.");
  if (resultStandings.length > 0 && evidenceStandings.length > 0) {
    warnings.push("Results table is calculated only from final fixtures in the workspace; evidence table shows the latest imported team-stat snapshot.");
  }

  return {
    competition: targetCompetition,
    fixtureCount: scopedFixtures.length,
    finalResultCount,
    pendingFixtureCount: scopedFixtures.length - finalResultCount,
    teamCount: teamNames.size,
    resultStandings,
    evidenceStandings,
    recentResults,
    warnings,
  };
}
