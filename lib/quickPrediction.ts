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

export function getAwayTeamsForMatchup(
  fixtures: Fixture[],
  competition: string,
  homeTeam: string,
): string[] {
  return Array.from(
    new Set(
      fixtures
        .filter((fixture) => fixture.competition === competition && fixture.homeTeam === homeTeam)
        .map((fixture) => fixture.awayTeam),
    ),
  ).sort((a, b) => a.localeCompare(b));
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
