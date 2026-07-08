import type { Fixture } from "./sampleData";

export type TeamAliasRule = {
  id: string;
  alias: string;
  canonical: string;
  competition?: string;
};

export type TeamAliasApplyResult = {
  fixtures: Fixture[];
  changes: string[];
};

export type TeamNameIssue = {
  normalisedName: string;
  variants: string[];
  competitions: string[];
};

export const DEFAULT_TEAM_ALIAS_RULES: TeamAliasRule[] = [
  { id: "br-sao-paulo", alias: "Sao Paulo", canonical: "São Paulo" },
  { id: "br-atletico-mg", alias: "Atletico MG", canonical: "Atlético MG" },
  { id: "br-gremio", alias: "Gremio", canonical: "Grêmio" },
  { id: "br-vitoria", alias: "Vitoria", canonical: "Vitória" },
  { id: "br-athletico-pr-no-h", alias: "Atletico PR", canonical: "Athletico PR" },
];

export function normaliseComparableName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|ec|ac|sc|cr|ca|se|afc|cf|club|de|da|do)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseCompetition(value?: string): string {
  return normaliseComparableName(value ?? "");
}

export function ruleAppliesToCompetition(rule: TeamAliasRule, competition: string): boolean {
  if (!rule.competition?.trim()) return true;
  return normaliseCompetition(rule.competition) === normaliseCompetition(competition);
}

export function normaliseTeamNameWithAliases(
  teamName: string,
  competition: string,
  aliases: TeamAliasRule[],
): string {
  const cleanName = teamName.trim();
  const comparable = normaliseComparableName(cleanName);
  const match = aliases.find(
    (rule) =>
      rule.alias.trim() &&
      rule.canonical.trim() &&
      normaliseComparableName(rule.alias) === comparable &&
      ruleAppliesToCompetition(rule, competition),
  );
  return match ? match.canonical.trim() : cleanName;
}

export function applyTeamAliasesToFixtures(
  fixtures: Fixture[],
  aliases: TeamAliasRule[],
): TeamAliasApplyResult {
  const changes: string[] = [];
  const nextFixtures = fixtures.map((fixture) => {
    const homeTeam = normaliseTeamNameWithAliases(fixture.homeTeam, fixture.competition, aliases);
    const awayTeam = normaliseTeamNameWithAliases(fixture.awayTeam, fixture.competition, aliases);
    if (homeTeam !== fixture.homeTeam) {
      changes.push(`${fixture.competition}: ${fixture.homeTeam} → ${homeTeam}`);
    }
    if (awayTeam !== fixture.awayTeam) {
      changes.push(`${fixture.competition}: ${fixture.awayTeam} → ${awayTeam}`);
    }
    return { ...fixture, homeTeam, awayTeam };
  });
  return { fixtures: nextFixtures, changes: Array.from(new Set(changes)) };
}

export function detectTeamNameIssues(fixtures: Fixture[]): TeamNameIssue[] {
  const groups = new Map<string, { variants: Set<string>; competitions: Set<string> }>();
  fixtures.forEach((fixture) => {
    [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
      const key = normaliseComparableName(teamName);
      if (!key) return;
      const group = groups.get(key) ?? { variants: new Set<string>(), competitions: new Set<string>() };
      group.variants.add(teamName);
      group.competitions.add(fixture.competition);
      groups.set(key, group);
    });
  });
  return Array.from(groups.entries())
    .map(([normalisedName, group]) => ({
      normalisedName,
      variants: Array.from(group.variants).sort(),
      competitions: Array.from(group.competitions).sort(),
    }))
    .filter((issue) => issue.variants.length > 1)
    .sort((a, b) => a.normalisedName.localeCompare(b.normalisedName));
}

export function cloneTeamAliases(aliases: TeamAliasRule[]): TeamAliasRule[] {
  return aliases.map((alias) => ({ ...alias }));
}

export function isTeamAliasRuleArray(value: unknown): value is TeamAliasRule[] {
  return Array.isArray(value) && value.every((rule) => {
    if (!rule || typeof rule !== "object") return false;
    const candidate = rule as Partial<TeamAliasRule>;
    return typeof candidate.id === "string" && typeof candidate.alias === "string" && typeof candidate.canonical === "string";
  });
}
