import type { Fixture, UserTip } from "./sampleData";
import { auditFixtureEvidence } from "./evidenceAudit";
import { normaliseComparableName } from "./teamAliases";

export type CompetitionDataQualitySeverity = "blocker" | "warning" | "info";

export type CompetitionDataQualityIssue = {
  severity: CompetitionDataQualitySeverity;
  category: string;
  message: string;
  count: number;
  fixtureIds: string[];
};

export type CompetitionDataQualitySummary = {
  competition: string;
  fixtureCount: number;
  finalResults: number;
  scheduledOrPending: number;
  postponedOrCancelled: number;
  uniqueTeams: number;
  averageEvidenceCompleteness: number;
  readyFixtures: number;
  reviewFixtures: number;
  incompleteFixtures: number;
  duplicateFixtureRows: number;
  possibleTeamNameVariants: number;
  orphanedTips: number;
  dataQualityScore: number;
  status: "healthy" | "review" | "needs-work";
  issues: CompetitionDataQualityIssue[];
};

function text(value: string | undefined | null) {
  return String(value ?? "").trim();
}

function lower(value: string | undefined | null) {
  return text(value).toLowerCase();
}

function isBlankOrTbd(value: string | undefined | null) {
  const clean = lower(value);
  return clean === "" || clean === "tbd" || clean === "to be decided" || clean === "unknown";
}

function isFinal(fixture: Fixture) {
  return fixture.matchResult.status === "final";
}

function isPostponedOrCancelled(fixture: Fixture) {
  const status = lower(fixture.matchResult.status);
  return status === "postponed" || status === "cancelled";
}

function hasScore(fixture: Fixture) {
  return (
    Number.isFinite(fixture.matchResult.homeGoals) &&
    Number.isFinite(fixture.matchResult.awayGoals)
  );
}

function hasUsefulStats(fixture: Fixture, side: "home" | "away") {
  const stats = side === "home" ? fixture.homeStats : fixture.awayStats;
  return (
    stats.played > 0 ||
    stats.points > 0 ||
    stats.wins > 0 ||
    stats.draws > 0 ||
    stats.losses > 0 ||
    stats.goalsFor > 0 ||
    stats.goalsAgainst > 0
  );
}

function hasVenueSplit(fixture: Fixture, side: "home" | "away") {
  const stats = side === "home" ? fixture.homeStats : fixture.awayStats;
  return stats.homePlayed > 0 || stats.awayPlayed > 0;
}

function fixtureMatchKey(fixture: Fixture) {
  return [
    lower(fixture.competition),
    lower(fixture.round),
    lower(fixture.date),
    normaliseComparableName(fixture.homeTeam),
    normaliseComparableName(fixture.awayTeam),
  ].join("|");
}

function pushIssue(issues: CompetitionDataQualityIssue[], issue: CompetitionDataQualityIssue) {
  if (issue.count <= 0) return;
  issues.push(issue);
}

function statusFromScore(score: number, blockers: number): CompetitionDataQualitySummary["status"] {
  if (blockers > 0 || score < 60) return "needs-work";
  if (score < 85) return "review";
  return "healthy";
}

export function summariseCompetitionDataQuality(
  fixtures: Fixture[],
  userTips: UserTip[],
  competition: string,
): CompetitionDataQualitySummary {
  const scopedFixtures = fixtures.filter((fixture) => fixture.competition === competition);
  const issues: CompetitionDataQualityIssue[] = [];
  const fixtureIdSet = new Set(fixtures.map((fixture) => fixture.id));
  const orphanedTips = userTips.filter((tip) => !fixtureIdSet.has(tip.fixtureId)).length;

  const missingTeams = scopedFixtures.filter(
    (fixture) => isBlankOrTbd(fixture.homeTeam) || isBlankOrTbd(fixture.awayTeam),
  );
  pushIssue(issues, {
    severity: "blocker",
    category: "Fixture teams",
    message: "Some fixtures have blank/TBD home or away teams, so Quick Prediction and team evidence matching may be unreliable.",
    count: missingTeams.length,
    fixtureIds: missingTeams.map((fixture) => fixture.id),
  });

  const missingDates = scopedFixtures.filter((fixture) => isBlankOrTbd(fixture.date));
  pushIssue(issues, {
    severity: "warning",
    category: "Fixture dates",
    message: "Some fixtures have no date/TBC date. They can still be tipped, but update matching and weekly review are safer with dates.",
    count: missingDates.length,
    fixtureIds: missingDates.map((fixture) => fixture.id),
  });

  const finalWithoutScores = scopedFixtures.filter((fixture) => isFinal(fixture) && !hasScore(fixture));
  pushIssue(issues, {
    severity: "blocker",
    category: "Final results",
    message: "Some fixtures are marked final but do not have both scores. Standings and calibration cannot use them safely.",
    count: finalWithoutScores.length,
    fixtureIds: finalWithoutScores.map((fixture) => fixture.id),
  });

  const negativeScores = scopedFixtures.filter(
    (fixture) =>
      Number(fixture.matchResult.homeGoals) < 0 || Number(fixture.matchResult.awayGoals) < 0,
  );
  pushIssue(issues, {
    severity: "blocker",
    category: "Final results",
    message: "Some fixtures contain negative score values.",
    count: negativeScores.length,
    fixtureIds: negativeScores.map((fixture) => fixture.id),
  });

  const missingStats = scopedFixtures.filter(
    (fixture) => !hasUsefulStats(fixture, "home") || !hasUsefulStats(fixture, "away"),
  );
  pushIssue(issues, {
    severity: "warning",
    category: "Team evidence",
    message: "Some fixtures are missing useful team-stat evidence for one or both sides.",
    count: missingStats.length,
    fixtureIds: missingStats.map((fixture) => fixture.id),
  });

  const missingVenueSplits = scopedFixtures.filter(
    (fixture) => !hasVenueSplit(fixture, "home") || !hasVenueSplit(fixture, "away"),
  );
  pushIssue(issues, {
    severity: "info",
    category: "Home/away splits",
    message: "Some fixtures do not have home/away split evidence. The model can still run, but venue-specific strength is weaker.",
    count: missingVenueSplits.length,
    fixtureIds: missingVenueSplits.map((fixture) => fixture.id),
  });

  const missingForm = scopedFixtures.filter(
    (fixture) => fixture.homeRecentForm.length === 0 || fixture.awayRecentForm.length === 0,
  );
  pushIssue(issues, {
    severity: "warning",
    category: "Recent form",
    message: "Some fixtures are missing recent-form evidence for one or both teams.",
    count: missingForm.length,
    fixtureIds: missingForm.map((fixture) => fixture.id),
  });

  const keyCounts = new Map<string, Fixture[]>();
  for (const fixture of scopedFixtures) {
    const key = fixtureMatchKey(fixture);
    keyCounts.set(key, [...(keyCounts.get(key) ?? []), fixture]);
  }
  const duplicateGroups = Array.from(keyCounts.values()).filter((group) => group.length > 1);
  const duplicateFixtureRows = duplicateGroups.reduce((total, group) => total + group.length, 0);
  pushIssue(issues, {
    severity: "warning",
    category: "Duplicate fixtures",
    message: "Possible duplicate fixture rows found using competition + round + date + home + away matching.",
    count: duplicateFixtureRows,
    fixtureIds: duplicateGroups.flat().map((fixture) => fixture.id),
  });

  const teamNames = new Set<string>();
  for (const fixture of scopedFixtures) {
    if (!isBlankOrTbd(fixture.homeTeam)) teamNames.add(fixture.homeTeam.trim());
    if (!isBlankOrTbd(fixture.awayTeam)) teamNames.add(fixture.awayTeam.trim());
  }
  const comparableGroups = new Map<string, Set<string>>();
  for (const teamName of teamNames) {
    const key = normaliseComparableName(teamName);
    comparableGroups.set(key, new Set([...(comparableGroups.get(key) ?? []), teamName]));
  }
  const variantGroups = Array.from(comparableGroups.values()).filter((group) => group.size > 1);
  pushIssue(issues, {
    severity: "warning",
    category: "Team names",
    message: "Possible spelling/accent variants found. Review the Team Alias panel before importing more weekly updates.",
    count: variantGroups.length,
    fixtureIds: [],
  });

  pushIssue(issues, {
    severity: "warning",
    category: "Tips",
    message: "Some saved tips point at fixture IDs that no longer exist in the workspace.",
    count: orphanedTips,
    fixtureIds: [],
  });

  const evidenceAudits = scopedFixtures.map(auditFixtureEvidence);
  const averageEvidenceCompleteness = evidenceAudits.length
    ? Math.round(evidenceAudits.reduce((sum, audit) => sum + audit.completenessScore, 0) / evidenceAudits.length)
    : 0;
  const readyFixtures = evidenceAudits.filter((audit) => audit.status === "ready").length;
  const reviewFixtures = evidenceAudits.filter((audit) => audit.status === "review").length;
  const incompleteFixtures = evidenceAudits.filter((audit) => audit.status === "incomplete").length;

  const blockers = issues.filter((issue) => issue.severity === "blocker").reduce((total, issue) => total + issue.count, 0);
  const warnings = issues.filter((issue) => issue.severity === "warning").reduce((total, issue) => total + issue.count, 0);
  const infos = issues.filter((issue) => issue.severity === "info").reduce((total, issue) => total + issue.count, 0);
  const dataQualityScore = Math.max(
    0,
    Math.min(100, Math.round(averageEvidenceCompleteness - blockers * 12 - warnings * 3 - infos * 1)),
  );

  return {
    competition,
    fixtureCount: scopedFixtures.length,
    finalResults: scopedFixtures.filter(isFinal).length,
    scheduledOrPending: scopedFixtures.filter(
      (fixture) => !isFinal(fixture) && !isPostponedOrCancelled(fixture),
    ).length,
    postponedOrCancelled: scopedFixtures.filter(isPostponedOrCancelled).length,
    uniqueTeams: teamNames.size,
    averageEvidenceCompleteness,
    readyFixtures,
    reviewFixtures,
    incompleteFixtures,
    duplicateFixtureRows,
    possibleTeamNameVariants: variantGroups.length,
    orphanedTips,
    dataQualityScore,
    status: statusFromScore(dataQualityScore, blockers),
    issues,
  };
}
