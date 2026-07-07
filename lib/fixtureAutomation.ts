import type { Fixture } from "./sampleData";
import { createBlankFixture } from "./workspace";

export type FixtureGenerationMode = "append" | "replace";
export type FixtureGenerationFormat = "single" | "double";

export type FixtureGenerationRequest = {
  competition: string;
  teamsText: string;
  startRound: number;
  format: FixtureGenerationFormat;
  dateLabel: string;
};

export type FixtureGenerationResult = {
  fixtures: Fixture[];
  teams: string[];
  warnings: string[];
};

const BYE_TEAM = "__BYE__";

function cleanTeamName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function makeFixtureId(prefix: string, homeTeam: string, awayTeam: string, index: number): string {
  const slug = `${homeTeam}-vs-${awayTeam}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 52);
  return `${prefix}-${String(index + 1).padStart(3, "0")}-${slug || "fixture"}`;
}

export function parseFixtureGeneratorTeams(teamsText: string): {
  teams: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const teams: string[] = [];

  teamsText
    .split(/\r?\n|,/)
    .map(cleanTeamName)
    .filter(Boolean)
    .forEach((team) => {
      const key = team.toLowerCase();
      if (seen.has(key)) {
        warnings.push(`Duplicate team skipped: ${team}.`);
        return;
      }
      seen.add(key);
      teams.push(team);
    });

  if (teams.length < 2) {
    warnings.push("Add at least two unique teams before generating fixtures.");
  }

  if (teams.length % 2 === 1 && teams.length >= 3) {
    warnings.push("Odd number of teams detected. A bye was added automatically each round.");
  }

  return { teams, warnings };
}

function buildRoundRobinPairings(teams: string[]): Array<Array<[string, string]>> {
  const rotatingTeams = teams.length % 2 === 0 ? [...teams] : [...teams, BYE_TEAM];
  const teamCount = rotatingTeams.length;
  const rounds: Array<Array<[string, string]>> = [];
  let rotation = [...rotatingTeams];

  for (let roundIndex = 0; roundIndex < teamCount - 1; roundIndex += 1) {
    const pairs: Array<[string, string]> = [];

    for (let pairIndex = 0; pairIndex < teamCount / 2; pairIndex += 1) {
      const left = rotation[pairIndex];
      const right = rotation[teamCount - 1 - pairIndex];
      if (left === BYE_TEAM || right === BYE_TEAM) continue;

      const shouldSwap = (roundIndex + pairIndex) % 2 === 1;
      pairs.push(shouldSwap ? [right, left] : [left, right]);
    }

    rounds.push(pairs);
    rotation = [rotation[0], rotation[teamCount - 1], ...rotation.slice(1, teamCount - 1)];
  }

  return rounds;
}

export function generateRoundRobinFixtures(
  request: FixtureGenerationRequest,
): FixtureGenerationResult {
  const { teams, warnings } = parseFixtureGeneratorTeams(request.teamsText);
  if (teams.length < 2) return { fixtures: [], teams, warnings };

  const competition = cleanTeamName(request.competition) || "Generated Competition";
  const startRound = Number.isFinite(request.startRound) && request.startRound > 0
    ? Math.floor(request.startRound)
    : 1;
  const dateLabel = cleanTeamName(request.dateLabel) || "TBC";
  const schedulePrefix = `generated-${Date.now()}`;
  const firstLegRounds = buildRoundRobinPairings(teams);
  const roundSets = request.format === "double"
    ? [
        ...firstLegRounds,
        ...firstLegRounds.map((round) => round.map(([home, away]) => [away, home] as [string, string])),
      ]
    : firstLegRounds;

  const fixtures: Fixture[] = [];

  roundSets.forEach((roundPairs, roundIndex) => {
    const roundName = `Round ${startRound + roundIndex}`;
    roundPairs.forEach(([homeTeam, awayTeam]) => {
      const fixture = createBlankFixture(roundName, competition);
      fixtures.push({
        ...fixture,
        id: makeFixtureId(schedulePrefix, homeTeam, awayTeam, fixtures.length),
        date: dateLabel,
        homeTeam,
        awayTeam,
      });
    });
  });

  return { fixtures, teams, warnings };
}
