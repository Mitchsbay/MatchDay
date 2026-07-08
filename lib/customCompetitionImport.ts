import type { Fixture } from "./sampleData";
import type { RecentFormGame, TeamStats } from "./scoringEngine";
import { emptyRecentForm, emptyScores } from "./scoringEngine";
import { createBlankFixture, normaliseRound } from "./workspace";

type RawRecord = Record<string, string>;

type ParsedRawMatch = {
  competition: string;
  round: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: "scheduled" | "final" | "postponed" | "cancelled";
  oddsHomePct: number;
  oddsDrawPct: number;
  oddsAwayPct: number;
  oddsSource: string;
  headToHeadEdge: number;
  otherStatsEdge: number;
  sourceRowNumber: number;
};

export type CustomCompetitionImportResult = {
  fixtures: Fixture[];
  warnings: string[];
  competitions: string[];
  teams: string[];
  finalRows: number;
  scheduledRows: number;
};

const RAW_TEMPLATE_HEADERS = [
  "competition",
  "round",
  "date",
  "home_team",
  "away_team",
  "home_goals",
  "away_goals",
  "status",
  "odds_home_pct",
  "odds_draw_pct",
  "odds_away_pct",
  "odds_source",
  "head_to_head_edge",
  "other_stats_edge",
] as const;

export const rawCompetitionCsvHeaders = RAW_TEMPLATE_HEADERS;

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/^\ufeff/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function text(record: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) return value;
  }
  return fallback;
}

function numberOrNull(record: RawRecord, keys: string[]): number | null {
  const value = text(record, keys);
  if (!value) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(record: RawRecord, keys: string[], fallback = 0): number {
  const parsed = numberOrNull(record, keys);
  return parsed === null ? fallback : parsed;
}

function normaliseStatus(value: string, hasScore: boolean): ParsedRawMatch["status"] {
  const cleaned = value.trim().toLowerCase();
  if (["final", "complete", "completed", "result", "played", "ft", "finished"].includes(cleaned)) return "final";
  if (["postponed", "ppd"].includes(cleaned)) return "postponed";
  if (["cancelled", "canceled", "abandoned"].includes(cleaned)) return "cancelled";
  if (hasScore && !["scheduled", "pending", "fixture", "tbc"].includes(cleaned)) return "final";
  return "scheduled";
}

function toSortableDate(value: string, fallbackIndex: number): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 4102444800000 + fallbackIndex; // 2100-01-01 + row index for TBC rows
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function emptyStats(): TeamStats {
  return {
    played: 0,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    homePlayed: 0,
    homePoints: 0,
    homeGoalsFor: 0,
    homeGoalsAgainst: 0,
    awayPlayed: 0,
    awayPoints: 0,
    awayGoalsFor: 0,
    awayGoalsAgainst: 0,
  };
}

function cloneStats(stats: TeamStats): TeamStats {
  return { ...stats };
}

function pointsFor(goalsFor: number, goalsAgainst: number): number {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function resultFor(goalsFor: number, goalsAgainst: number): RecentFormGame["result"] {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor === goalsAgainst) return "D";
  return "L";
}

function ensureStats(map: Map<string, TeamStats>, team: string): TeamStats {
  const existing = map.get(team);
  if (existing) return existing;
  const created = emptyStats();
  map.set(team, created);
  return created;
}

function applyTeamResult(stats: TeamStats, goalsFor: number, goalsAgainst: number, venue: "home" | "away") {
  stats.played += 1;
  stats.points += pointsFor(goalsFor, goalsAgainst);
  stats.goalsFor += goalsFor;
  stats.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) stats.wins += 1;
  else if (goalsFor === goalsAgainst) stats.draws += 1;
  else stats.losses += 1;

  if (venue === "home") {
    stats.homePlayed += 1;
    stats.homePoints += pointsFor(goalsFor, goalsAgainst);
    stats.homeGoalsFor += goalsFor;
    stats.homeGoalsAgainst += goalsAgainst;
  } else {
    stats.awayPlayed += 1;
    stats.awayPoints += pointsFor(goalsFor, goalsAgainst);
    stats.awayGoalsFor += goalsFor;
    stats.awayGoalsAgainst += goalsAgainst;
  }
}

function formForTeam(history: ParsedRawMatch[], team: string, beforeDate: number, beforeRow: number): RecentFormGame[] {
  const games = history
    .filter((match) => {
      if (match.status !== "final" || match.homeGoals === null || match.awayGoals === null) return false;
      if (match.homeTeam !== team && match.awayTeam !== team) return false;
      const matchDate = toSortableDate(match.date, match.sourceRowNumber);
      return matchDate < beforeDate || (matchDate === beforeDate && match.sourceRowNumber < beforeRow);
    })
    .sort((a, b) => {
      const dateDiff = toSortableDate(b.date, b.sourceRowNumber) - toSortableDate(a.date, a.sourceRowNumber);
      if (dateDiff !== 0) return dateDiff;
      return b.sourceRowNumber - a.sourceRowNumber;
    })
    .slice(0, 5)
    .map((match) => {
      const isHome = match.homeTeam === team;
      const goalsFor = isHome ? match.homeGoals ?? 0 : match.awayGoals ?? 0;
      const goalsAgainst = isHome ? match.awayGoals ?? 0 : match.homeGoals ?? 0;
      return {
        result: resultFor(goalsFor, goalsAgainst),
        goalsFor,
        goalsAgainst,
      };
    });

  while (games.length < 5) games.push({ ...emptyRecentForm[games.length] });
  return games;
}

function statsBefore(history: ParsedRawMatch[], beforeDate: number, beforeRow: number): Map<string, TeamStats> {
  const stats = new Map<string, TeamStats>();
  history
    .filter((match) => {
      if (match.status !== "final" || match.homeGoals === null || match.awayGoals === null) return false;
      const matchDate = toSortableDate(match.date, match.sourceRowNumber);
      return matchDate < beforeDate || (matchDate === beforeDate && match.sourceRowNumber < beforeRow);
    })
    .sort((a, b) => {
      const dateDiff = toSortableDate(a.date, a.sourceRowNumber) - toSortableDate(b.date, b.sourceRowNumber);
      if (dateDiff !== 0) return dateDiff;
      return a.sourceRowNumber - b.sourceRowNumber;
    })
    .forEach((match) => {
      const homeStats = ensureStats(stats, match.homeTeam);
      const awayStats = ensureStats(stats, match.awayTeam);
      applyTeamResult(homeStats, match.homeGoals ?? 0, match.awayGoals ?? 0, "home");
      applyTeamResult(awayStats, match.awayGoals ?? 0, match.homeGoals ?? 0, "away");
    });
  return stats;
}

function recordToRawMatch(record: RawRecord, rowNumber: number): ParsedRawMatch | null {
  const homeTeam = text(record, ["home_team", "home", "home_team_name"]);
  const awayTeam = text(record, ["away_team", "away", "away_team_name"]);
  if (!homeTeam || !awayTeam) return null;

  const homeGoals = numberOrNull(record, ["home_goals", "home_score", "result_home_goals", "hg", "fthg"]);
  const awayGoals = numberOrNull(record, ["away_goals", "away_score", "result_away_goals", "ag", "ftag"]);
  const hasScore = homeGoals !== null && awayGoals !== null;
  const status = normaliseStatus(text(record, ["status", "result_status", "match_status"], hasScore ? "final" : "scheduled"), hasScore);

  return {
    competition: text(record, ["competition", "league", "division"], "Custom Competition"),
    round: normaliseRound(text(record, ["round", "matchday", "week"], "Imported Round")),
    date: text(record, ["date", "match_date", "utc_date"], "TBC"),
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    status,
    oddsHomePct: numberValue(record, ["odds_home_pct", "home_win_probability"]),
    oddsDrawPct: numberValue(record, ["odds_draw_pct", "draw_probability"]),
    oddsAwayPct: numberValue(record, ["odds_away_pct", "away_win_probability"]),
    oddsSource: text(record, ["odds_source", "source"], "Raw competition import"),
    headToHeadEdge: numberValue(record, ["head_to_head_edge", "h2h_edge"]),
    otherStatsEdge: numberValue(record, ["other_stats_edge", "other_edge"]),
    sourceRowNumber: rowNumber,
  };
}

function rawMatchToFixture(match: ParsedRawMatch, allMatches: ParsedRawMatch[]): Fixture {
  const beforeDate = toSortableDate(match.date, match.sourceRowNumber);
  const stats = statsBefore(allMatches, beforeDate, match.sourceRowNumber);
  const fixture = createBlankFixture(match.round, match.competition);
  const hasFinalScore = match.status === "final" && match.homeGoals !== null && match.awayGoals !== null;

  return {
    ...fixture,
    id: `custom-${slug(match.competition)}-${slug(match.round)}-${slug(match.homeTeam)}-${slug(match.awayTeam)}-${match.sourceRowNumber}-${Date.now()}`,
    competition: match.competition,
    round: match.round,
    date: match.date,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeStats: cloneStats(stats.get(match.homeTeam) ?? emptyStats()),
    awayStats: cloneStats(stats.get(match.awayTeam) ?? emptyStats()),
    homeRecentForm: formForTeam(allMatches, match.homeTeam, beforeDate, match.sourceRowNumber),
    awayRecentForm: formForTeam(allMatches, match.awayTeam, beforeDate, match.sourceRowNumber),
    oddsMarket: {
      homeWinProbability: match.oddsHomePct,
      drawProbability: match.oddsDrawPct,
      awayWinProbability: match.oddsAwayPct,
      sourceLabel: match.oddsSource,
    },
    matchResult: {
      status: hasFinalScore ? "final" : "pending",
      homeGoals: hasFinalScore ? match.homeGoals ?? 0 : 0,
      awayGoals: hasFinalScore ? match.awayGoals ?? 0 : 0,
    },
    scores: {
      ...emptyScores,
      homeAdvantage: 2,
      headToHeadEdge: match.headToHeadEdge,
      otherStatsEdge: match.otherStatsEdge,
    },
  };
}


const TEAM_SHEET_HEADERS = [
  "competition",
  "season",
  "team",
  "played",
  "points",
  "wins",
  "draws",
  "losses",
  "gf",
  "ga",
  "home_played",
  "home_points",
  "home_wins",
  "home_draws",
  "home_losses",
  "home_gf",
  "home_ga",
  "away_played",
  "away_points",
  "away_wins",
  "away_draws",
  "away_losses",
  "away_gf",
  "away_ga",
  "form",
  "availability_risk",
  "notes",
] as const;

const FIXTURE_SHEET_HEADERS = [
  "competition",
  "season",
  "round",
  "date",
  "home_team",
  "away_team",
  "home_goals",
  "away_goals",
  "status",
  "neutral_venue",
  "odds_home_pct",
  "odds_draw_pct",
  "odds_away_pct",
  "odds_source",
  "head_to_head_edge",
  "other_stats_edge",
  "notes",
] as const;

export const customCompetitionTeamsSheetHeaders = TEAM_SHEET_HEADERS;
export const customCompetitionFixturesSheetHeaders = FIXTURE_SHEET_HEADERS;

export type CustomWorkbookTemplate = {
  teamsHeaders: readonly string[];
  fixturesHeaders: readonly string[];
  teamsRows: string[][];
  fixturesRows: string[][];
};

type TeamSheetRecord = {
  competition: string;
  season: string;
  team: string;
  stats: TeamStats;
  recentForm: RecentFormGame[];
  availabilityRisk: number;
  notes: string;
  sourceRowNumber: number;
};

function rowsToRecords(csv: string): { records: RawRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows = parseCsvRows(csv.trim());
  if (rows.length < 2) return { records: [], warnings: ["Sheet needs a header row and at least one data row."] };
  const headers = rows[0].map(normaliseHeader);
  const records = rows.slice(1).map((row) => {
    const record: RawRecord = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
  return { records, warnings };
}

function parseRecentForm(value: string): RecentFormGame[] {
  const blank = emptyRecentForm.map((game) => ({ ...game }));
  if (!value.trim()) return blank;

  const chunks = value.includes(";") ? value.split(";") : value.split(",");
  const games = chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((chunk) => {
      const [resultChunk, scoreChunk = "0-0"] = chunk.split(":");
      const rawResult = resultChunk.trim().toUpperCase();
      const result = rawResult === "W" || rawResult === "D" || rawResult === "L" ? rawResult : "D";
      const [gfRaw = "0", gaRaw = "0"] = scoreChunk.split("-");
      return {
        result: result as RecentFormGame["result"],
        goalsFor: Math.max(0, Number(gfRaw) || 0),
        goalsAgainst: Math.max(0, Number(gaRaw) || 0),
      };
    });
  while (games.length < 5) games.push({ ...blank[games.length] });
  return games;
}

function recordToTeamSheetRecord(record: RawRecord, rowNumber: number): TeamSheetRecord | null {
  const team = text(record, ["team", "team_name", "club"]);
  if (!team) return null;

  return {
    competition: text(record, ["competition", "league", "division"], "Custom Competition"),
    season: text(record, ["season", "year"], ""),
    team,
    stats: {
      played: numberValue(record, ["played", "p"]),
      points: numberValue(record, ["points", "pts"]),
      wins: numberValue(record, ["wins", "w"]),
      draws: numberValue(record, ["draws", "d"]),
      losses: numberValue(record, ["losses", "l"]),
      goalsFor: numberValue(record, ["gf", "goals_for"]),
      goalsAgainst: numberValue(record, ["ga", "goals_against"]),
      homePlayed: numberValue(record, ["home_played", "home_p"]),
      homePoints: numberValue(record, ["home_points", "home_pts"]),
      homeGoalsFor: numberValue(record, ["home_gf", "home_goals_for"]),
      homeGoalsAgainst: numberValue(record, ["home_ga", "home_goals_against"]),
      awayPlayed: numberValue(record, ["away_played", "away_p"]),
      awayPoints: numberValue(record, ["away_points", "away_pts"]),
      awayGoalsFor: numberValue(record, ["away_gf", "away_goals_for"]),
      awayGoalsAgainst: numberValue(record, ["away_ga", "away_goals_against"]),
    },
    recentForm: parseRecentForm(text(record, ["form", "recent_form"])),
    availabilityRisk: numberValue(record, ["availability_risk", "injury_risk"]),
    notes: text(record, ["notes", "note"]),
    sourceRowNumber: rowNumber,
  };
}

function teamKey(competition: string, season: string, team: string): string {
  return [competition, season, team]
    .map((value) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim())
    .join("|");
}

function fallbackTeamRecord(competition: string, season: string, team: string, rowNumber: number): TeamSheetRecord {
  return {
    competition,
    season,
    team,
    stats: emptyStats(),
    recentForm: emptyRecentForm.map((game) => ({ ...game })),
    availabilityRisk: 0,
    notes: "Missing from Teams sheet.",
    sourceRowNumber: rowNumber,
  };
}

function recordToFixtureSheetMatch(record: RawRecord, rowNumber: number): ParsedRawMatch | null {
  const homeTeam = text(record, ["home_team", "home", "home_team_name"]);
  const awayTeam = text(record, ["away_team", "away", "away_team_name"]);
  if (!homeTeam || !awayTeam) return null;

  const homeGoals = numberOrNull(record, ["home_goals", "home_score", "result_home_goals", "hg", "fthg"]);
  const awayGoals = numberOrNull(record, ["away_goals", "away_score", "result_away_goals", "ag", "ftag"]);
  const hasScore = homeGoals !== null && awayGoals !== null;
  const status = normaliseStatus(text(record, ["status", "result_status", "match_status"], hasScore ? "final" : "scheduled"), hasScore);

  return {
    competition: text(record, ["competition", "league", "division"], "Custom Competition"),
    round: normaliseRound(text(record, ["round", "matchday", "week"], "Imported Round")),
    date: text(record, ["date", "match_date", "utc_date"], "TBC"),
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    status,
    oddsHomePct: numberValue(record, ["odds_home_pct", "home_win_probability"]),
    oddsDrawPct: numberValue(record, ["odds_draw_pct", "draw_probability"]),
    oddsAwayPct: numberValue(record, ["odds_away_pct", "away_win_probability"]),
    oddsSource: text(record, ["odds_source", "source"], "Teams+Fixtures workbook import"),
    headToHeadEdge: numberValue(record, ["head_to_head_edge", "h2h_edge"]),
    otherStatsEdge: numberValue(record, ["other_stats_edge", "other_edge"]),
    sourceRowNumber: rowNumber,
  };
}

function fixtureSheetMatchToFixture(
  match: ParsedRawMatch,
  teamMap: Map<string, TeamSheetRecord>,
  warnings: string[],
): Fixture {
  const fixture = createBlankFixture(match.round, match.competition);
  const season = "";
  const homeRecord =
    teamMap.get(teamKey(match.competition, season, match.homeTeam)) ??
    teamMap.get(teamKey(match.competition, "*", match.homeTeam)) ??
    fallbackTeamRecord(match.competition, season, match.homeTeam, match.sourceRowNumber);
  const awayRecord =
    teamMap.get(teamKey(match.competition, season, match.awayTeam)) ??
    teamMap.get(teamKey(match.competition, "*", match.awayTeam)) ??
    fallbackTeamRecord(match.competition, season, match.awayTeam, match.sourceRowNumber);

  if (homeRecord.notes === "Missing from Teams sheet.") warnings.push(`Fixture row ${match.sourceRowNumber}: ${match.homeTeam} was not found in Teams sheet, so blank stats were used.`);
  if (awayRecord.notes === "Missing from Teams sheet.") warnings.push(`Fixture row ${match.sourceRowNumber}: ${match.awayTeam} was not found in Teams sheet, so blank stats were used.`);

  const hasFinalScore = match.status === "final" && match.homeGoals !== null && match.awayGoals !== null;
  return {
    ...fixture,
    id: `custom-workbook-${slug(match.competition)}-${slug(match.round)}-${slug(match.homeTeam)}-${slug(match.awayTeam)}-${match.sourceRowNumber}-${Date.now()}`,
    competition: match.competition,
    round: match.round,
    date: match.date,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeStats: cloneStats(homeRecord.stats),
    awayStats: cloneStats(awayRecord.stats),
    homeRecentForm: homeRecord.recentForm.map((game) => ({ ...game })),
    awayRecentForm: awayRecord.recentForm.map((game) => ({ ...game })),
    oddsMarket: {
      homeWinProbability: match.oddsHomePct,
      drawProbability: match.oddsDrawPct,
      awayWinProbability: match.oddsAwayPct,
      sourceLabel: match.oddsSource,
    },
    matchResult: {
      status: hasFinalScore ? "final" : "pending",
      homeGoals: hasFinalScore ? match.homeGoals ?? 0 : 0,
      awayGoals: hasFinalScore ? match.awayGoals ?? 0 : 0,
    },
    scores: {
      ...emptyScores,
      homeAdvantage: 2,
      headToHeadEdge: match.headToHeadEdge,
      injuryRisk: Math.max(-3, Math.min(3, homeRecord.availabilityRisk - awayRecord.availabilityRisk)),
      otherStatsEdge: match.otherStatsEdge,
    },
  };
}

export function getCustomWorkbookTemplate(): CustomWorkbookTemplate {
  return {
    teamsHeaders: TEAM_SHEET_HEADERS,
    fixturesHeaders: FIXTURE_SHEET_HEADERS,
    teamsRows: [
      ["Brasileirao Serie A", "2026", "Botafogo", "18", "28", "8", "4", "6", "25", "19", "9", "17", "5", "2", "2", "14", "8", "9", "11", "3", "2", "4", "11", "11", "W:2-1;D:1-1;L:0-1;W:3-0;W:1-0", "0", ""],
      ["Brasileirao Serie A", "2026", "Santos", "18", "21", "5", "6", "7", "20", "24", "9", "13", "3", "4", "2", "11", "9", "9", "8", "2", "2", "5", "9", "15", "L:0-1;W:2-0;D:1-1;L:1-2;D:0-0", "0", ""],
    ],
    fixturesRows: [
      ["Brasileirao Serie A", "2026", "Round 18", "2026-07-05", "Botafogo", "Flamengo", "2", "1", "final", "false", "", "", "", "", "0", "0", ""],
      ["Brasileirao Serie A", "2026", "Round 19", "2026-07-12", "Botafogo", "Santos", "", "", "scheduled", "false", "42", "29", "29", "Manual check", "0", "0", ""],
    ],
  };
}

export function importCustomCompetitionFromWorkbookSheets(teamsCsv: string, fixturesCsv: string): CustomCompetitionImportResult {
  const warnings: string[] = [];
  const teamRows = rowsToRecords(teamsCsv);
  const fixtureRows = rowsToRecords(fixturesCsv);
  warnings.push(...teamRows.warnings.map((warning) => `Teams sheet: ${warning}`));
  warnings.push(...fixtureRows.warnings.map((warning) => `Fixtures sheet: ${warning}`));

  const teamMap = new Map<string, TeamSheetRecord>();
  const teams: string[] = [];
  teamRows.records.forEach((record, index) => {
    const parsed = recordToTeamSheetRecord(record, index + 2);
    if (!parsed) {
      warnings.push(`Teams sheet row ${index + 2}: skipped because team is required.`);
      return;
    }
    teams.push(parsed.team);
    teamMap.set(teamKey(parsed.competition, parsed.season || "*", parsed.team), parsed);
    if (parsed.season) teamMap.set(teamKey(parsed.competition, "*", parsed.team), parsed);
  });

  const matches: ParsedRawMatch[] = [];
  fixtureRows.records.forEach((record, index) => {
    const match = recordToFixtureSheetMatch(record, index + 2);
    if (!match) {
      warnings.push(`Fixtures sheet row ${index + 2}: home_team and away_team are required.`);
      return;
    }
    if (match.status === "final" && (match.homeGoals === null || match.awayGoals === null)) {
      warnings.push(`Fixtures sheet row ${index + 2}: marked final but missing goals, so it was imported as pending.`);
      match.status = "scheduled";
    }
    matches.push(match);
  });

  const fixtures = matches.map((match) => fixtureSheetMatchToFixture(match, teamMap, warnings));
  const competitions = Array.from(new Set([...teamRows.records.map((record) => text(record, ["competition"], "Custom Competition")), ...matches.map((match) => match.competition)])).filter(Boolean).sort();
  const allTeams = Array.from(new Set([...teams, ...matches.flatMap((match) => [match.homeTeam, match.awayTeam])])).filter(Boolean).sort();
  const finalRows = matches.filter((match) => match.status === "final").length;
  const scheduledRows = matches.filter((match) => match.status === "scheduled").length;

  if (fixtures.length === 0 && warnings.length === 0) warnings.push("No valid Fixtures sheet rows were found.");
  if (teamMap.size === 0) warnings.push("No valid Teams sheet rows were found, so imported fixtures use blank team stats.");
  return { fixtures, warnings, competitions, teams: allTeams, finalRows, scheduledRows };
}

export function exportRawCompetitionTemplateCsv(): string {
  const header = RAW_TEMPLATE_HEADERS.join(",");
  const exampleRows = [
    "Brasileirao Serie A,Round 1,2026-04-12,Botafogo,Santos,2,1,final,,,,,,",
    "Brasileirao Serie A,Round 1,2026-04-12,Flamengo,Palmeiras,1,1,final,,,,,,",
    "Brasileirao Serie A,Round 2,2026-04-19,Botafogo,Palmeiras,,,scheduled,,,,,,",
  ];
  return [header, ...exampleRows].join("\n");
}

export function importCustomCompetitionFromCsv(csv: string): CustomCompetitionImportResult {
  const rows = parseCsvRows(csv.trim());
  const warnings: string[] = [];
  if (rows.length < 2) {
    return {
      fixtures: [],
      warnings: ["Raw competition import needs a header row and at least one match row."],
      competitions: [],
      teams: [],
      finalRows: 0,
      scheduledRows: 0,
    };
  }

  const headers = rows[0].map(normaliseHeader);
  const hasHome = headers.includes("home_team") || headers.includes("home");
  const hasAway = headers.includes("away_team") || headers.includes("away");
  if (!hasHome || !hasAway) {
    return {
      fixtures: [],
      warnings: ["Missing required raw import columns: home_team and away_team."],
      competitions: [],
      teams: [],
      finalRows: 0,
      scheduledRows: 0,
    };
  }

  const matches: ParsedRawMatch[] = [];
  rows.slice(1).forEach((row, index) => {
    const record: RawRecord = {};
    headers.forEach((header, cellIndex) => {
      record[header] = row[cellIndex] ?? "";
    });
    const match = recordToRawMatch(record, index + 2);
    if (!match) {
      warnings.push(`Skipped row ${index + 2}: home_team and away_team are required.`);
      return;
    }
    if (match.status === "final" && (match.homeGoals === null || match.awayGoals === null)) {
      warnings.push(`Row ${index + 2} was marked final but had missing goals, so it was imported as pending.`);
      match.status = "scheduled";
    }
    matches.push(match);
  });

  const fixtures = matches.map((match) => rawMatchToFixture(match, matches));
  const competitions = Array.from(new Set(matches.map((match) => match.competition))).sort();
  const teams = Array.from(new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))).sort();
  const finalRows = matches.filter((match) => match.status === "final").length;
  const scheduledRows = matches.filter((match) => match.status === "scheduled").length;

  if (fixtures.length === 0 && warnings.length === 0) warnings.push("No valid raw competition rows were found.");
  if (finalRows === 0) warnings.push("No completed results were found, so calculated standings/form will be empty until final scores are included.");

  return { fixtures, warnings, competitions, teams, finalRows, scheduledRows };
}
