import type { Fixture } from "./sampleData";
import {
  emptyRecentForm,
  emptyScores,
} from "./scoringEngine";
import { createBlankFixture, normaliseRound } from "./workspace";

const CSV_HEADERS = [
  "competition",
  "round",
  "date",
  "home_team",
  "away_team",
  "home_played",
  "home_points",
  "home_wins",
  "home_draws",
  "home_losses",
  "home_gf",
  "home_ga",
  "home_home_played",
  "home_home_points",
  "home_home_gf",
  "home_home_ga",
  "home_away_played",
  "home_away_points",
  "home_away_gf",
  "home_away_ga",
  "away_played",
  "away_points",
  "away_wins",
  "away_draws",
  "away_losses",
  "away_gf",
  "away_ga",
  "away_home_played",
  "away_home_points",
  "away_home_gf",
  "away_home_ga",
  "away_away_played",
  "away_away_points",
  "away_away_gf",
  "away_away_ga",
  "home_form",
  "away_form",
  "odds_home_pct",
  "odds_draw_pct",
  "odds_away_pct",
  "odds_source",
  "result_status",
  "result_home_goals",
  "result_away_goals",
  "home_advantage",
  "head_to_head_edge",
  "other_stats_edge",
] as const;

type CsvHeader = (typeof CSV_HEADERS)[number];
type CsvRecord = Partial<Record<CsvHeader, string>>;

export type FixtureCsvImportResult = {
  fixtures: Fixture[];
  warnings: string[];
};

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value ?? "");
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

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

function numberCell(record: CsvRecord, key: CsvHeader, fallback = 0): number {
  const raw = record[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function textCell(record: CsvRecord, key: CsvHeader, fallback = ""): string {
  return record[key]?.trim() || fallback;
}

function encodeForm(form: Fixture["homeRecentForm"]): string {
  return form
    .map((game) => `${game.result}:${game.goalsFor}-${game.goalsAgainst}`)
    .join(";");
}

function parseForm(value: string | undefined): Fixture["homeRecentForm"] {
  const blank = emptyRecentForm.map((game) => ({ ...game }));
  if (!value?.trim()) return blank;

  const games = value
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((chunk) => {
      const [resultChunk, scoreChunk = "0-0"] = chunk.split(":");
      const result = resultChunk?.toUpperCase() === "W" || resultChunk?.toUpperCase() === "D" || resultChunk?.toUpperCase() === "L"
        ? resultChunk.toUpperCase()
        : "D";
      const [gfRaw = "0", gaRaw = "0"] = scoreChunk.split("-");
      return {
        result: result as "W" | "D" | "L",
        goalsFor: Math.max(0, Number(gfRaw) || 0),
        goalsAgainst: Math.max(0, Number(gaRaw) || 0),
      };
    });

  while (games.length < 5) games.push({ ...blank[games.length] });
  return games;
}

function fixtureToRow(fixture: Fixture): string[] {
  return [
    fixture.competition,
    fixture.round,
    fixture.date,
    fixture.homeTeam,
    fixture.awayTeam,
    fixture.homeStats.played,
    fixture.homeStats.points,
    fixture.homeStats.wins,
    fixture.homeStats.draws,
    fixture.homeStats.losses,
    fixture.homeStats.goalsFor,
    fixture.homeStats.goalsAgainst,
    fixture.homeStats.homePlayed,
    fixture.homeStats.homePoints,
    fixture.homeStats.homeGoalsFor,
    fixture.homeStats.homeGoalsAgainst,
    fixture.homeStats.awayPlayed,
    fixture.homeStats.awayPoints,
    fixture.homeStats.awayGoalsFor,
    fixture.homeStats.awayGoalsAgainst,
    fixture.awayStats.played,
    fixture.awayStats.points,
    fixture.awayStats.wins,
    fixture.awayStats.draws,
    fixture.awayStats.losses,
    fixture.awayStats.goalsFor,
    fixture.awayStats.goalsAgainst,
    fixture.awayStats.homePlayed,
    fixture.awayStats.homePoints,
    fixture.awayStats.homeGoalsFor,
    fixture.awayStats.homeGoalsAgainst,
    fixture.awayStats.awayPlayed,
    fixture.awayStats.awayPoints,
    fixture.awayStats.awayGoalsFor,
    fixture.awayStats.awayGoalsAgainst,
    encodeForm(fixture.homeRecentForm),
    encodeForm(fixture.awayRecentForm),
    fixture.oddsMarket.homeWinProbability,
    fixture.oddsMarket.drawProbability,
    fixture.oddsMarket.awayWinProbability,
    fixture.oddsMarket.sourceLabel,
    fixture.matchResult.status,
    fixture.matchResult.homeGoals,
    fixture.matchResult.awayGoals,
    fixture.scores.homeAdvantage,
    fixture.scores.headToHeadEdge,
    fixture.scores.otherStatsEdge,
  ].map(String);
}

export function exportFixturesToCsv(fixtures: Fixture[]): string {
  const header = CSV_HEADERS.map(escapeCsvCell).join(",");
  const rows = fixtures.map((fixture) => fixtureToRow(fixture).map(escapeCsvCell).join(","));
  return [header, ...rows].join("\n");
}

function makeFixtureId(record: CsvRecord, rowNumber: number): string {
  const home = textCell(record, "home_team", "home").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const away = textCell(record, "away_team", "away").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `csv-${home || "home"}-${away || "away"}-${rowNumber}-${Date.now()}`;
}

function recordToFixture(record: CsvRecord, rowNumber: number): Fixture {
  const round = normaliseRound(textCell(record, "round", "Imported Round"));
  const fixture = createBlankFixture(round, textCell(record, "competition", "Imported Competition"));
  return {
    ...fixture,
    id: makeFixtureId(record, rowNumber),
    competition: textCell(record, "competition", fixture.competition),
    round,
    date: textCell(record, "date", fixture.date),
    homeTeam: textCell(record, "home_team", fixture.homeTeam),
    awayTeam: textCell(record, "away_team", fixture.awayTeam),
    homeStats: {
      played: numberCell(record, "home_played"),
      points: numberCell(record, "home_points"),
      wins: numberCell(record, "home_wins"),
      draws: numberCell(record, "home_draws"),
      losses: numberCell(record, "home_losses"),
      goalsFor: numberCell(record, "home_gf"),
      goalsAgainst: numberCell(record, "home_ga"),
      homePlayed: numberCell(record, "home_home_played"),
      homePoints: numberCell(record, "home_home_points"),
      homeGoalsFor: numberCell(record, "home_home_gf"),
      homeGoalsAgainst: numberCell(record, "home_home_ga"),
      awayPlayed: numberCell(record, "home_away_played"),
      awayPoints: numberCell(record, "home_away_points"),
      awayGoalsFor: numberCell(record, "home_away_gf"),
      awayGoalsAgainst: numberCell(record, "home_away_ga"),
    },
    awayStats: {
      played: numberCell(record, "away_played"),
      points: numberCell(record, "away_points"),
      wins: numberCell(record, "away_wins"),
      draws: numberCell(record, "away_draws"),
      losses: numberCell(record, "away_losses"),
      goalsFor: numberCell(record, "away_gf"),
      goalsAgainst: numberCell(record, "away_ga"),
      homePlayed: numberCell(record, "away_home_played"),
      homePoints: numberCell(record, "away_home_points"),
      homeGoalsFor: numberCell(record, "away_home_gf"),
      homeGoalsAgainst: numberCell(record, "away_home_ga"),
      awayPlayed: numberCell(record, "away_away_played"),
      awayPoints: numberCell(record, "away_away_points"),
      awayGoalsFor: numberCell(record, "away_away_gf"),
      awayGoalsAgainst: numberCell(record, "away_away_ga"),
    },
    homeRecentForm: parseForm(record.home_form),
    awayRecentForm: parseForm(record.away_form),
    oddsMarket: {
      homeWinProbability: numberCell(record, "odds_home_pct"),
      drawProbability: numberCell(record, "odds_draw_pct"),
      awayWinProbability: numberCell(record, "odds_away_pct"),
      sourceLabel: textCell(record, "odds_source", "CSV import"),
    },
    matchResult: {
      status: textCell(record, "result_status", "pending") === "final" ? "final" : "pending",
      homeGoals: numberCell(record, "result_home_goals"),
      awayGoals: numberCell(record, "result_away_goals"),
    },
    scores: {
      ...emptyScores,
      homeAdvantage: numberCell(record, "home_advantage", 2),
      headToHeadEdge: numberCell(record, "head_to_head_edge", 0),
      otherStatsEdge: numberCell(record, "other_stats_edge", 0),
    },
  };
}

export function importFixturesFromCsv(csv: string): FixtureCsvImportResult {
  const rows = parseCsvRows(csv.trim());
  const warnings: string[] = [];
  if (rows.length < 2) return { fixtures: [], warnings: ["CSV needs a header row and at least one fixture row."] };

  const headers = rows[0].map((header) => header.trim()) as CsvHeader[];
  const missingRequired = ["home_team", "away_team"].filter(
    (header) => !headers.includes(header as CsvHeader),
  );
  if (missingRequired.length > 0) {
    return {
      fixtures: [],
      warnings: [`Missing required CSV columns: ${missingRequired.join(", ")}.`],
    };
  }

  const fixtures: Fixture[] = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      if ((CSV_HEADERS as readonly string[]).includes(header)) {
        record[header] = row[index] ?? "";
      }
    });

    if (!record.home_team?.trim() || !record.away_team?.trim()) {
      warnings.push(`Skipped row ${rowIndex + 2}: home_team and away_team are required.`);
      return;
    }

    fixtures.push(recordToFixture(record, rowIndex + 2));
  });

  if (fixtures.length === 0 && warnings.length === 0) {
    warnings.push("No valid fixture rows were found.");
  }

  return { fixtures, warnings };
}

export const fixtureCsvHeaders = CSV_HEADERS;
