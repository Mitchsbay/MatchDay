import type { Fixture } from "./sampleData";

export type EvidenceGateId = "quality" | "form" | "availability" | "context" | "odds" | "result";
export type EvidenceGateStatus = "complete" | "partial" | "missing" | "pending";

export type EvidenceGateAudit = {
  gateId: EvidenceGateId;
  gateName: string;
  status: EvidenceGateStatus;
  score: number;
  maxScore: number;
  evidence: string[];
  missing: string[];
};

export type FixtureEvidenceAudit = {
  fixtureId: string;
  fixtureLabel: string;
  completenessScore: number;
  status: "ready" | "review" | "incomplete";
  gates: EvidenceGateAudit[];
  blockers: string[];
  warnings: string[];
  sourceSummary: string;
};

export type EvidenceAuditSummary = {
  fixtureCount: number;
  averageCompleteness: number;
  readyFixtures: number;
  reviewFixtures: number;
  incompleteFixtures: number;
  fixturesNeedingAttention: FixtureEvidenceAudit[];
};

function hasStats(stats: Fixture["homeStats"]) {
  return stats.played > 0 && stats.points >= 0 && (stats.goalsFor > 0 || stats.goalsAgainst > 0 || stats.wins > 0 || stats.draws > 0 || stats.losses > 0);
}

function hasVenueStats(stats: Fixture["homeStats"], side: "home" | "away") {
  if (side === "home") return stats.homePlayed > 0;
  return stats.awayPlayed > 0;
}

function hasRecentForm(form: Fixture["homeRecentForm"]) {
  return form.some((game) => game.goalsFor > 0 || game.goalsAgainst > 0 || game.result !== "D");
}

function namedMissingPlayers(players: Fixture["homeMissingPlayers"]) {
  return players.filter((player) => player.name.trim() || player.role.trim());
}

function hasAnyContext(context: Fixture["homeContext"] | Fixture["matchContext"]) {
  return Object.values(context).some(Boolean);
}

function oddsTotal(fixture: Fixture) {
  return fixture.oddsMarket.homeWinProbability + fixture.oddsMarket.drawProbability + fixture.oddsMarket.awayWinProbability;
}

function gateStatus(score: number, maxScore: number): EvidenceGateStatus {
  if (score >= maxScore) return "complete";
  if (score <= 0) return "missing";
  return "partial";
}

function auditQuality(fixture: Fixture): EvidenceGateAudit {
  const evidence: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (hasStats(fixture.homeStats)) {
    score += 2;
    evidence.push(`${fixture.homeTeam} overall stats supplied (${fixture.homeStats.played} played).`);
  } else {
    missing.push(`${fixture.homeTeam} overall stats are blank.`);
  }

  if (hasStats(fixture.awayStats)) {
    score += 2;
    evidence.push(`${fixture.awayTeam} overall stats supplied (${fixture.awayStats.played} played).`);
  } else {
    missing.push(`${fixture.awayTeam} overall stats are blank.`);
  }

  if (hasVenueStats(fixture.homeStats, "home")) {
    score += 1;
    evidence.push(`${fixture.homeTeam} home split supplied.`);
  } else {
    missing.push(`${fixture.homeTeam} home split is blank.`);
  }

  if (hasVenueStats(fixture.awayStats, "away")) {
    score += 1;
    evidence.push(`${fixture.awayTeam} away split supplied.`);
  } else {
    missing.push(`${fixture.awayTeam} away split is blank.`);
  }

  return { gateId: "quality", gateName: "Quality Gate", status: gateStatus(score, 6), score, maxScore: 6, evidence, missing };
}

function auditForm(fixture: Fixture): EvidenceGateAudit {
  const evidence: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (hasRecentForm(fixture.homeRecentForm)) {
    score += 2;
    evidence.push(`${fixture.homeTeam} recent form supplied.`);
  } else {
    missing.push(`${fixture.homeTeam} recent form is blank/default.`);
  }

  if (hasRecentForm(fixture.awayRecentForm)) {
    score += 2;
    evidence.push(`${fixture.awayTeam} recent form supplied.`);
  } else {
    missing.push(`${fixture.awayTeam} recent form is blank/default.`);
  }

  if (fixture.homeRecentForm.length >= 5 && fixture.awayRecentForm.length >= 5) {
    score += 1;
    evidence.push("Five-game form window available for both teams.");
  } else {
    missing.push("Less than five recent games are available for one or both teams.");
  }

  return { gateId: "form", gateName: "Form Gate", status: gateStatus(score, 5), score, maxScore: 5, evidence, missing };
}

function auditAvailability(fixture: Fixture): EvidenceGateAudit {
  const evidence: string[] = [];
  const missing: string[] = [];
  const homeNamed = namedMissingPlayers(fixture.homeMissingPlayers);
  const awayNamed = namedMissingPlayers(fixture.awayMissingPlayers);
  const homeBlankRows = fixture.homeMissingPlayers.length - homeNamed.length;
  const awayBlankRows = fixture.awayMissingPlayers.length - awayNamed.length;
  let score = 0;

  if (homeNamed.length > 0 || awayNamed.length > 0) {
    score += 3;
    if (homeNamed.length > 0) evidence.push(`${fixture.homeTeam}: ${homeNamed.length} named availability item${homeNamed.length === 1 ? "" : "s"}.`);
    if (awayNamed.length > 0) evidence.push(`${fixture.awayTeam}: ${awayNamed.length} named availability item${awayNamed.length === 1 ? "" : "s"}.`);
  } else {
    missing.push("No named availability evidence has been entered for either team.");
  }

  if (homeBlankRows === 0 && awayBlankRows === 0) {
    score += 1;
    evidence.push("No blank missing-player rows remain.");
  } else {
    missing.push(`${homeBlankRows + awayBlankRows} placeholder missing-player row${homeBlankRows + awayBlankRows === 1 ? "" : "s"} remain.`);
  }

  return { gateId: "availability", gateName: "Availability Gate", status: gateStatus(score, 4), score, maxScore: 4, evidence, missing };
}

function auditContext(fixture: Fixture): EvidenceGateAudit {
  const evidence: string[] = [];
  const missing: string[] = [];
  let score = 0;
  if (hasAnyContext(fixture.homeContext) || hasAnyContext(fixture.awayContext)) {
    score += 2;
    evidence.push("Team motivation/context flags supplied.");
  } else {
    missing.push("No team motivation/context flags selected.");
  }
  if (hasAnyContext(fixture.matchContext)) {
    score += 1;
    evidence.push("Match-level volatility/context flags supplied.");
  } else {
    missing.push("No match-level context flags selected.");
  }
  return { gateId: "context", gateName: "Context Gate", status: gateStatus(score, 3), score, maxScore: 3, evidence, missing };
}

function auditOdds(fixture: Fixture): EvidenceGateAudit {
  const evidence: string[] = [];
  const missing: string[] = [];
  const total = oddsTotal(fixture);
  let score = 0;

  if (total > 0) {
    score += 2;
    evidence.push(`External probabilities supplied (${Math.round(total)}% total).`);
  } else {
    missing.push("External 1X2 probabilities are blank.");
  }

  if (fixture.oddsMarket.sourceLabel.trim()) {
    score += 1;
    evidence.push(`Source label: ${fixture.oddsMarket.sourceLabel.trim()}.`);
  } else {
    missing.push("Odds/source label is blank.");
  }

  if (total >= 95 && total <= 105) {
    score += 1;
    evidence.push("Probabilities add close to 100%.");
  } else if (total > 0) {
    missing.push("Probabilities do not add close to 100%.");
  }

  return { gateId: "odds", gateName: "Odds Gate", status: gateStatus(score, 4), score, maxScore: 4, evidence, missing };
}

function auditResult(fixture: Fixture): EvidenceGateAudit {
  if (fixture.matchResult.status !== "final") {
    return {
      gateId: "result",
      gateName: "Result Tracking",
      status: "pending",
      score: 0,
      maxScore: 1,
      evidence: ["Fixture result is still pending."],
      missing: [],
    };
  }
  return {
    gateId: "result",
    gateName: "Result Tracking",
    status: "complete",
    score: 1,
    maxScore: 1,
    evidence: [`Final score entered: ${fixture.matchResult.homeGoals}-${fixture.matchResult.awayGoals}.`],
    missing: [],
  };
}

export function auditFixtureEvidence(fixture: Fixture): FixtureEvidenceAudit {
  const gates = [
    auditQuality(fixture),
    auditForm(fixture),
    auditAvailability(fixture),
    auditContext(fixture),
    auditOdds(fixture),
    auditResult(fixture),
  ];
  const scoringGates = gates.filter((gate) => gate.gateId !== "result");
  const total = scoringGates.reduce((sum, gate) => sum + gate.score, 0);
  const max = scoringGates.reduce((sum, gate) => sum + gate.maxScore, 0);
  const completenessScore = max > 0 ? Math.round((total / max) * 100) : 0;
  const blockers = scoringGates
    .filter((gate) => gate.status === "missing")
    .map((gate) => `${gate.gateName}: ${gate.missing[0] ?? "missing evidence"}`);
  const warnings = scoringGates
    .filter((gate) => gate.status === "partial")
    .map((gate) => `${gate.gateName}: ${gate.missing[0] ?? "partial evidence"}`);
  const status = blockers.length > 0 || completenessScore < 60 ? "incomplete" : warnings.length > 0 || completenessScore < 85 ? "review" : "ready";
  const sourceSummary = fixture.id.startsWith("fixture-")
    ? "Manual/generated fixture"
    : fixture.id.startsWith("csv-")
      ? "CSV-imported fixture"
      : /^\d+$/.test(fixture.id)
        ? "Live fixture cache"
        : "Workspace/sample fixture";

  return {
    fixtureId: fixture.id,
    fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    completenessScore,
    status,
    gates,
    blockers,
    warnings,
    sourceSummary,
  };
}

export function summariseEvidenceAudits(fixtures: Fixture[]): EvidenceAuditSummary {
  const audits = fixtures.map(auditFixtureEvidence);
  const fixtureCount = audits.length;
  const averageCompleteness = fixtureCount > 0
    ? Math.round(audits.reduce((sum, audit) => sum + audit.completenessScore, 0) / fixtureCount)
    : 0;
  const readyFixtures = audits.filter((audit) => audit.status === "ready").length;
  const reviewFixtures = audits.filter((audit) => audit.status === "review").length;
  const incompleteFixtures = audits.filter((audit) => audit.status === "incomplete").length;
  const fixturesNeedingAttention = audits
    .filter((audit) => audit.status !== "ready")
    .sort((a, b) => a.completenessScore - b.completenessScore)
    .slice(0, 6);

  return { fixtureCount, averageCompleteness, readyFixtures, reviewFixtures, incompleteFixtures, fixturesNeedingAttention };
}
