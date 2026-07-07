import assert from "assert/strict";
import { fixtures } from "../lib/sampleData";
import { exportFixturesToCsv, importFixturesFromCsv } from "../lib/csvWorkspace";
import { generateRoundRobinFixtures, parseFixtureGeneratorTeams } from "../lib/fixtureAutomation";
import {
  applyCalculatedGaps,
  calculateAccuracySummary,
  calculateAvailabilityFromMissingPlayers,
  calculateConflictFromSignals,
  calculateContextFromFlags,
  calculateFormFromRecentResults,
  calculateOddsFromMarket,
  calculateQualityFromTeamStats,
  calculateResultAccuracy,
  calculateRuleLearningSummary,
  emptyMatchContext,
  emptyMissingPlayers,
  defaultRuleWeights,
  emptyScores,
  getPredictedOutcome,
  runPrediction,
  type MissingPlayer,
  type RecentFormGame,
} from "../lib/scoringEngine";
import {
  applyFixtureBatch,
  calculateTipPoints,
  cloneFixtures,
  createBlankFixture,
  createPersistedState,
  getActualOutcomeFromScore,
  normaliseRound,
} from "../lib/workspace";
import { mapLiveFixtureRow, type LiveFixtureRow } from "../lib/liveFixtures";
import { getLiveFixtureStaleCutoffIso, summariseLiveFixtureRows } from "../lib/liveFixtureMaintenance";
import { auditFixtureEvidence, describeFixtureSource, summariseEvidenceAudits } from "../lib/evidenceAudit";

function assertBetween(value: number, min: number, max: number, label: string) {
  assert.ok(
    value >= min && value <= max,
    `${label} expected between ${min} and ${max}, received ${value}`,
  );
}

function runQualityAndPredictionSmokeTest() {
  const fixture = fixtures[0];
  const quality = calculateQualityFromTeamStats(
    fixture.homeStats,
    fixture.awayStats,
  );
  const form = calculateFormFromRecentResults(
    fixture.homeRecentForm,
    fixture.awayRecentForm,
  );
  const availability = calculateAvailabilityFromMissingPlayers(
    fixture.homeMissingPlayers,
    fixture.awayMissingPlayers,
  );
  const context = calculateContextFromFlags(
    fixture.homeContext,
    fixture.awayContext,
    fixture.matchContext,
  );
  const odds = calculateOddsFromMarket(fixture.oddsMarket);

  assert.ok(quality.qualityGap > 0, "sample favourite should have quality edge");
  assert.ok(form.recentFormGap > 0, "sample favourite should have form edge");
  assert.ok(
    availability.injuryRisk < 0,
    "sample away absences should help home-side model edge",
  );
  assert.ok(
    context.motivationEdge >= 0,
    "sample context should not oppose home side",
  );
  assert.ok(odds.oddsSupport > 0, "sample odds should support home side");

  const scoresBeforeConflict = applyCalculatedGaps(
    fixture.scores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    0,
  );
  const conflict = calculateConflictFromSignals({
    scores: scoresBeforeConflict,
    contextWarnings: context.warnings,
    oddsWarnings: odds.warnings,
    volatilityScore: context.volatilityScore,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  assertBetween(conflict.conflictScore, 0, 5, "conflict score");

  const finalScores = applyCalculatedGaps(
    fixture.scores,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    conflict.conflictScore,
  );
  const prediction = runPrediction(finalScores);
  assert.equal(getPredictedOutcome(prediction), "home");
  assert.ok(prediction.confidence >= 50, "sample prediction should be publishable");

  const accuracy = calculateResultAccuracy(prediction, fixture.matchResult);
  assert.equal(accuracy.actualOutcome, "home");
  assert.equal(accuracy.isCorrect, true);
  assert.equal(accuracy.pointsAwarded, 1);
}

function runDirectionalConversionSmokeTests() {
  const strongHome = fixtures[0];
  const reversedQuality = calculateQualityFromTeamStats(
    strongHome.awayStats,
    strongHome.homeStats,
  );
  assert.ok(
    reversedQuality.qualityGap < 0,
    "swapping strong/weak teams should produce away quality edge",
  );

  const wins: RecentFormGame[] = Array.from({ length: 5 }, () => ({
    result: "W",
    goalsFor: 3,
    goalsAgainst: 0,
  }));
  const losses: RecentFormGame[] = Array.from({ length: 5 }, () => ({
    result: "L",
    goalsFor: 0,
    goalsAgainst: 3,
  }));
  assert.equal(calculateFormFromRecentResults(wins, losses).recentFormGap, 4);
  assert.equal(calculateFormFromRecentResults(losses, wins).recentFormGap, -4);
}

function runAvailabilityAndConflictSmokeTests() {
  const criticalAbsence: MissingPlayer = {
    name: "Captain",
    role: "Central defender",
    importance: "critical",
    reason: "suspension",
    expectedStarter: true,
  };
  const homeHit = calculateAvailabilityFromMissingPlayers(
    [criticalAbsence],
    emptyMissingPlayers,
  );
  assert.ok(homeHit.injuryRisk > 0, "home absence should hurt home side");

  const awayHit = calculateAvailabilityFromMissingPlayers(
    emptyMissingPlayers,
    [criticalAbsence],
  );
  assert.ok(awayHit.injuryRisk < 0, "away absence should help home side");

  const odds = calculateOddsFromMarket({
    homeWinProbability: 15,
    drawProbability: 20,
    awayWinProbability: 65,
    sourceLabel: "Smoke test market",
  });
  assert.equal(odds.externalFavourite, "away");
  assert.ok(odds.oddsSupport < 0);

  const conflict = calculateConflictFromSignals({
    scores: {
      ...emptyScores,
      qualityGap: 4,
      homeAdvantage: 2,
      recentFormGap: 2,
      oddsSupport: odds.oddsSupport,
      conflictScore: 0,
    },
    oddsWarnings: odds.warnings,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  assert.ok(
    conflict.conflictScore >= 1,
    "market disagreement should create at least a caution conflict",
  );
}

function runResultAndLearningSmokeTests() {
  const publishedHome = runPrediction({
    ...emptyScores,
    qualityGap: 5,
    homeAdvantage: 2,
    recentFormGap: 2,
    conflictScore: 0,
  });
  const correctHome = calculateResultAccuracy(publishedHome, {
    status: "final",
    homeGoals: 2,
    awayGoals: 0,
  });
  assert.equal(correctHome.isCorrect, true);

  const reviewPrediction = runPrediction({
    ...emptyScores,
    qualityGap: 1,
    recentFormGap: -4,
    oddsSupport: -2,
    conflictScore: 5,
  });
  const reviewedAccuracy = calculateResultAccuracy(reviewPrediction, {
    status: "final",
    homeGoals: 0,
    awayGoals: 1,
  });
  assert.equal(reviewedAccuracy.isTipPublished, false);
  assert.equal(reviewedAccuracy.isCorrect, null);

  const summary = calculateAccuracySummary(
    [correctHome, reviewedAccuracy],
    [publishedHome.confidence, reviewPrediction.confidence],
  );
  assert.equal(summary.finalFixtures, 2);
  assert.equal(summary.publishedTips, 1);
  assert.equal(summary.correctTips, 1);
  assert.equal(summary.reviewOrNoTips, 1);

  const learning = calculateRuleLearningSummary([
    { prediction: publishedHome, accuracy: correctHome },
    { prediction: reviewPrediction, accuracy: reviewedAccuracy },
  ]);
  assert.equal(learning.settledFixtures, 2);
  assert.ok(learning.learningItems.length > 0);
}

function runWorkspaceSmokeTests() {
  assert.equal(normaliseRound("  "), "Unassigned");
  assert.equal(normaliseRound(" Round 3 "), "Round 3");

  const blank = createBlankFixture("Round 99");
  assert.equal(blank.round, "Round 99");
  assert.equal(blank.scores.homeAdvantage, 2);
  assert.equal(blank.homeRecentForm.length, 5);

  const cloned = cloneFixtures([fixtures[0]]);
  cloned[0].homeStats.points = 0;
  assert.notEqual(
    cloned[0].homeStats.points,
    fixtures[0].homeStats.points,
    "fixture clone should not mutate source fixture",
  );

  assert.equal(
    getActualOutcomeFromScore({ status: "final", homeGoals: 1, awayGoals: 1 }),
    "draw",
  );
  assert.equal(calculateTipPoints("draw", "draw"), 2);
  assert.equal(calculateTipPoints("home", "away"), 0);

  const persisted = createPersistedState(
    [blank],
    blank.id,
    blank.round,
    defaultRuleWeights,
    [],
    [],
  );
  assert.equal(persisted.fixtures.length, 1);
  assert.equal(persisted.selectedRound, "Round 99");
}


function runCsvImportExportSmokeTests() {
  const csv = exportFixturesToCsv([fixtures[0]]);
  assert.ok(csv.includes("home_team"), "CSV export should include fixture headers");
  assert.ok(csv.includes(fixtures[0].homeTeam), "CSV export should include home team name");

  const imported = importFixturesFromCsv(csv);
  assert.equal(imported.fixtures.length, 1);
  assert.equal(imported.fixtures[0].homeTeam, fixtures[0].homeTeam);
  assert.equal(imported.fixtures[0].awayTeam, fixtures[0].awayTeam);
  assert.equal(imported.fixtures[0].homeStats.points, fixtures[0].homeStats.points);
  assert.equal(imported.fixtures[0].homeRecentForm.length, 5);
  assert.equal(imported.fixtures[0].matchResult.status, fixtures[0].matchResult.status);

  const formulaFixture = {
    ...fixtures[0],
    competition: "=SUM(1,1)",
    round: "+Round",
    homeTeam: "@Home",
    awayTeam: "-Away",
    oddsMarket: { ...fixtures[0].oddsMarket, sourceLabel: "=Market" },
  };
  const guardedCsv = exportFixturesToCsv([formulaFixture]);
  assert.ok(guardedCsv.includes("'=SUM(1,1)"), "CSV export should neutralise formula-like competition text");
  assert.ok(guardedCsv.includes("'+Round"), "CSV export should neutralise formula-like round text");
  assert.ok(guardedCsv.includes("'@Home"), "CSV export should neutralise formula-like home team text");
  assert.ok(guardedCsv.includes("'-Away"), "CSV export should neutralise formula-like away team text");
  assert.ok(guardedCsv.includes("'=Market"), "CSV export should neutralise formula-like odds source text");
}

function runFixtureAutomationSmokeTests() {
  const parsed = parseFixtureGeneratorTeams("Arsenal\nChelsea\narsenal\nLiverpool");
  assert.deepEqual(parsed.teams, ["Arsenal", "Chelsea", "Liverpool"]);
  assert.ok(parsed.warnings.some((warning) => warning.includes("Duplicate team skipped")));

  const single = generateRoundRobinFixtures({
    competition: "Smoke League",
    teamsText: "A\nB\nC\nD",
    startRound: 3,
    format: "single",
    dateLabel: "TBC",
  });
  assert.equal(single.fixtures.length, 6, "4-team single round robin should generate 6 fixtures");
  assert.equal(single.fixtures[0].competition, "Smoke League");
  assert.equal(single.fixtures[0].round, "Round 3");
  assert.equal(new Set(single.fixtures.map((fixture) => fixture.id)).size, single.fixtures.length);

  const uniquePairs = new Set(
    single.fixtures.map((fixture) => [fixture.homeTeam, fixture.awayTeam].sort().join("|")),
  );
  assert.equal(uniquePairs.size, 6, "single round robin should create each pairing once");

  const double = generateRoundRobinFixtures({
    competition: "Smoke League",
    teamsText: "A\nB\nC\nD",
    startRound: 1,
    format: "double",
    dateLabel: "TBC",
  });
  assert.equal(double.fixtures.length, 12, "4-team double round robin should generate 12 fixtures");

  const odd = generateRoundRobinFixtures({
    competition: "Odd League",
    teamsText: "A\nB\nC",
    startRound: 1,
    format: "single",
    dateLabel: "TBC",
  });
  assert.equal(odd.fixtures.length, 3, "3-team single round robin should generate 3 played fixtures with byes skipped");
  assert.ok(odd.warnings.some((warning) => warning.includes("Odd number of teams")));
}

function runWorkspaceBatchAndLiveFixturesSmokeTests() {
  const existingFixture = createBlankFixture("Round 1", "Sample League");
  const survivingFixture = { ...createBlankFixture("Round 2", "Sample League"), id: "keeps-this-one" };
  const currentTips = [
    { fixtureId: existingFixture.id, entrantId: "e1", pick: "home" as const, confidence: 60 },
    { fixtureId: survivingFixture.id, entrantId: "e1", pick: "away" as const, confidence: 55 },
  ];

  const appended = applyFixtureBatch([survivingFixture], [existingFixture], currentTips, "append");
  assert.equal(appended.fixtures.length, 2, "append mode should keep existing fixtures plus new ones");
  assert.equal(appended.tips.length, 2, "append mode should never touch existing tips");
  assert.equal(appended.orphanedTipsCount, 0);

  const replaced = applyFixtureBatch([survivingFixture], [existingFixture], currentTips, "replace");
  assert.equal(replaced.fixtures.length, 1, "replace mode should only keep the new fixtures");
  assert.equal(replaced.tips.length, 1, "replace mode should drop tips pointing at removed fixtures");
  assert.equal(replaced.tips[0].fixtureId, "keeps-this-one");
  assert.equal(replaced.orphanedTipsCount, 1);

  const row: LiveFixtureRow = {
    id: "12345",
    competition: "Premier League",
    round: "Matchday 10",
    match_date: "2026-11-01T15:00:00Z",
    home_team: "Arsenal",
    away_team: "Chelsea",
    home_stats: { ...createBlankFixture("Round 1").homeStats, points: 25, played: 10 },
    away_stats: { ...createBlankFixture("Round 1").awayStats, points: 18, played: 10 },
    home_recent_form: [{ result: "W", goalsFor: 2, goalsAgainst: 0 }],
    away_recent_form: [{ result: "D", goalsFor: 1, goalsAgainst: 1 }],
  };
  const mapped = mapLiveFixtureRow(row);
  assert.equal(mapped.id, "12345");
  assert.equal(mapped.homeTeam, "Arsenal");
  assert.equal(mapped.awayTeam, "Chelsea");
  assert.equal(mapped.homeStats.points, 25);
  assert.equal(mapped.homeRecentForm[0].result, "W");
  // Fields football-data.org has no source for should fall back to blank
  // defaults, same as a CSV-imported or generated fixture.
  assert.equal(mapped.oddsMarket.homeWinProbability, createBlankFixture("x").oddsMarket.homeWinProbability);
  assert.equal(mapped.matchResult.status, "pending");
  assert.equal(mapped.homeMissingPlayers.length, createBlankFixture("x").homeMissingPlayers.length);
}


function runEvidenceAuditSmokeTests() {
  const strongSample = auditFixtureEvidence(fixtures[0]);
  assert.equal(strongSample.fixtureId, fixtures[0].id);
  assertBetween(strongSample.completenessScore, 1, 100, "sample evidence completeness");
  assert.ok(strongSample.gates.some((gate) => gate.gateId === "quality"), "audit should include quality gate");

  const blank = createBlankFixture("Audit Round", "Audit League");
  const blankAudit = auditFixtureEvidence(blank);
  assert.equal(blankAudit.status, "incomplete");
  assert.ok(blankAudit.blockers.length > 0, "blank fixture should produce blockers");

  const summary = summariseEvidenceAudits([fixtures[0], blank]);
  assert.equal(summary.fixtureCount, 2);
  assert.ok(summary.averageCompleteness > 0);
  assert.ok(summary.incompleteFixtures >= 1);
  assert.ok(summary.fixturesNeedingAttention.some((audit) => audit.fixtureId === blank.id));

  // Every ID pattern actually produced by each fixture-creation pipeline, so a
  // future pipeline whose prefix isn't recognised here fails loudly instead of
  // silently collapsing into "Workspace/sample fixture".
  assert.equal(describeFixtureSource("fixture-1720000000000"), "Manual/generated fixture");
  assert.equal(
    describeFixtureSource("generated-1720000000000-001-arsenal-vs-chelsea"),
    "Manual/generated fixture",
  );
  assert.equal(
    describeFixtureSource("csv-arsenal-chelsea-2-1720000000000"),
    "CSV-imported fixture",
  );
  assert.equal(describeFixtureSource("540289"), "Live fixture cache");
  assert.equal(describeFixtureSource("ars-cov"), "Workspace/sample fixture");
}

function runLiveFixtureMaintenanceSmokeTests() {
  const now = new Date("2026-07-08T00:00:00.000Z");
  const cutoff = getLiveFixtureStaleCutoffIso(now, 14);
  assert.equal(cutoff, "2026-06-24T00:00:00.000Z");

  const summary = summariseLiveFixtureRows(
    [
      { match_date: "2026-06-01T00:00:00.000Z", updated_at: "2026-06-01T01:00:00.000Z" },
      { match_date: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-07T01:00:00.000Z" },
      { match_date: "2026-07-12T00:00:00.000Z", updated_at: "2026-07-08T01:00:00.000Z" },
    ],
    now,
    14,
  );

  assert.equal(summary.totalRows, 3);
  assert.equal(summary.futureRows, 2);
  assert.equal(summary.staleRows, 1);
  assert.equal(summary.oldestMatchDate, "2026-06-01T00:00:00.000Z");
  assert.equal(summary.newestMatchDate, "2026-07-12T00:00:00.000Z");
  assert.equal(summary.latestUpdatedAt, "2026-07-08T01:00:00.000Z");
}

runQualityAndPredictionSmokeTest();
runDirectionalConversionSmokeTests();
runAvailabilityAndConflictSmokeTests();
runResultAndLearningSmokeTests();
runWorkspaceSmokeTests();
runCsvImportExportSmokeTests();
runFixtureAutomationSmokeTests();
runWorkspaceBatchAndLiveFixturesSmokeTests();
runEvidenceAuditSmokeTests();
runLiveFixtureMaintenanceSmokeTests();

console.log("Smoke tests passed: scoring, gates, results, learning, workspace helpers, CSV import/export, fixture automation, live fixtures mapping, evidence audit and live fixture maintenance.");
