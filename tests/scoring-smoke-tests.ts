import assert from "assert/strict";
import { verifyRequestSession } from "../lib/serverAuth";
import { fixtures, type Fixture } from "../lib/sampleData";
import { exportFixturesToCsv, importFixturesFromCsv } from "../lib/csvWorkspace";
import { exportRawCompetitionTemplateCsv, getCustomWorkbookTemplate, importCustomCompetitionFromCsv, importCustomCompetitionFromWorkbookSheets } from "../lib/customCompetitionImport";
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
  getFixtureBatchPreview,
  normaliseRound,
} from "../lib/workspace";
import { mapLiveFixtureRow, type LiveFixtureRow } from "../lib/liveFixtures";
import { getLiveFixtureStaleCutoffIso, summariseLiveFixtureRows } from "../lib/liveFixtureMaintenance";
import { auditFixtureEvidence, describeFixtureSource, summariseEvidenceAudits } from "../lib/evidenceAudit";
import {
  calculateFormFromRecentResults as calculateTennisForm,
  calculateServeGap,
  calculateServeStrength,
  calculateSurfaceGap,
  calculateHeadToHeadGap,
  calculateQualityFromRanking,
  runTennisPrediction,
  emptyTennisManualFactors,
  type TennisPlayerSummary,
} from "../lib/tennisScoringEngine";
import { formatDateDDMMYYYY, mostRecentMonday, convertMatchStatsToServeStats, extractSurfaceWinRate } from "../lib/tennisDataClient";
import {
  applyTeamAliasesToFixtures,
  detectTeamNameIssues,
  normaliseComparableName,
  normaliseTeamNameWithAliases,
} from "../lib/teamAliases";
import { getCompetitionNames, summariseCompetition } from "../lib/competitionInsights";
import { calculateOutcomeProbabilities } from "../lib/probabilityModel";
import { calculateMulticlassBrierScore, summariseProbabilityCalibration } from "../lib/probabilityCalibration";
import { summariseModelTuningRecommendations } from "../lib/modelTuningRecommendations";
import { summariseTuningSandbox } from "../lib/tuningSandbox";
import { cloneTuningPresets, createTuningPreset, deleteTuningPreset, getPresetWeightChangeCount, isTuningPresetArray, updateTuningPreset } from "../lib/tuningPresets";
import { appendModelChangeLogEntry, createModelChangeLogEntry, getChangedRuleWeightKeys, isModelChangeLogArray, summariseModelChangeLog } from "../lib/modelChangeLog";
import { buildModelVersionComparisonTargets, summariseModelVersionComparison } from "../lib/modelVersionComparison";
import { buildReleaseChecklist, countChecklistStatuses } from "../lib/releaseChecklist";
import { addWorkspaceRecoverySnapshot, createWorkspaceRecoverySnapshot, pruneWorkspaceRecoveryVault, shouldCreateAutomaticWorkspaceSnapshot, summariseWorkspaceRecoveryVault } from "../lib/workspaceBackupVault";
import { summariseCompetitionDataQuality } from "../lib/competitionDataQuality";
import { chooseSaferWorkspaceState, shouldBlockWeakerWorkspaceOverwrite } from "../lib/workspacePreservation";
import { buildWorkspaceRestoreResolverSummary } from "../lib/workspaceRestoreResolver";
import { cloneAdvancedEvidence, summariseAdvancedEvidence } from "../lib/advancedEvidence";
import { ADVANCED_FIXTURE_EVIDENCE_HEADERS } from "../lib/advancedEvidenceImport";
import { buildAdvancedEvidenceImpactSummary } from "../lib/advancedEvidenceImpact";
import { buildAdvancedDataGate, buildAdvancedDataGateSummary } from "../lib/advancedDataGate";
import { summariseAdvancedDataCalibration } from "../lib/advancedDataCalibration";
import {
  applyAdvancedDataWeightControls,
  defaultAdvancedDataWeightControls,
  summariseAdvancedDataIntegration,
} from "../lib/advancedDataWeightControls";
import { summariseAdvancedDataWeightSandbox } from "../lib/advancedDataWeightSandbox";
import { buildBankrollRows, calculateBetPayout, parseFractionalOdds } from "../lib/bankroll";

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

  const otherCompetitionFixture = { ...createBlankFixture("Round 1", "Other League"), id: "other-league-fixture" };
  const sameCompetitionReplacement = { ...createBlankFixture("Round 3", "Sample League"), id: "new-sample-league-fixture" };
  const scoped = applyFixtureBatch(
    [sameCompetitionReplacement],
    [existingFixture, otherCompetitionFixture],
    [
      { fixtureId: existingFixture.id, entrantId: "e1", pick: "home" as const, confidence: 60 },
      { fixtureId: otherCompetitionFixture.id, entrantId: "e1", pick: "away" as const, confidence: 55 },
    ],
    "replaceCompetition",
  );
  assert.equal(scoped.fixtures.length, 2, "competition replace should preserve fixtures from other competitions");
  assert.ok(scoped.fixtures.some((fixture) => fixture.id === "other-league-fixture"));
  assert.ok(scoped.fixtures.some((fixture) => fixture.id === "new-sample-league-fixture"));
  assert.equal(scoped.tips.length, 1, "competition replace should only orphan tips for the replaced competition");
  assert.equal(scoped.tips[0].fixtureId, "other-league-fixture");
  assert.equal(scoped.orphanedTipsCount, 1);

  const updateOriginal = { ...createBlankFixture("Round 4", "Update League"), id: "stable-tip-id", homeTeam: "Alpha", awayTeam: "Beta", date: "2026-08-01" };
  const updateIncoming = { ...updateOriginal, id: "incoming-different-id", scores: { ...updateOriginal.scores, homeAdvantage: 3 } };
  const updated = applyFixtureBatch(
    [updateIncoming],
    [updateOriginal, otherCompetitionFixture],
    [{ fixtureId: "stable-tip-id", entrantId: "e1", pick: "home" as const, confidence: 70 }],
    "update",
  );
  const updatedFixture = updated.fixtures.find((fixture) => fixture.id === "stable-tip-id");
  assert.ok(updatedFixture, "update mode should preserve the existing fixture id for matching rows");
  assert.equal(updatedFixture?.scores.homeAdvantage, 3, "update mode should apply incoming fixture data");
  assert.equal(updated.tips.length, 1, "update mode should preserve tips for matched fixtures");
  assert.equal(updated.updatedFixtureCount, 1);

  const row: LiveFixtureRow = {
    id: "12345",
    competition: "Premier League",
    competition_code: "PL",
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

function runCompetitionFixtureFilterSmokeTests() {
  const competitions = getCompetitionNames(fixtures);
  assert.ok(competitions.includes("Example League"));

  const exampleFixtures = fixtures.filter((fixture) => fixture.competition === "Example League");
  assert.equal(exampleFixtures.length, fixtures.filter((fixture) => fixture.competition === "Example League").length);
  assert.ok(exampleFixtures.some((fixture) => fixture.id === "ars-cov"));
  assert.ok(exampleFixtures.every((fixture) => fixture.competition === "Example League"));

  assert.deepEqual(fixtures.filter((fixture) => fixture.competition === "Nonexistent League"), []);
  assert.equal(fixtures.filter((fixture) => !"" || fixture.competition === "").length, fixtures.length);
}

function runBankrollSmokeTests() {
  assert.equal(parseFractionalOdds("3:1"), 3);
  assert.equal(parseFractionalOdds("7/2"), 3.5);
  assert.equal(parseFractionalOdds("bad"), null);

  const win = calculateBetPayout({ odds: "3:1", stake: 6, outcomeBacked: "home", actualOutcome: "home" });
  assert.equal(win.settlement, "win");
  assert.equal(win.payout, 18);

  const loss = calculateBetPayout({ odds: "3:1", stake: 6, outcomeBacked: "draw", actualOutcome: "home" });
  assert.equal(loss.settlement, "loss");
  assert.equal(loss.payout, -6);

  const sample = cloneFixtures(fixtures);
  sample[0].betLog = { outcomeBacked: "home", odds: "3:1", stake: 6 };
  sample[1].betLog = { outcomeBacked: "away", odds: "2:1", stake: 5 };
  const rows = buildBankrollRows(sample);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].payout, 18);
  assert.equal(rows[0].rollingTotal, 18);
  assert.equal(rows[1].settlement, "loss");
  assert.equal(rows[1].rollingTotal, 13);
}

function runTennisScoringSmokeTests() {
  const strongPlayer: TennisPlayerSummary = { id: 1, name: "Player A", countryAcr: null, currentRank: 1, points: 11000 };
  const weakPlayer: TennisPlayerSummary = { id: 2, name: "Player B", countryAcr: null, currentRank: 250, points: 400 };

  const quality = calculateQualityFromRanking(strongPlayer, weakPlayer);
  assert.ok(quality.qualityGap > 0, "a much higher-ranked player should get a positive quality gap");
  assert.ok(quality.qualityGap <= 10, "quality gap should stay within the -10..+10 scale");

  const evenQuality = calculateQualityFromRanking(strongPlayer, strongPlayer);
  assert.equal(evenQuality.qualityGap, 0, "identical players should produce zero quality gap");

  // Serve Gate: weighted by each player's own first-serve-in rate, not a
  // fixed constant — a player who lands fewer first serves should have their
  // second-serve win rate count for more.
  const highFirstServeIn = calculateServeStrength({ firstServeInPct: 70, firstServeWinPct: 80, secondServeWinPct: 50 });
  assertBetween(highFirstServeIn, 71, 72, "70% first-serve-in weighting");
  // 0.7*80 + 0.3*50 = 56+15 = 71

  const lowFirstServeIn = calculateServeStrength({ firstServeInPct: 40, firstServeWinPct: 80, secondServeWinPct: 50 });
  assertBetween(lowFirstServeIn, 61, 62, "40% first-serve-in weighting");
  // 0.4*80 + 0.6*50 = 32+30 = 62 -- lower first-serve-in rate should pull the
  // weighted score down toward the (lower) second-serve rate
  assert.ok(lowFirstServeIn < highFirstServeIn, "landing fewer first serves should reduce weighted serve strength given the same win rates");

  const bigServer = { firstServeInPct: 65, firstServeWinPct: 85, secondServeWinPct: 55 };
  const weakServer = { firstServeInPct: 65, firstServeWinPct: 55, secondServeWinPct: 40 };
  const serveGapResult = calculateServeGap("Player A", "Player B", bigServer, weakServer);
  assert.ok(serveGapResult.serveGap > 0, "a clearly stronger server should get a positive serve gap");

  const missingServeStats = calculateServeGap("Player A", "Player B", null, null);
  assert.equal(missingServeStats.serveGap, 0, "missing serve stats for either player should stay neutral, not crash");

  const strongForm = calculateTennisForm("Player A", "Player B", ["W", "W", "W", "W", "W"], ["L", "L", "L", "L", "L"]);
  assert.equal(strongForm.formGap, 10, "5-0 vs 0-5 recent form should hit the max +10 gap");
  assert.equal(strongForm.playerAFormScore, 100);
  assert.equal(strongForm.playerBFormScore, 0);

  const noForm = calculateTennisForm("Player A", "Player B", [], []);
  assert.equal(noForm.formGap, 0, "no recorded matches for either player should be neutral, not a crash");

  const dominant = runTennisPrediction("Player A", "Player B", quality, strongForm, emptyTennisManualFactors);
  assert.equal(dominant.prediction, "Very Strong Player A Win");
  assert.equal(dominant.reviewRequired, false);

  const conflicting = runTennisPrediction(
    "Player A",
    "Player B",
    { qualityGap: 9, playerAStrength: 100, playerBStrength: 10, evidence: [] },
    { formGap: -9, playerAFormScore: 0, playerBFormScore: 100, evidence: [] },
    emptyTennisManualFactors,
  );
  assert.equal(conflicting.prediction, "Review Required", "strongly opposing quality/form signals should trigger review");
  assert.equal(conflicting.reviewRequired, true);

  const tooClose = runTennisPrediction(
    "Player A",
    "Player B",
    { qualityGap: 0, playerAStrength: 50, playerBStrength: 50, evidence: [] },
    { formGap: 0, playerAFormScore: 50, playerBFormScore: 50, evidence: [] },
    emptyTennisManualFactors,
  );
  assert.equal(tooClose.prediction, "Too Close to Call");

  const manualSwing = runTennisPrediction(
    "Player A",
    "Player B",
    { qualityGap: 0, playerAStrength: 50, playerBStrength: 50, evidence: [] },
    { formGap: 0, playerAFormScore: 50, playerBFormScore: 50, evidence: [] },
    { headToHeadEdge: 9, otherFactorsEdge: 0 },
  );
  assert.equal(manualSwing.prediction, "Very Strong Player A Win", "manual H2H edge alone should be able to swing the verdict");

  // Verified directly against a real API response: requesting date=08.06.2026
  // returned rows dated "2026-06-08", confirming the format is DD.MM.YYYY.
  assert.equal(formatDateDDMMYYYY(new Date("2026-06-08T00:00:00.000Z")), "08.06.2026");

  // Wednesday July 8, 2026 -> the Monday of that same week is July 6, 2026.
  const monday = mostRecentMonday(new Date("2026-07-08T00:00:00.000Z"));
  assert.equal(formatDateDDMMYYYY(monday), "06.07.2026");

  // A Monday should map to itself, and a Sunday should map back six days.
  assert.equal(
    formatDateDDMMYYYY(mostRecentMonday(new Date("2026-07-06T00:00:00.000Z"))),
    "06.07.2026",
    "a Monday should map to itself",
  );
  assert.equal(
    formatDateDDMMYYYY(mostRecentMonday(new Date("2026-07-12T00:00:00.000Z"))),
    "06.07.2026",
    "the Sunday at the end of the week should still map back to that week's Monday",
  );

  // Locked to the exact real getPlayerMatchStats response captured for
  // Djokovic (player id 5992) — if this ever stops matching, the API's field
  // meanings have changed and the conversion needs re-verifying, not just
  // re-trusting.
  const djokovicServeStats = convertMatchStatsToServeStats({
    firstServeGm: 68858,
    firstServeOfGm: 105916,
    winningOnFirstServeGm: 51208,
    winningOnFirstServeOfGm: 68858,
    winningOnSecondServeGm: 20622,
    winningOnSecondServeOfGm: 37061,
  });
  assert.ok(djokovicServeStats, "should convert a real serviceStats payload successfully");
  assert.equal(djokovicServeStats?.firstServeInPct, 65);
  assert.equal(djokovicServeStats?.firstServeWinPct, 74.4);
  assert.equal(djokovicServeStats?.secondServeWinPct, 55.6);

  assert.equal(
    convertMatchStatsToServeStats(null),
    null,
    "missing serviceStats should return null rather than throw",
  );
  assert.equal(
    convertMatchStatsToServeStats({
      firstServeGm: 0,
      firstServeOfGm: 0,
      winningOnFirstServeGm: 0,
      winningOnFirstServeOfGm: 0,
      winningOnSecondServeGm: 0,
      winningOnSecondServeOfGm: 0,
    }),
    null,
    "a player with no logged matches (all zeros) should return null, not divide by zero",
  );

  // Locked to the exact real getPlayerSurfaceSummary response captured for
  // Djokovic (player id 5992), truncated to the years actually needed.
  const djokovicSurfaceHistory = [
    { year: 2026, surfaces: [
      { courtId: 1, court: "Hard", courtWins: 7, courtLosses: 2 },
      { courtId: 5, court: "Grass", courtWins: 5, courtLosses: 0 },
      { courtId: 2, court: "Clay", courtWins: 2, courtLosses: 2 },
    ]},
    { year: 2025, surfaces: [
      { courtId: 1, court: "Hard", courtWins: 21, courtLosses: 7 },
      { courtId: 5, court: "Grass", courtWins: 5, courtLosses: 1 },
      { courtId: 3, court: "I.hard", courtWins: 4, courtLosses: 0 },
      { courtId: 2, court: "Clay", courtWins: 9, courtLosses: 3 },
    ]},
    { year: 2024, surfaces: [
      { courtId: 2, court: "Clay", courtWins: 16, courtLosses: 3 },
      { courtId: 5, court: "Grass", courtWins: 5, courtLosses: 1 },
      { courtId: 3, court: "I.hard", courtWins: 1, courtLosses: 0 },
      { courtId: 1, court: "Hard", courtWins: 15, courtLosses: 5 },
    ]},
    // Old data, outside the 3-year window from currentYear=2026 -- should be excluded.
    { year: 2020, surfaces: [{ courtId: 1, court: "Hard", courtWins: 999, courtLosses: 999 }] },
  ];

  const hardWinRate = extractSurfaceWinRate(djokovicSurfaceHistory, "Hard", 2026, 3);
  assert.deepEqual(hardWinRate, { wins: 43, losses: 14, winRatePct: 75.4 });

  const clayWinRate = extractSurfaceWinRate(djokovicSurfaceHistory, "Clay", 2026, 3);
  assert.deepEqual(clayWinRate, { wins: 27, losses: 8, winRatePct: 77.1 });

  const grassWinRate = extractSurfaceWinRate(djokovicSurfaceHistory, "Grass", 2026, 3);
  assert.deepEqual(grassWinRate, { wins: 15, losses: 2, winRatePct: 88.2 });

  // Case-insensitive surface matching, and a surface never played in the window.
  assert.deepEqual(extractSurfaceWinRate(djokovicSurfaceHistory, "hard", 2026, 3), hardWinRate);
  assert.equal(
    extractSurfaceWinRate(djokovicSurfaceHistory, "Carpet", 2026, 3),
    null,
    "a surface with no recent matches should return null, not zero",
  );

  const strongOnSurface = calculateSurfaceGap(
    "Player A",
    "Player B",
    { wins: 40, losses: 5 },
    { wins: 20, losses: 20 },
    "Clay",
  );
  assert.ok(strongOnSurface.surfaceGap > 0, "a much better surface record should get a positive surface gap");

  const noSurfaceData = calculateSurfaceGap("Player A", "Player B", null, null, "Grass");
  assert.equal(noSurfaceData.surfaceGap, 0, "missing surface data for either player should stay neutral, not crash");

  // Locked to the exact real getH2HInfo response captured (Djokovic vs an
  // opponent, id 5992 vs 677): Hard 16-5, Clay 9-20, I.hard 4-1, Carpet 0-1,
  // Grass 2-2 -> totals 31-29, an almost-even H2H that should round to 0.
  const closeH2H = calculateHeadToHeadGap("Player A", "Player B", { playerAWins: 31, playerBWins: 29 });
  assert.equal(closeH2H.headToHeadGap, 0, "an almost-even 31-29 H2H record should round to a neutral gap");

  const dominantH2H = calculateHeadToHeadGap("Player A", "Player B", { playerAWins: 18, playerBWins: 2 });
  assert.ok(dominantH2H.headToHeadGap > 0, "a lopsided H2H record should produce a clearly positive gap");

  const noH2H = calculateHeadToHeadGap("Player A", "Player B", null);
  assert.equal(noH2H.headToHeadGap, 0, "no head-to-head history should stay neutral, not crash");

  // runTennisPrediction: manual head-to-head edge should override the
  // automatic H2H gap, not add on top of it.
  const neutralGates = { qualityGap: 0, playerAStrength: 50, playerBStrength: 50, evidence: [] };
  const neutralForm = { formGap: 0, playerAFormScore: 50, playerBFormScore: 50, evidence: [] };
  const strongAutoH2H = calculateHeadToHeadGap("Player A", "Player B", { playerAWins: 18, playerBWins: 2 });

  const usingAutomaticH2H = runTennisPrediction(
    "Player A", "Player B", neutralGates, neutralForm, emptyTennisManualFactors, null, null, strongAutoH2H,
  );
  assert.equal(usingAutomaticH2H.playerAEdge, strongAutoH2H.headToHeadGap, "with no manual override, the automatic H2H gap should drive the edge");

  const overriddenH2H = runTennisPrediction(
    "Player A", "Player B", neutralGates, neutralForm,
    { headToHeadEdge: -5, otherFactorsEdge: 0 }, null, null, strongAutoH2H,
  );
  assert.equal(overriddenH2H.playerAEdge, -5, "a non-zero manual head-to-head edge should override the automatic H2H gap, not add to it");
}


function runCustomCompetitionImportSmokeTests() {
  const rawCsv = [
    "competition,round,date,home_team,away_team,home_goals,away_goals,status",
    "Brazil Serie A,Round 1,2026-04-01,Lions,Tigers,3,1,final",
    "Brazil Serie A,Round 1,2026-04-01,Bears,Wolves,0,2,final",
    "Brazil Serie A,Round 2,2026-04-08,Lions,Wolves,,,scheduled",
  ].join("\n");
  const imported = importCustomCompetitionFromCsv(rawCsv);
  assert.equal(imported.fixtures.length, 3);
  assert.equal(imported.finalRows, 2);
  assert.equal(imported.scheduledRows, 1);

  const scheduled = imported.fixtures.find((fixture) => fixture.homeTeam === "Lions" && fixture.awayTeam === "Wolves");
  assert.ok(scheduled, "scheduled fixture should be generated");
  assert.equal(scheduled?.competition, "Brazil Serie A");
  assert.equal(scheduled?.homeStats.played, 1);
  assert.equal(scheduled?.homeStats.points, 3);
  assert.equal(scheduled?.homeStats.goalsFor, 3);
  assert.equal(scheduled?.homeStats.goalsAgainst, 1);
  assert.equal(scheduled?.awayStats.played, 1);
  assert.equal(scheduled?.awayStats.points, 3);
  assert.equal(scheduled?.awayStats.goalsFor, 2);
  assert.equal(scheduled?.awayStats.goalsAgainst, 0);
  assert.equal(scheduled?.homeRecentForm[0].result, "W");
  assert.equal(scheduled?.awayRecentForm[0].result, "W");
  assert.equal(describeFixtureSource(scheduled?.id ?? ""), "Custom competition import");

  const template = exportRawCompetitionTemplateCsv();
  assert.ok(template.includes("home_goals"));
  assert.ok(template.includes("scheduled"));

  const workbook = getCustomWorkbookTemplate();
  assert.ok(workbook.teamsHeaders.includes("team"));
  assert.ok(workbook.fixturesHeaders.includes("home_team"));

  const teamsCsv = [
    "competition,season,team,played,points,wins,draws,losses,gf,ga,home_played,home_points,home_wins,home_draws,home_losses,home_gf,home_ga,away_played,away_points,away_wins,away_draws,away_losses,away_gf,away_ga,form,availability_risk,notes",
    "Brazil Serie A,2026,Lions,18,36,11,3,4,30,14,9,20,6,2,1,16,6,9,16,5,1,3,14,8,W:2-1;D:1-1;L:0-1;W:3-0;W:1-0,0,",
    "Brazil Serie A,2026,Wolves,18,28,8,4,6,22,18,9,15,4,3,2,12,8,9,13,4,1,4,10,10,L:0-1;W:2-0;D:1-1;L:1-2;W:2-1,1,",
  ].join("\n");
  const fixturesCsv = [
    "competition,season,round,date,home_team,away_team,home_goals,away_goals,status,neutral_venue,odds_home_pct,odds_draw_pct,odds_away_pct,odds_source,head_to_head_edge,other_stats_edge,notes",
    "Brazil Serie A,2026,Round 19,2026-07-12,Lions,Wolves,,,scheduled,false,45,28,27,Manual,1,0,",
  ].join("\n");
  const workbookImport = importCustomCompetitionFromWorkbookSheets(teamsCsv, fixturesCsv);
  assert.equal(workbookImport.fixtures.length, 1);
  assert.equal(workbookImport.teams.length, 2);
  assert.equal(workbookImport.fixtures[0].homeStats.points, 36);
  assert.equal(workbookImport.fixtures[0].awayStats.points, 28);
  assert.equal(workbookImport.fixtures[0].homeRecentForm[0].result, "W");
  assert.equal(workbookImport.fixtures[0].oddsMarket.homeWinProbability, 45);
  assert.equal(workbookImport.fixtures[0].scores.headToHeadEdge, 1);
}

function runImportPreviewSmokeTests() {
  const current = cloneFixtures(fixtures).slice(0, 2);
  const tips = [
    { entrantId: "entrant-preview", fixtureId: current[0].id, pick: "home" as const, confidence: 70 },
  ];
  const replacement = {
    ...current[0],
    id: "custom-preview-updated",
    scores: { ...current[0].scores, otherStatsEdge: current[0].scores.otherStatsEdge + 1 },
  };
  const newFixture = createBlankFixture("Round 99", current[0].competition);
  newFixture.id = "custom-preview-new";
  newFixture.competition = current[0].competition;
  newFixture.date = "2026-12-31";
  newFixture.homeTeam = "Preview Home";
  newFixture.awayTeam = "Preview Away";

  const updatePreview = getFixtureBatchPreview([replacement, newFixture], current, tips, "update");
  assert.equal(updatePreview.importedFixtureCount, 2);
  assert.equal(updatePreview.matchingFixtureCount, 1);
  assert.equal(updatePreview.updatedFixtureCount, 1);
  assert.equal(updatePreview.addedFixtureCount, 1);
  assert.equal(updatePreview.orphanedTipsCount, 0);
  assert.equal(updatePreview.finalFixtureCount, 3);

  const replacePreview = getFixtureBatchPreview([newFixture], current, tips, "replaceCompetition", [newFixture.competition]);
  assert.equal(replacePreview.replacedCompetitionCount, 1);
  assert.equal(replacePreview.orphanedTipsCount, 1);
  assert.ok(replacePreview.warnings.some((warning) => warning.includes("orphaned")));

  const duplicatePreview = getFixtureBatchPreview([newFixture, { ...newFixture, id: "dupe" }], current, tips, "append");
  assert.equal(duplicatePreview.duplicateImportCount, 1);

  const brandNewCompetitionFixture = createBlankFixture("Round 1", "USL Championship");
  brandNewCompetitionFixture.id = "usl-new-import";
  const addNewPreview = getFixtureBatchPreview([brandNewCompetitionFixture], current, tips, "append");
  assert.deepEqual(addNewPreview.newCompetitions, ["usl championship"]);
  assert.deepEqual(addNewPreview.existingCompetitions, []);
  assert.ok(addNewPreview.summaryLines.some((line) => line.includes("New competition")));

  const existingCompetitionPreview = getFixtureBatchPreview([newFixture], current, tips, "append");
  assert.equal(existingCompetitionPreview.newCompetitions.length, 0);
  assert.ok(existingCompetitionPreview.existingCompetitions.length > 0);
  assert.ok(existingCompetitionPreview.warnings.some((warning) => warning.includes("existing competition scope")));
}


function runTeamAliasSmokeTests() {
  assert.equal(normaliseComparableName("São Paulo FC"), "sao paulo");
  assert.equal(
    normaliseTeamNameWithAliases("Sao Paulo", "Brasileirao Serie A", [
      { id: "test-sp", alias: "Sao Paulo", canonical: "São Paulo", competition: "Brasileirao Serie A" },
    ]),
    "São Paulo",
  );

  const fixture = createBlankFixture("Round 1", "Brasileirao Serie A");
  fixture.id = "alias-fixture";
  fixture.homeTeam = "Sao Paulo";
  fixture.awayTeam = "Gremio";
  const aliasResult = applyTeamAliasesToFixtures([fixture], [
    { id: "test-sp", alias: "Sao Paulo", canonical: "São Paulo" },
    { id: "test-gre", alias: "Gremio", canonical: "Grêmio" },
  ]);
  assert.equal(aliasResult.fixtures[0].homeTeam, "São Paulo");
  assert.equal(aliasResult.fixtures[0].awayTeam, "Grêmio");
  assert.equal(aliasResult.changes.length, 2);

  const variantFixture = createBlankFixture("Round 2", "Brasileirao Serie A");
  variantFixture.homeTeam = "São Paulo";
  variantFixture.awayTeam = "Gremio";
  const issues = detectTeamNameIssues([fixture, variantFixture]);
  assert.ok(issues.some((issue) => issue.variants.includes("Sao Paulo") && issue.variants.includes("São Paulo")));

  // A global rule added first shouldn't block a more specific,
  // competition-scoped override for the same alias added afterward.
  const globalThenScoped = [
    { id: "global", alias: "Vitoria", canonical: "Vitória" },
    { id: "scoped", alias: "Vitoria", canonical: "Vitória SC", competition: "Copa Regional" },
  ];
  assert.equal(
    normaliseTeamNameWithAliases("Vitoria", "Copa Regional", globalThenScoped),
    "Vitória SC",
    "a competition-scoped rule should win even though the global rule appears first in the array",
  );
  assert.equal(
    normaliseTeamNameWithAliases("Vitoria", "Some Other Competition", globalThenScoped),
    "Vitória",
    "the global rule should still apply for competitions the scoped rule doesn't cover",
  );

  // Same check with the scoped rule added first, to confirm it's genuinely
  // priority-based and not just an accident of array order.
  const scopedThenGlobal = [
    { id: "scoped", alias: "Vitoria", canonical: "Vitória SC", competition: "Copa Regional" },
    { id: "global", alias: "Vitoria", canonical: "Vitória" },
  ];
  assert.equal(
    normaliseTeamNameWithAliases("Vitoria", "Copa Regional", scopedThenGlobal),
    "Vitória SC",
  );
}


function runCompetitionInsightsSmokeTests() {
  const finalOne = createBlankFixture("Round 1", "Smoke League");
  finalOne.id = "smoke-final-1";
  finalOne.date = "2026-01-01";
  finalOne.homeTeam = "Lions";
  finalOne.awayTeam = "Tigers";
  finalOne.matchResult = { status: "final", homeGoals: 2, awayGoals: 1 };
  finalOne.homeStats = { ...finalOne.homeStats, played: 3, points: 7, wins: 2, draws: 1, losses: 0, goalsFor: 6, goalsAgainst: 2 };
  finalOne.awayStats = { ...finalOne.awayStats, played: 3, points: 4, wins: 1, draws: 1, losses: 1, goalsFor: 4, goalsAgainst: 4 };

  const finalTwo = createBlankFixture("Round 2", "Smoke League");
  finalTwo.id = "smoke-final-2";
  finalTwo.date = "2026-01-08";
  finalTwo.homeTeam = "Tigers";
  finalTwo.awayTeam = "Bears";
  finalTwo.matchResult = { status: "final", homeGoals: 0, awayGoals: 0 };

  const pending = createBlankFixture("Round 3", "Smoke League");
  pending.id = "smoke-pending";
  pending.date = "2026-01-15";
  pending.homeTeam = "Lions";
  pending.awayTeam = "Bears";

  const names = getCompetitionNames([finalOne, finalTwo, pending]);
  assert.deepEqual(names, ["Smoke League"]);

  const insights = summariseCompetition([finalOne, finalTwo, pending], "Smoke League");
  assert.equal(insights.fixtureCount, 3);
  assert.equal(insights.finalResultCount, 2);
  assert.equal(insights.pendingFixtureCount, 1);
  assert.equal(insights.teamCount, 3);
  assert.equal(insights.resultStandings[0].team, "Lions");
  assert.equal(insights.resultStandings[0].points, 3);
  assert.ok(insights.evidenceStandings.some((row) => row.team === "Lions" && row.points === 7));
  assert.equal(insights.recentResults.length, 2);
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


function runOutcomeProbabilitySmokeTests() {
  const fixture = fixtures[0];
  const quality = calculateQualityFromTeamStats(fixture.homeStats, fixture.awayStats);
  const form = calculateFormFromRecentResults(fixture.homeRecentForm, fixture.awayRecentForm);
  const availability = calculateAvailabilityFromMissingPlayers(fixture.homeMissingPlayers, fixture.awayMissingPlayers);
  const context = calculateContextFromFlags(fixture.homeContext, fixture.awayContext, fixture.matchContext);
  const odds = calculateOddsFromMarket(fixture.oddsMarket);
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
    weights: defaultRuleWeights,
    contextWarnings: context.warnings,
    oddsWarnings: odds.warnings,
    volatilityScore: context.volatilityScore,
    drawProbability: odds.drawProbability,
    externalFavourite: odds.externalFavourite,
    favouriteMargin: odds.favouriteMargin,
  });
  const finalScores = applyCalculatedGaps(
    scoresBeforeConflict,
    quality.qualityGap,
    form.recentFormGap,
    availability.injuryRisk,
    context.motivationEdge,
    odds.oddsSupport,
    conflict.conflictScore,
  );
  const prediction = runPrediction(finalScores, defaultRuleWeights);
  const probabilities = calculateOutcomeProbabilities({
    scores: finalScores,
    prediction,
    odds,
    conflict,
    weights: defaultRuleWeights,
  });

  assert.equal(probabilities.home + probabilities.draw + probabilities.away, 100);
  assert.ok(probabilities.home > probabilities.away, "sample home favourite should have higher home probability than away probability");
  assert.ok(["low", "medium", "high"].includes(probabilities.confidenceBand));
  assert.ok(probabilities.evidence.some((item) => item.includes("Final estimated probabilities")));

  const tightReviewPrediction = runPrediction({ ...emptyScores, conflictScore: 5 }, defaultRuleWeights);
  const tightProbabilities = calculateOutcomeProbabilities({
    scores: { ...emptyScores, conflictScore: 5 },
    prediction: tightReviewPrediction,
    odds: calculateOddsFromMarket({ homeWinProbability: 0, drawProbability: 0, awayWinProbability: 0, sourceLabel: "None" }),
    conflict: { conflictScore: 5, rawConflictPoints: 5, conflictLevel: "block", failedSignals: 3, cautionSignals: 0, evidence: [], warnings: [], blockers: [] },
    weights: defaultRuleWeights,
  });
  assert.equal(tightProbabilities.home + tightProbabilities.draw + tightProbabilities.away, 100);
  assert.equal(tightProbabilities.confidenceBand, "low");
  assert.ok(tightProbabilities.draw >= 30, "high conflict should keep draw/uncertainty elevated");

  // Regression test for a real bug found by brute-force sweeping edge/conflict/
  // market combinations: a large edge combined with an external market input
  // that assigns ~0% to away could round to a displayed -1% probability.
  // This exact combination (edge 25, conflict 2, odds 100/0/0) was one of 81
  // reachable cases found before the fix to normaliseToHundred's rounding.
  const extremeEdgePrediction = {
    homeEdge: 25,
    awayEdge: -25,
    confidence: 90,
    prediction: "Very Strong Home Win" as const,
    gateStatus: "passed" as const,
    reviewRequired: false,
    gates: [],
    warnings: [],
  };
  const extremeOdds = {
    homeProbability: 100,
    drawProbability: 0,
    awayProbability: 0,
    externalFavourite: "home" as const,
    favouriteMargin: 100,
    oddsSupport: 5,
    evidence: [],
    warnings: [],
  };
  const extremeConflict = {
    conflictScore: 2,
    rawConflictPoints: 2,
    conflictLevel: "caution" as const,
    failedSignals: 0,
    cautionSignals: 2,
    evidence: [],
    warnings: [],
    blockers: [],
  };
  const extremeProbabilities = calculateOutcomeProbabilities({
    scores: emptyScores,
    prediction: extremeEdgePrediction,
    odds: extremeOdds,
    conflict: extremeConflict,
    weights: defaultRuleWeights,
  });
  assert.ok(extremeProbabilities.home >= 0, "home probability should never be negative");
  assert.ok(extremeProbabilities.draw >= 0, "draw probability should never be negative");
  assert.ok(extremeProbabilities.away >= 0, "away probability should never be negative — this is the exact case that used to round to -1%");
  assert.equal(extremeProbabilities.home + extremeProbabilities.draw + extremeProbabilities.away, 100);
}

function runProbabilityCalibrationSmokeTests() {
  assert.equal(
    calculateMulticlassBrierScore({ home: 80, draw: 10, away: 10 }, "home"),
    0.03,
    "strong correct probability should have low Brier score",
  );
  assert.equal(
    calculateMulticlassBrierScore({ home: 80, draw: 10, away: 10 }, "away"),
    0.73,
    "strong wrong probability should have high Brier score",
  );

  const summary = summariseProbabilityCalibration([
    {
      fixture: { ...fixtures[0], id: "cal-1", homeTeam: "Home A", awayTeam: "Away A" },
      probabilities: {
        home: 70,
        draw: 20,
        away: 10,
        favourite: "home",
        spread: 50,
        confidenceBand: "high",
        modelOnly: { home: 70, draw: 20, away: 10 },
        marketBlendUsed: false,
        evidence: [],
        warnings: [],
      },
      accuracy: {
        actualOutcome: "home",
        predictedOutcome: "home",
        isSettled: true,
        isTipPublished: true,
        isCorrect: true,
        pointsAwarded: 1,
        evidence: [],
      },
    },
    {
      fixture: { ...fixtures[0], id: "cal-2", homeTeam: "Home B", awayTeam: "Away B" },
      probabilities: {
        home: 72,
        draw: 18,
        away: 10,
        favourite: "home",
        spread: 54,
        confidenceBand: "high",
        modelOnly: { home: 72, draw: 18, away: 10 },
        marketBlendUsed: false,
        evidence: [],
        warnings: [],
      },
      accuracy: {
        actualOutcome: "away",
        predictedOutcome: "home",
        isSettled: true,
        isTipPublished: true,
        isCorrect: false,
        pointsAwarded: 0,
        evidence: [],
      },
    },
  ]);

  assert.equal(summary.settledFixtures, 2);
  assert.equal(summary.favouriteTips, 2);
  assert.equal(summary.favouriteHits, 1);
  assert.equal(summary.favouriteHitRate, 50);
  assert.equal(summary.calibrationGrade, "insufficient-data");
  assert.equal(summary.fixturesToReview.length, 1, "high-probability miss should be surfaced for review");
  assert.ok(summary.averageBrierScore > 0, "calibration summary should calculate Brier score");
}


function runModelTuningRecommendationsSmokeTests() {
  const basePrediction = {
    homeEdge: 8,
    awayEdge: -8,
    confidence: 82,
    prediction: "Strong Home Win" as const,
    gateStatus: "passed" as const,
    reviewRequired: false,
    gates: [
      { id: "quality", name: "Quality Gate", status: "pass" as const, note: "quality supports" },
      { id: "form", name: "Form Gate", status: "pass" as const, note: "form supports" },
    ],
    warnings: [],
  };
  const highHomeProbabilities = {
    home: 70,
    draw: 20,
    away: 10,
    favourite: "home" as const,
    spread: 50,
    confidenceBand: "high" as const,
    modelOnly: { home: 70, draw: 20, away: 10 },
    marketBlendUsed: false,
    evidence: [],
    warnings: [],
  };
  const correctAccuracy = {
    actualOutcome: "home" as const,
    predictedOutcome: "home" as const,
    isSettled: true,
    isTipPublished: true,
    isCorrect: true,
    pointsAwarded: 1,
    evidence: [],
  };
  const missedAccuracy = {
    ...correctAccuracy,
    actualOutcome: "away" as const,
    isCorrect: false,
    pointsAwarded: 0,
  };

  const items = [
    { fixture: { ...fixtures[0], id: "tune-1", homeTeam: "Home 1", awayTeam: "Away 1" }, prediction: basePrediction, probabilities: highHomeProbabilities, accuracy: missedAccuracy },
    { fixture: { ...fixtures[0], id: "tune-2", homeTeam: "Home 2", awayTeam: "Away 2" }, prediction: basePrediction, probabilities: highHomeProbabilities, accuracy: missedAccuracy },
    { fixture: { ...fixtures[0], id: "tune-3", homeTeam: "Home 3", awayTeam: "Away 3" }, prediction: basePrediction, probabilities: highHomeProbabilities, accuracy: correctAccuracy },
    { fixture: { ...fixtures[0], id: "tune-4", homeTeam: "Home 4", awayTeam: "Away 4" }, prediction: basePrediction, probabilities: highHomeProbabilities, accuracy: correctAccuracy },
    { fixture: { ...fixtures[0], id: "tune-5", homeTeam: "Home 5", awayTeam: "Away 5" }, prediction: basePrediction, probabilities: highHomeProbabilities, accuracy: correctAccuracy },
  ];

  const calibration = summariseProbabilityCalibration(items.map((item) => ({
    fixture: item.fixture,
    probabilities: item.probabilities,
    accuracy: item.accuracy,
  })));
  const ruleLearning = calculateRuleLearningSummary(items.map((item) => ({
    prediction: item.prediction,
    accuracy: item.accuracy,
  })));
  const tuning = summariseModelTuningRecommendations({
    items,
    calibration,
    ruleLearning,
    ruleWeights: defaultRuleWeights,
  });

  assert.equal(tuning.settledFixtures, 5);
  assert.equal(tuning.publishedTips, 5);
  assert.equal(tuning.highConfidenceMisses, 2);
  assert.ok(tuning.recommendations.some((recommendation) => recommendation.id === "reduce-strong-favourite-overconfidence"), "high-confidence misses should trigger an overconfidence recommendation");
  assert.ok(tuning.recommendations.some((recommendation) => recommendation.id === "collect-more-results"), "small samples should still ask for more data");
  assert.ok(tuning.evidence.some((line) => line.includes("advisory only") || line.includes("does not auto-change")), "tuning summary should make it clear that changes are advisory only");
}


function runTuningSandboxSmokeTests() {
  const baseFixture = {
    ...fixtures[0],
    id: "sandbox-1",
    matchResult: { status: "final" as const, homeGoals: 2, awayGoals: 0 },
  };
  const upsetFixture = {
    ...fixtures[0],
    id: "sandbox-2",
    homeTeam: "Heavy Home",
    awayTeam: "Upset Away",
    matchResult: { status: "final" as const, homeGoals: 0, awayGoals: 1 },
  };
  const sandboxWeights = {
    ...defaultRuleWeights,
    minimumPublishConfidence: 80,
    reviewConflictThreshold: 1,
  };
  const summary = summariseTuningSandbox({
    fixtures: [baseFixture, upsetFixture],
    baselineWeights: defaultRuleWeights,
    sandboxWeights,
  });

  assert.equal(summary.fixtureCount, 2);
  assert.equal(summary.settledFixtures, 2);
  assert.ok(summary.baseline.publishedTips >= summary.sandbox.publishedTips, "stricter sandbox should not publish more tips in this sample");
  assert.ok(summary.evidence.some((line) => line.includes("what-if") || line.includes("sandbox only")), "sandbox evidence should state it is not applying live changes");
}

function runTuningPresetSmokeTests() {
  const aggressive = {
    ...defaultRuleWeights,
    qualityGap: 1.5,
    conflictScore: 0.75,
  };
  const preset = createTuningPreset({
    name: "  Brazil weekly review  ",
    description: "  Use after P31 sandbox check.  ",
    weights: aggressive,
  });

  assert.equal(preset.name, "Brazil weekly review");
  assert.equal(preset.description, "Use after P31 sandbox check.");
  assert.equal(preset.weights.qualityGap, 1.5);
  assert.equal(getPresetWeightChangeCount(preset, defaultRuleWeights), 2);

  const duplicateNamePreset = createTuningPreset({
    name: "Brazil weekly review",
    weights: defaultRuleWeights,
    existingPresets: [preset],
  });
  assert.equal(duplicateNamePreset.name, "Brazil weekly review 2");

  const updated = updateTuningPreset({
    presets: [preset],
    presetId: preset.id,
    name: "Conservative review",
    weights: defaultRuleWeights,
  });
  assert.equal(updated[0].name, "Conservative review");
  assert.equal(updated[0].weights.qualityGap, defaultRuleWeights.qualityGap);
  assert.ok(updated[0].updatedAt >= preset.updatedAt);

  const cloned = cloneTuningPresets(updated);
  cloned[0].weights.qualityGap = 0;
  assert.equal(updated[0].weights.qualityGap, defaultRuleWeights.qualityGap, "cloned presets must not share weight references");
  assert.equal(deleteTuningPreset(updated, preset.id).length, 0);
  assert.equal(isTuningPresetArray(updated), true);
  assert.equal(isTuningPresetArray([{ id: "bad" }]), false);
}


function runModelVersionComparisonSmokeTests() {
  const conservative = {
    ...defaultRuleWeights,
    minimumPublishConfidence: defaultRuleWeights.minimumPublishConfidence + 10,
    conflictScore: defaultRuleWeights.conflictScore + 0.5,
  };
  const entry = createModelChangeLogEntry({
    reason: "sandbox-apply",
    label: "Conservative model",
    beforeWeights: defaultRuleWeights,
    afterWeights: conservative,
  });
  assert.ok(entry, "changed weights should create a comparison source entry");
  const preset = createTuningPreset({ name: "Preset model", weights: conservative });
  const targets = buildModelVersionComparisonTargets({ changeLog: [entry], presets: [preset] });
  assert.ok(targets.some((target) => target.id === "default"), "comparison targets should include defaults");
  assert.ok(targets.some((target) => target.id === `change-before-${entry.id}`), "comparison targets should include before snapshots");
  assert.ok(targets.some((target) => target.id === `change-after-${entry.id}`), "comparison targets should include after snapshots");
  assert.ok(targets.some((target) => target.id === `preset-${preset.id}`), "comparison targets should include presets");

  const summary = summariseModelVersionComparison({
    fixtures,
    currentWeights: conservative,
    comparisonWeights: defaultRuleWeights,
    target: targets[0],
  });
  assert.ok(summary.changedWeightCount >= 2, "comparison should report changed weights");
  assert.ok(summary.changedWeights.some((item) => item.key === "minimumPublishConfidence"));
  assert.equal(summary.target.id, "default");
  assert.ok(summary.evidence.some((line) => line.includes("P34 is read-only")));
}

function runModelChangeLogSmokeTests() {
  const conservative = {
    ...defaultRuleWeights,
    minimumPublishConfidence: defaultRuleWeights.minimumPublishConfidence + 5,
    conflictScore: defaultRuleWeights.conflictScore + 0.25,
  };
  const changedKeys = getChangedRuleWeightKeys(defaultRuleWeights, conservative);
  assert.ok(changedKeys.includes("minimumPublishConfidence"), "changed keys should include minimum publish confidence");
  assert.ok(changedKeys.includes("conflictScore"), "changed keys should include conflict penalty");

  const entry = createModelChangeLogEntry({
    reason: "sandbox-apply",
    label: "Test sandbox apply",
    note: "Regression test entry",
    beforeWeights: defaultRuleWeights,
    afterWeights: conservative,
  });
  assert.ok(entry, "changed weights should create a log entry");
  const entries = appendModelChangeLogEntry([], entry);
  const summary = summariseModelChangeLog(entries);
  assert.equal(summary.totalEntries, 1);
  assert.equal(summary.sandboxApplications, 1);
  assert.equal(summary.latestEntry?.label, "Test sandbox apply");
  assert.ok(summary.changedKeyCounts.some((item) => item.key === "conflictScore" && item.count === 1));

  const snapshot = createModelChangeLogEntry({
    reason: "manual-snapshot",
    label: "Snapshot",
    beforeWeights: defaultRuleWeights,
    afterWeights: defaultRuleWeights,
  });
  assert.ok(snapshot, "manual snapshots should be allowed even when no weights changed");
  const withSnapshot = appendModelChangeLogEntry(entries, snapshot);
  assert.equal(summariseModelChangeLog(withSnapshot).manualSnapshots, 1);
  assert.equal(isModelChangeLogArray(withSnapshot), true);
  assert.equal(isModelChangeLogArray([{ id: "bad" }]), false);
}



function runCompetitionDataQualitySmokeTests() {
  const duplicate = createBlankFixture("Round 1");
  duplicate.id = "quality-duplicate-1";
  duplicate.competition = "Quality League";
  duplicate.date = "2026-08-01";
  duplicate.homeTeam = "Sao Paulo";
  duplicate.awayTeam = "Gremio";
  duplicate.matchResult = { status: "final", homeGoals: 2, awayGoals: 1 };
  duplicate.homeStats = { ...fixtures[0].homeStats };
  duplicate.awayStats = { ...fixtures[0].awayStats };
  duplicate.homeRecentForm = [{ result: "W", goalsFor: 2, goalsAgainst: 1 }];
  duplicate.awayRecentForm = [{ result: "L", goalsFor: 1, goalsAgainst: 2 }];

  const duplicateCopy = { ...duplicate, id: "quality-duplicate-2" };
  const missing = createBlankFixture("Round 2");
  missing.id = "quality-missing";
  missing.competition = "Quality League";
  missing.date = "";
  missing.homeTeam = "São Paulo";
  missing.awayTeam = "TBD";
  missing.matchResult = { status: "pending", homeGoals: 0, awayGoals: 0 };

  const summary = summariseCompetitionDataQuality(
    [duplicate, duplicateCopy, missing],
    [{ fixtureId: "removed-fixture", entrantId: "entrant", pick: "home", confidence: 60 }],
    "Quality League",
  );

  assert.equal(summary.fixtureCount, 3);
  assert.equal(summary.finalResults, 2);
  assert.ok(summary.duplicateFixtureRows >= 2, "duplicate fixture rows should be flagged");
  assert.ok(summary.possibleTeamNameVariants >= 1, "accent variants should be flagged");
  assert.equal(summary.orphanedTips, 1);
  assert.equal(summary.status, "needs-work");
  assert.ok(summary.issues.some((issue) => issue.category === "Fixture teams"));
}

function runWorkspacePreservationSmokeTests() {
  const richFixtures = cloneFixtures(fixtures);
  const extraFixture = createBlankFixture("Round 99", "Manual League");
  extraFixture.id = "manual-preservation-fixture";
  extraFixture.homeTeam = "Manual Home";
  extraFixture.awayTeam = "Manual Away";
  richFixtures.push(extraFixture);

  const weaker = createPersistedState(
    fixtures.slice(0, 1),
    fixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [],
    [],
    [],
    [],
    [],
  );
  const richer = createPersistedState(
    richFixtures,
    richFixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [{ id: "entrant-a", name: "Entrant A" }],
    [{ fixtureId: extraFixture.id, entrantId: "entrant-a", pick: "home", confidence: 75 }],
    [],
    [],
    [],
  );

  assert.equal(shouldBlockWeakerWorkspaceOverwrite(weaker, richer), true);
  assert.equal(chooseSaferWorkspaceState(weaker, richer), richer);
}

function runWorkspaceRecoveryVaultSmokeTests() {
  const baseState = createPersistedState(
    fixtures.slice(0, 2),
    fixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [{ id: "entrant-a", name: "Entrant A" }],
    [],
    [],
    [],
    [],
  );
  const richerState = createPersistedState(
    fixtures.slice(0, 4),
    fixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [{ id: "entrant-a", name: "Entrant A" }],
    [{ fixtureId: fixtures[0].id, entrantId: "entrant-a", pick: "home", confidence: 70 }],
    [],
    [],
    [],
  );

  const automatic = createWorkspaceRecoverySnapshot(baseState, "Automatic", "automatic");
  const manual = createWorkspaceRecoverySnapshot(richerState, "Manual", "manual");
  const vault = addWorkspaceRecoverySnapshot([automatic], manual);
  const summary = summariseWorkspaceRecoveryVault(vault);

  assert.equal(summary.snapshotCount, 2);
  assert.equal(summary.manualCount, 1);
  assert.equal(summary.richestSnapshotId, manual.id);
  assert.equal(shouldCreateAutomaticWorkspaceSnapshot([automatic], baseState), false);
  assert.equal(shouldCreateAutomaticWorkspaceSnapshot([automatic], richerState), true);

  const manyAutomatic = Array.from({ length: 14 }, (_, index) =>
    createWorkspaceRecoverySnapshot(
      createPersistedState(
        fixtures.slice(0, Math.max(1, (index % fixtures.length) + 1)),
        fixtures[0].id,
        "Round 1",
        defaultRuleWeights,
        [],
        [],
        [],
        [],
        [],
      ),
      `Automatic ${index}`,
      "automatic",
    ),
  );
  assert.ok(pruneWorkspaceRecoveryVault(manyAutomatic).length <= 10);

  // createPersistedState defaults recoverySnapshots to [] when the 10th arg
  // is omitted -- this is what every existing call site relies on, and it's
  // what keeps a snapshot's own embedded state from recursively containing
  // a copy of the vault it's itself a member of.
  const stateWithoutVaultArg = createPersistedState(
    fixtures.slice(0, 1), fixtures[0].id, "Round 1", defaultRuleWeights, [], [], [], [], [],
  );
  assert.deepEqual(stateWithoutVaultArg.recoverySnapshots, []);

  // Passing a live vault through explicitly (the top-level mirror/storage
  // path) should actually carry it, proving the field isn't silently dropped.
  const someSnapshot = createWorkspaceRecoverySnapshot(baseState, "Manual", "manual");
  const stateWithVaultArg = createPersistedState(
    fixtures.slice(0, 1), fixtures[0].id, "Round 1", defaultRuleWeights, [], [], [], [], [], defaultAdvancedDataWeightControls, [someSnapshot],
  );
  assert.equal(stateWithVaultArg.recoverySnapshots?.length, 1);
  assert.equal(stateWithVaultArg.recoverySnapshots?.[0].id, someSnapshot.id);

  // Directly demonstrates the anti-nesting pattern useWorkspaceAutosave.ts
  // follows: build the state that gets *embedded inside a new snapshot*
  // without the 10th arg, even when a live, non-empty vault exists
  // elsewhere in the app -- the new snapshot's own state must not carry it.
  const nextSnapshot = createWorkspaceRecoverySnapshot(stateWithoutVaultArg, "Automatic", "automatic");
  assert.deepEqual(
    nextSnapshot.state.recoverySnapshots,
    [],
    "a newly created snapshot's embedded state must never carry a copy of the vault, or every snapshot would recursively nest all previous ones",
  );
}

function runWorkspaceRestoreResolverSmokeTests() {
  const baseState = createPersistedState(
    fixtures.slice(0, 1),
    fixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [],
    [],
    [],
    [],
    [],
  );
  const cloudState = createPersistedState(
    fixtures,
    fixtures[0].id,
    "Round 1",
    defaultRuleWeights,
    [],
    [],
    [],
    [],
    [],
  );
  const recovery = createWorkspaceRecoverySnapshot(cloudState, "Rich cloud-era backup", "manual");
  const resolver = buildWorkspaceRestoreResolverSummary({
    currentState: baseState,
    cloudState,
    localCandidates: [{
      key: "tipping-gates-app-test-state",
      state: baseState,
      fixtureCount: baseState.fixtures.length,
      competitionCount: 1,
      savedAtMs: Date.parse(baseState.savedAt),
      score: 100,
    }],
    recoverySnapshots: [recovery],
  });

  assert.ok(resolver.candidates.length >= 3);
  assert.ok(resolver.recommendedLabel.includes("Supabase") || resolver.recommendedLabel.includes("Recovery"));
  assert.ok(resolver.candidates.some((candidate) => candidate.sourceType === "cloud"));
}


function runAdvancedEvidenceSmokeTests() {
  const emptySummary = summariseAdvancedEvidence(fixtures);
  assert.equal(emptySummary.fixtureCount, fixtures.length);
  assert.equal(emptySummary.fixturesWithAdvancedEvidence, 0);
  assert.ok(emptySummary.categories.some((category) => category.id === "xg"));

  const advancedFixtures = cloneFixtures(fixtures);
  advancedFixtures[0] = {
    ...advancedFixtures[0],
    advancedEvidence: {
      home: {
        expectedGoalsFor: 1.9,
        expectedGoalsAgainst: 0.8,
        recentOpponentAveragePointsPerGame: 1.6,
        daysSinceLastMatch: 5,
        missingStarters: 1,
        setPieceGoalsFor: 7,
        yellowCardsPerMatch: 1.8,
        stability: "stable",
      },
      away: {
        expectedGoalsFor: 0.9,
        matchesLast14Days: 4,
        missingGoalkeepers: 1,
        cornersAgainstPerMatch: 5.4,
        redCardsPerMatch: 0.1,
        stability: "watch",
      },
      match: {
        openingHomeProbability: 55,
        currentHomeProbability: 61,
        marketMovementDirection: "home-shortening",
        marketMovementStrength: 6,
      },
    },
  };

  const evidenceCopy = cloneAdvancedEvidence(advancedFixtures[0].advancedEvidence);
  assert.equal(evidenceCopy?.home?.expectedGoalsFor, 1.9);
  const summary = summariseAdvancedEvidence(advancedFixtures);
  assert.equal(summary.fixturesWithAdvancedEvidence, 1);
  assert.ok(summary.coveragePct > 0);
  assert.ok(summary.categories.find((category) => category.id === "market-movement")?.available === 1);

  const exportedCsv = exportFixturesToCsv(advancedFixtures);
  assert.ok(ADVANCED_FIXTURE_EVIDENCE_HEADERS.every((header) => exportedCsv.split("\n")[0].includes(header)));
  const reimported = importFixturesFromCsv(exportedCsv);
  assert.equal(reimported.fixtures[0].advancedEvidence?.home?.expectedGoalsFor, 1.9);
  assert.equal(reimported.fixtures[0].advancedEvidence?.away?.missingGoalkeepers, 1);
  assert.equal(reimported.fixtures[0].advancedEvidence?.match?.marketMovementDirection, "home-shortening");

  const workbookTemplate = getCustomWorkbookTemplate();
  assert.ok(workbookTemplate.teamsHeaders.includes("xg_for"));
  assert.ok(workbookTemplate.fixturesHeaders.includes("market_movement_direction"));

  const teamsCsv = [
    "competition,season,team,played,points,wins,draws,losses,gf,ga,form,availability_risk,notes,xg_for,xg_against,travel_burden,missing_starters,team_stability",
    "Advanced League,2026,Home FC,10,20,6,2,2,18,9,W:2-1;W:1-0,0,,1.8,0.9,low,1,stable",
    "Advanced League,2026,Away FC,10,15,4,3,3,14,12,D:1-1;L:0-1,0,,1.1,1.2,moderate,2,watch",
  ].join("\n");
  const fixturesCsv = [
    "competition,season,round,date,home_team,away_team,home_goals,away_goals,status,neutral_venue,odds_home_pct,odds_draw_pct,odds_away_pct,odds_source,head_to_head_edge,other_stats_edge,notes,opening_home_probability,current_home_probability,market_movement_direction,market_movement_strength,advanced_data_source",
    "Advanced League,2026,Round 1,2026-08-01,Home FC,Away FC,,,scheduled,false,45,28,27,Manual,0,0,,40,46,home-shortening,6,Analyst sheet",
  ].join("\n");
  const workbookImport = importCustomCompetitionFromWorkbookSheets(teamsCsv, fixturesCsv);
  assert.equal(workbookImport.fixtures[0].advancedEvidence?.home?.expectedGoalsFor, 1.8);
  assert.equal(workbookImport.fixtures[0].advancedEvidence?.away?.travelBurden, "moderate");
  assert.equal(workbookImport.fixtures[0].advancedEvidence?.match?.currentHomeProbability, 46);
}


function runAdvancedEvidenceImpactSmokeTests() {
  const advancedFixtures = cloneFixtures(fixtures);
  advancedFixtures[0] = {
    ...advancedFixtures[0],
    advancedEvidence: {
      home: {
        expectedGoalsFor: 2.1,
        expectedGoalsAgainst: 0.7,
        recentOpponentAveragePointsPerGame: 1.8,
        daysSinceLastMatch: 6,
        missingStarters: 0,
        setPieceGoalsFor: 8,
        setPieceGoalsAgainst: 2,
        cornersForPerMatch: 6.4,
        cornersAgainstPerMatch: 3.1,
        yellowCardsPerMatch: 1.2,
        stability: "stable",
      },
      away: {
        expectedGoalsFor: 0.8,
        expectedGoalsAgainst: 1.5,
        recentOpponentAveragePointsPerGame: 1.1,
        daysSinceLastMatch: 2,
        matchesLast14Days: 5,
        travelBurden: "high",
        missingStarters: 3,
        missingGoalkeepers: 1,
        setPieceGoalsFor: 1,
        setPieceGoalsAgainst: 7,
        cornersForPerMatch: 3.2,
        cornersAgainstPerMatch: 6.1,
        yellowCardsPerMatch: 3.3,
        redCardsPerMatch: 0.2,
        stability: "volatile",
      },
      match: {
        marketMovementDirection: "home-shortening",
        marketMovementStrength: 7,
        weatherDisruptionRisk: true,
      },
    },
  };

  const summary = buildAdvancedEvidenceImpactSummary(advancedFixtures.map((fixture) => ({
    fixture,
    prediction: { label: "Strong Home Win", pick: "home", confidence: 70 },
  })));

  assert.equal(summary.fixtureCount, advancedFixtures.length);
  assert.equal(summary.fixturesWithAdvancedEvidence, 1);
  assert.ok(summary.signalCount >= 5, "advanced evidence should create multiple impact signals");
  assert.ok(summary.strongSignalCount >= 1, "advanced evidence should flag at least one strong signal");
  assert.ok(summary.categoryCounts.some((item) => item.category === "xG edge"));
  assert.ok(summary.topSignals.some((signal) => signal.category === "Market movement"));
}


function runAdvancedDataGateSmokeTests() {
  const advancedFixture: Fixture = {
    ...fixtures[0],
    id: "advanced-gate-1",
    advancedEvidence: {
      home: {
        recentExpectedGoalsFor: 2.1,
        recentExpectedGoalsAgainst: 0.8,
        recentOpponentAveragePointsPerGame: 1.9,
        daysSinceLastMatch: 6,
        missingStarters: 0,
        setPieceGoalsFor: 4,
        cornersForPerMatch: 6,
        yellowCardsPerMatch: 1.2,
      },
      away: {
        recentExpectedGoalsFor: 1.0,
        recentExpectedGoalsAgainst: 1.7,
        recentOpponentAveragePointsPerGame: 1.1,
        daysSinceLastMatch: 2,
        matchesLast7Days: 2,
        travelBurden: "high",
        missingStarters: 2,
        missingGoalkeepers: 1,
        setPieceGoalsAgainst: 3,
        cornersAgainstPerMatch: 5,
        yellowCardsPerMatch: 1.4,
        redCardsPerMatch: 0,
      },
      match: {
        marketMovementDirection: "home-shortening",
        marketMovementStrength: 6,
      },
    },
  };

  const gate = buildAdvancedDataGate({ fixture: advancedFixture, prediction: { label: "Strong Home Win", pick: "home", confidence: 74 } });
  assert.equal(gate.verdict, "supports");
  assert.ok(gate.score > 0, "home-supporting advanced evidence should produce positive gate score");
  assert.ok(gate.signalCount >= 5, "advanced data gate should generate multiple signals");
  assert.ok(gate.recommendations.some((recommendation) => recommendation.includes("Advanced data supports")));

  const summary = buildAdvancedDataGateSummary([{ fixture: advancedFixture, prediction: { label: "Strong Home Win", pick: "home", confidence: 74 } }]);
  assert.equal(summary.fixtureCount, 1);
  assert.equal(summary.fixturesWithGateData, 1);
  assert.equal(summary.supportsCount, 1);
  assert.ok(summary.topGateResults.length === 1);

  const emptyGate = buildAdvancedDataGate({ fixture: { ...fixtures[0], id: "advanced-gate-empty", advancedEvidence: undefined }, prediction: { label: "Strong Home Win" } });
  assert.equal(emptyGate.verdict, "insufficient-data");
}


function runAdvancedDataWeightControlsSmokeTests() {
  const fixture = cloneFixtures(fixtures)[0];
  fixture.advancedEvidence = {
    home: {
      recentExpectedGoalsFor: 2.4,
      recentExpectedGoalsAgainst: 0.8,
      recentOpponentAveragePointsPerGame: 1.8,
      daysSinceLastMatch: 7,
      matchesLast7Days: 1,
      setPieceGoalsFor: 4,
      setPieceGoalsAgainst: 1,
    },
    away: {
      recentExpectedGoalsFor: 0.8,
      recentExpectedGoalsAgainst: 1.9,
      recentOpponentAveragePointsPerGame: 0.9,
      daysSinceLastMatch: 2,
      matchesLast7Days: 3,
      missingKeyAttackers: 1,
      missingKeyDefenders: 1,
      setPieceGoalsFor: 1,
      setPieceGoalsAgainst: 4,
    },
    match: { marketMovementDirection: "home-shortening", marketMovementStrength: 6 },
  };
  const basePrediction = runPrediction(fixture.scores, defaultRuleWeights);

  const reviewOnly = applyAdvancedDataWeightControls({
    fixture,
    prediction: basePrediction,
    controls: defaultAdvancedDataWeightControls,
    weights: defaultRuleWeights,
  });
  assert.equal(reviewOnly.prediction.confidence, basePrediction.confidence);
  assert.equal(reviewOnly.integration.applied, false);

  const enabled = applyAdvancedDataWeightControls({
    fixture,
    prediction: basePrediction,
    controls: {
      enabled: true,
      mode: "confidence-only",
      maxConfidenceAdjustment: 3,
      minimumSignalsRequired: 2,
      allowReviewEscalation: true,
    },
    weights: defaultRuleWeights,
  });
  assert.equal(enabled.prediction.homeEdge, basePrediction.homeEdge);
  assert.ok(Math.abs(enabled.prediction.confidence - basePrediction.confidence) <= 3);
  assert.ok(enabled.integration.gateResult.signalCount >= 2);

  const summary = summariseAdvancedDataIntegration([reviewOnly.integration, enabled.integration], {
    enabled: true,
    mode: "confidence-only",
    maxConfidenceAdjustment: 3,
    minimumSignalsRequired: 2,
    allowReviewEscalation: true,
  });
  assert.equal(summary.enabled, true);
  assert.ok(summary.fixtureCount === 2);
}

function runAdvancedDataWeightSandboxSmokeTests() {
  const fixture = cloneFixtures(fixtures)[0];
  fixture.id = "advanced-weight-sandbox-1";
  fixture.matchResult = { status: "final", homeGoals: 2, awayGoals: 0 };
  fixture.advancedEvidence = {
    home: {
      recentExpectedGoalsFor: 2.4,
      recentExpectedGoalsAgainst: 0.7,
      recentOpponentAveragePointsPerGame: 1.8,
      daysSinceLastMatch: 7,
      setPieceGoalsFor: 4,
    },
    away: {
      recentExpectedGoalsFor: 0.9,
      recentExpectedGoalsAgainst: 1.9,
      recentOpponentAveragePointsPerGame: 0.8,
      daysSinceLastMatch: 2,
      matchesLast7Days: 3,
      missingKeyAttackers: 1,
      missingKeyDefenders: 1,
      setPieceGoalsAgainst: 4,
    },
    match: { marketMovementDirection: "home-shortening", marketMovementStrength: 6 },
  };
  const basePrediction = runPrediction(fixture.scores, defaultRuleWeights);
  const reviewOnly = applyAdvancedDataWeightControls({
    fixture,
    prediction: basePrediction,
    controls: defaultAdvancedDataWeightControls,
    weights: defaultRuleWeights,
  });
  const enabledControls = {
    enabled: true,
    mode: "confidence-only" as const,
    maxConfidenceAdjustment: 3,
    minimumSignalsRequired: 2,
    allowReviewEscalation: true,
  };
  const enabled = applyAdvancedDataWeightControls({
    fixture,
    prediction: basePrediction,
    controls: enabledControls,
    weights: defaultRuleWeights,
  });
  const baselineAccuracy = calculateResultAccuracy(reviewOnly.prediction, fixture.matchResult);
  const proposedAccuracy = calculateResultAccuracy(enabled.prediction, fixture.matchResult);
  const sandbox = summariseAdvancedDataWeightSandbox([
    {
      fixture,
      baselinePrediction: reviewOnly.prediction,
      baselineAccuracy,
      baselineIntegration: reviewOnly.integration,
      proposedPrediction: enabled.prediction,
      proposedAccuracy,
      proposedIntegration: enabled.integration,
    },
  ], enabledControls);
  assert.equal(sandbox.fixtureCount, 1);
  assert.equal(sandbox.settledFixtureCount, 1);
  assert.ok(sandbox.confidenceMovedCount >= 1, "sandbox should count confidence-only movement");
  assert.equal(sandbox.proposedEnabled, true);
  assert.ok(sandbox.outcomes.length >= 1);
}

function runAdvancedDataCalibrationSmokeTests() {
  const advancedFixture: Fixture = {
    ...fixtures[0],
    id: "advanced-calibration-1",
    matchResult: { status: "final", homeGoals: 2, awayGoals: 1 },
    advancedEvidence: {
      home: {
        recentExpectedGoalsFor: 2.1,
        recentExpectedGoalsAgainst: 0.8,
        recentOpponentAveragePointsPerGame: 1.9,
        daysSinceLastMatch: 6,
        missingStarters: 0,
        setPieceGoalsFor: 4,
        cornersForPerMatch: 6,
      },
      away: {
        recentExpectedGoalsFor: 1.0,
        recentExpectedGoalsAgainst: 1.7,
        recentOpponentAveragePointsPerGame: 1.1,
        daysSinceLastMatch: 2,
        matchesLast7Days: 2,
        travelBurden: "high",
        missingStarters: 2,
        missingGoalkeepers: 1,
        setPieceGoalsAgainst: 3,
        cornersAgainstPerMatch: 5,
      },
      match: {
        marketMovementDirection: "home-shortening",
        marketMovementStrength: 6,
      },
    },
  };
  const prediction = runPrediction({
    qualityGap: 4,
    homeAdvantage: 2,
    recentFormGap: 2,
    headToHeadEdge: 0,
    injuryRisk: -1,
    motivationEdge: 1,
    otherStatsEdge: 0,
    oddsSupport: 1,
    conflictScore: 0,
  }, defaultRuleWeights);
  const accuracy = calculateResultAccuracy(prediction, advancedFixture.matchResult);
  const summary = summariseAdvancedDataCalibration([{ fixture: advancedFixture, prediction, accuracy }]);

  assert.equal(summary.fixtureCount, 1);
  assert.equal(summary.settledFixtureCount, 1);
  assert.equal(summary.fixturesWithAdvancedGateData, 1);
  assert.ok(summary.supportiveSignalHitRatePct >= 0);
  assert.ok(summary.recommendation.length > 0);
  assert.ok(summary.notes.some((note) => note.includes("does not auto-retune")));
}

function runReleaseChecklistSmokeTests() {
  const summary = buildReleaseChecklist({
    fixtureCount: fixtures.length,
    competitionCount: getCompetitionNames(fixtures).length,
    entrantCount: 3,
    aliasRuleCount: 5,
    tuningPresetCount: 2,
    modelChangeLogCount: 1,
    hasSupabaseConfig: false,
  });

  assert.equal(summary.version, "0.45.0");
  assert.equal(summary.patch, "P45");
  assert.ok(summary.deploymentItems.some((item) => item.id === "lockfile" && item.status === "pass"));
  assert.ok(summary.deploymentItems.some((item) => item.id === "supabase" && item.status === "warn"));
  assert.equal(summary.standingItems.length, 4);
  assert.ok(summary.standingItems.every((item) => item.state === "left-alone"));

  const counts = countChecklistStatuses(summary.deploymentItems);
  assert.ok(counts.pass >= 2, "release checklist should include passing deployment checks");
  assert.ok(counts.warn >= 1, "release checklist should flag missing Supabase config as a check item");
}

runQualityAndPredictionSmokeTest();
runOutcomeProbabilitySmokeTests();
runProbabilityCalibrationSmokeTests();
runModelTuningRecommendationsSmokeTests();
runTuningSandboxSmokeTests();
runTuningPresetSmokeTests();
runModelChangeLogSmokeTests();
runModelVersionComparisonSmokeTests();
runReleaseChecklistSmokeTests();
runAdvancedEvidenceSmokeTests();
runAdvancedEvidenceImpactSmokeTests();
runAdvancedDataGateSmokeTests();
runAdvancedDataWeightControlsSmokeTests();
runAdvancedDataWeightSandboxSmokeTests();
runAdvancedDataCalibrationSmokeTests();
runWorkspaceRecoveryVaultSmokeTests();
runWorkspaceRestoreResolverSmokeTests();
runWorkspacePreservationSmokeTests();
runCompetitionDataQualitySmokeTests();
runDirectionalConversionSmokeTests();
runAvailabilityAndConflictSmokeTests();
runResultAndLearningSmokeTests();
runWorkspaceSmokeTests();
runCsvImportExportSmokeTests();
runFixtureAutomationSmokeTests();
runWorkspaceBatchAndLiveFixturesSmokeTests();
runEvidenceAuditSmokeTests();
runLiveFixtureMaintenanceSmokeTests();
runCustomCompetitionImportSmokeTests();
runImportPreviewSmokeTests();
runTeamAliasSmokeTests();
async function runServerAuthSmokeTests() {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  try {
    // When Supabase isn't configured at all, there's no auth mechanism
    // available anywhere in the app -- this must fail open, or the app
    // (including the owner) would be permanently locked out with no way
    // to ever authenticate.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const unconfiguredResult = await verifyRequestSession(new Request("http://localhost/api/test"));
    assert.equal(unconfiguredResult, true, "should fail open when Supabase is not configured at all");

    // Supabase configured, but no admin email designated yet -- must fail
    // closed. Letting any signed-in account through here would defeat the
    // single-admin model this check exists to enforce.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    const noAdminEmailResult = await verifyRequestSession(
      new Request("http://localhost/api/test", { headers: { authorization: "Bearer sometoken" } }),
    );
    assert.equal(noAdminEmailResult, false, "should fail closed when configured but no admin email is designated");

    // Fully configured, but no Authorization header present -- fail closed.
    process.env.NEXT_PUBLIC_ADMIN_EMAIL = "admin@example.com";
    const noHeaderResult = await verifyRequestSession(new Request("http://localhost/api/test"));
    assert.equal(noHeaderResult, false, "should fail closed when configured but no Authorization header is sent");
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    if (originalAdminEmail === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    else process.env.NEXT_PUBLIC_ADMIN_EMAIL = originalAdminEmail;
  }
}

runCompetitionInsightsSmokeTests();
runCompetitionFixtureFilterSmokeTests();
runBankrollSmokeTests();
runTennisScoringSmokeTests();

(async () => {
  await runServerAuthSmokeTests();
  console.log("Smoke tests passed: scoring, gates, results, learning, workspace helpers, CSV import/export, custom competition import, fixture automation, live fixtures mapping, evidence audit, live fixture maintenance, quick prediction dropdowns, import previews, team aliases, competition insights, P28 outcome probabilities, P29 probability calibration, P30 model tuning recommendations, P31 tuning sandbox, P32 tuning presets, P33 model change log, P34 model version comparison, P36-P40 release checklist, P37 data quality, P38 workspace preservation, P39 recovery vault, P40 restore resolver, P41/P42 advanced evidence schema/imports, P43 advanced evidence impact signals, P44 advanced data gate, P45 advanced data calibration, P46 advanced data weight controls, P47 advanced data weight sandbox, server-side auth gate and tennis scoring engine.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
