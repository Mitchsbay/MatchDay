import type { Fixture } from "./sampleData";

export function getAvailableCompetitions(fixtures: Fixture[]): string[] {
  return Array.from(new Set(fixtures.map((fixture) => fixture.competition))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function getHomeTeamsForCompetition(fixtures: Fixture[], competition: string): string[] {
  return Array.from(
    new Set(
      fixtures.filter((fixture) => fixture.competition === competition).map((fixture) => fixture.homeTeam),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function getTeamsForCompetition(fixtures: Fixture[], competition: string): string[] {
  return Array.from(
    new Set(
      fixtures
        .filter((fixture) => fixture.competition === competition)
        .flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam])
        .filter((team) => team.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function getAwayTeamsForMatchup(
  fixtures: Fixture[],
  competition: string,
  homeTeam: string,
): string[] {
  return getTeamsForCompetition(fixtures, competition).filter((team) => team !== homeTeam);
}

export function findFixtureForMatchup(
  fixtures: Fixture[],
  competition: string,
  homeTeam: string,
  awayTeam: string,
): Fixture | undefined {
  return fixtures.find(
    (fixture) =>
      fixture.competition === competition &&
      fixture.homeTeam === homeTeam &&
      fixture.awayTeam === awayTeam,
  );
}
