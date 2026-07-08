"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Entrant,
  Fixture,
  TipPick,
  UserTip,
  entrants as initialEntrants,
  fixtures as initialFixtures,
  userTips as initialUserTips,
} from "../lib/sampleData";
import {
  AbsenceReason,
  MatchContext,
  MatchResultInput,
  MatchScores,
  MissingPlayer,
  OddsMarket,
  PlayerImportance,
  RecentFormGame,
  RecentResult,
  TeamContext,
  TeamStats,
  RuleWeights,
  calculateAccuracySummary,
  defaultRuleWeights,
} from "../lib/scoringEngine";
import { createBrowserSupabaseClient } from "../lib/supabaseClient";
import { usePredictionModel } from "../hooks/usePredictionModel";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { useWorkspaceAutosave } from "../hooks/useWorkspaceAutosave";
import { useWorkspaceCloudSync } from "../hooks/useWorkspaceCloudSync";
import { FixtureList } from "../components/FixtureList";
import { RoundManagement } from "../components/RoundManagement";
import { WorkspacePersistencePanel, CloudSyncPanel, CustomCompetitionImportPanel, FixtureCsvPanel, FixtureAutomationPanel, LiveFixturesPanel, LiveFixtureMaintenancePanel, type LiveFixtureAdminStatus } from "../components/WorkspacePanels";
import { AccuracyDashboard, EvidenceReadinessPanel, LeaderboardPanel, RuleLearningPanel, RuleWeightTuningPanel } from "../components/DashboardPanels";
import { PredictionSummaryPanel, FixtureDetailsPanel, EntrantsPicksPanel, ResultInputsPanel } from "../components/FixturePanels";
import { QuickPredictionPanel } from "../components/QuickPredictionPanel";
import { TennisQuickPredictionPanel } from "../components/TennisPanels";
import { TeamStrengthInputsPanel, RecentFormInputsPanel, AvailabilityInputsPanel, ContextInputsPanel, OddsInputsPanel, GateEvidencePanels, ManualGateInputsPanel, PredictionGatesPanel } from "../components/EvidenceInputPanels";
import {
  ALL_ROUNDS,
  applyFixtureBatch,
  calculateTipPoints,
  cloneEntrants,
  cloneFixtures,
  cloneUserTips,
  createBlankFixture,
  getActualOutcomeFromScore,
  getTipFor,
  normaliseRound,
  type FixtureBatchMode,
} from "../lib/workspace";
import { exportFixturesToCsv, importFixturesFromCsv } from "../lib/csvWorkspace";
import { exportRawCompetitionTemplateCsv, importCustomCompetitionFromCsv } from "../lib/customCompetitionImport";
import { generateRoundRobinFixtures, FixtureGenerationRequest } from "../lib/fixtureAutomation";
import { fetchLiveFixtures } from "../lib/liveFixtures";
import {
  loadRememberedAdminSecret,
  saveRememberedAdminSecret,
  forgetRememberedAdminSecret,
} from "../lib/adminSecretStorage";
import { auditFixtureEvidence, summariseEvidenceAudits } from "../lib/evidenceAudit";

export default function Home() {
  type WorkspaceTab = "tip" | "evidence" | "data" | "analytics" | "competition" | "tennis";
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tip");
  const [fixtures, setFixtures] = useState<Fixture[]>(() => cloneFixtures(initialFixtures));
  const [activeFixtureId, setActiveFixtureId] = useState(fixtures[0]?.id ?? "");
  const [selectedRound, setSelectedRound] = useState<string>(ALL_ROUNDS);
  const [ruleWeights, setRuleWeights] = useState<RuleWeights>(() => ({ ...defaultRuleWeights }));
  const [entrants, setEntrants] = useState<Entrant[]>(() => cloneEntrants(initialEntrants));
  const [userTips, setUserTips] = useState<UserTip[]>(() => cloneUserTips(initialUserTips));
  const [csvMessage, setCsvMessage] = useState("CSV import/export has not run yet.");
  const [customCompetitionMessage, setCustomCompetitionMessage] = useState("Custom competition import has not run yet.");
  const [automationMessage, setAutomationMessage] = useState("Fixture automation has not run yet.");
  const [liveFixturesMessage, setLiveFixturesMessage] = useState("Live fixtures have not been fetched yet.");
  const [liveFixturesCompetition, setLiveFixturesCompetition] = useState("PL");
  const [isLoadingLiveFixtures, setIsLoadingLiveFixtures] = useState(false);
  const [liveFixtureAdminSecret, setLiveFixtureAdminSecret] = useState("");
  const [rememberAdminSecret, setRememberAdminSecret] = useState(false);
  const [liveFixtureAdminCompetition, setLiveFixtureAdminCompetition] = useState("PL");
  const [liveFixtureAdminMessage, setLiveFixtureAdminMessage] = useState("Live fixture maintenance has not run yet.");
  const [liveFixtureAdminStatus, setLiveFixtureAdminStatus] = useState<LiveFixtureAdminStatus | null>(null);
  const [isLiveFixtureAdminBusy, setIsLiveFixtureAdminBusy] = useState(false);

  useEffect(() => {
    const remembered = loadRememberedAdminSecret();
    if (remembered) {
      setLiveFixtureAdminSecret(remembered);
      setRememberAdminSecret(true);
    }
  }, []);

  function handleAdminSecretChange(value: string) {
    setLiveFixtureAdminSecret(value);
    if (rememberAdminSecret) saveRememberedAdminSecret(value);
  }

  function handleRememberAdminSecretChange(remember: boolean) {
    setRememberAdminSecret(remember);
    if (remember) {
      saveRememberedAdminSecret(liveFixtureAdminSecret);
    } else {
      forgetRememberedAdminSecret();
    }
  }

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const {
    activeUserEmail,
    authEmail,
    authMessage,
    isAuthBusy,
    session,
    sendMagicLink,
    setAuthEmail,
    signOutOfSupabase,
  } = useSupabaseAuth(supabase);

  const {
    exportWorkspaceBackup,
    importWorkspaceBackup,
    lastSavedAt,
    resetWorkspaceToSamples,
    setLastSavedAt,
    storageMessage,
  } = useWorkspaceAutosave({
    fixtures,
    activeFixtureId,
    selectedRound,
    ruleWeights,
    entrants,
    userTips,
    setFixtures,
    setActiveFixtureId,
    setSelectedRound,
    setRuleWeights,
    setEntrants,
    setUserTips,
  });

  const {
    cloudMessage,
    cloudWorkspaceId,
    createNewCloudWorkspaceId,
    hasSupabaseConfig,
    isCloudBusy,
    loadWorkspaceFromCloud,
    saveWorkspaceToCloud,
    setCloudWorkspaceId,
  } = useWorkspaceCloudSync({
    supabase,
    session,
    activeUserEmail,
    fixtures,
    activeFixtureId,
    selectedRound,
    ruleWeights,
    entrants,
    userTips,
    setFixtures,
    setActiveFixtureId,
    setSelectedRound,
    setRuleWeights,
    setEntrants,
    setUserTips,
    setLastSavedAt,
  });

  const {
    activeFixture,
    accuracy,
    accuracySummary,
    availability,
    computedFixtureResults,
    conflict,
    context,
    form,
    odds,
    prediction: result,
    quality,
    ruleLearning,
  } = usePredictionModel(fixtures, activeFixtureId, ruleWeights);

  const roundNames = useMemo(() => {
    return Array.from(new Set(fixtures.map((fixture) => normaliseRound(fixture.round)))).sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [fixtures]);

  const visibleFixtureResults = useMemo(() => {
    if (selectedRound === ALL_ROUNDS) return computedFixtureResults;
    return computedFixtureResults.filter(
      (item) => normaliseRound(item.fixture.round) === selectedRound,
    );
  }, [computedFixtureResults, selectedRound]);

  const visibleFixtures = useMemo(
    () => visibleFixtureResults.map((item) => item.fixture),
    [visibleFixtureResults],
  );

  const roundSummaries = useMemo(() => {
    return roundNames.map((roundName) => {
      const items = computedFixtureResults.filter(
        (item) => normaliseRound(item.fixture.round) === roundName,
      );
      const finalFixtures = items.filter(
        (item) => item.accuracy.actualOutcome !== "pending",
      ).length;
      const published = items.filter((item) => item.accuracy.isTipPublished).length;
      const correct = items.filter((item) => item.accuracy.isCorrect === true).length;
      return {
        roundName,
        fixtures: items.length,
        finalFixtures,
        pendingFixtures: items.length - finalFixtures,
        published,
        correct,
        hitRate: published > 0 ? Math.round((correct / published) * 100) : 0,
      };
    });
  }, [computedFixtureResults, roundNames]);

  const selectedRoundLabel = selectedRound === ALL_ROUNDS ? "All rounds" : selectedRound;

  const selectedRoundAccuracySummary = useMemo(
    () =>
      calculateAccuracySummary(
        visibleFixtureResults.map((item) => item.accuracy),
        visibleFixtureResults.map((item) => item.confidence),
      ),
    [visibleFixtureResults],
  );

  const evidenceAuditSummary = useMemo(
    () => summariseEvidenceAudits(visibleFixtures),
    [visibleFixtures],
  );

  const activeEvidenceAudit = useMemo(
    () => auditFixtureEvidence(activeFixture),
    [activeFixture],
  );

  const leaderboard = useMemo(() => {
    return entrants
      .map((entrant) => {
        let submitted = 0;
        let settled = 0;
        let correct = 0;
        let pending = 0;
        let points = 0;
        let confidenceTotal = 0;

        visibleFixtures.forEach((fixture) => {
          const tip = getTipFor(userTips, fixture.id, entrant.id);
          if (!tip) return;
          submitted += 1;
          confidenceTotal += tip.confidence;
          const actualOutcome = getActualOutcomeFromScore(fixture.matchResult);
          if (actualOutcome === "pending") {
            pending += 1;
            return;
          }
          settled += 1;
          const awarded = calculateTipPoints(tip.pick, actualOutcome);
          points += awarded;
          if (awarded > 0) correct += 1;
        });

        return {
          ...entrant,
          submitted,
          settled,
          correct,
          pending,
          points,
          hitRate: settled > 0 ? Math.round((correct / settled) * 100) : 0,
          averageConfidence:
            submitted > 0 ? Math.round(confidenceTotal / submitted) : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.hitRate - a.hitRate || b.correct - a.correct);
  }, [entrants, visibleFixtures, userTips]);
  function generateAutomatedFixtures(request: FixtureGenerationRequest, mode: "append" | "replace") {
    const generation = generateRoundRobinFixtures(request);
    if (generation.fixtures.length === 0) {
      setAutomationMessage(generation.warnings.join(" ") || "Fixture generation failed: no fixtures created.");
      return;
    }

    const applied = applyFixtureBatch(generation.fixtures, fixtures, userTips, mode);
    setFixtures(applied.fixtures);
    setUserTips(applied.tips);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setAutomationMessage(
      `Generated ${generation.fixtures.length} fixtures for ${generation.teams.length} teams using ${request.format} round-robin ${mode} mode.${
        applied.orphanedTipsCount > 0
          ? ` Removed ${applied.orphanedTipsCount} tip${applied.orphanedTipsCount === 1 ? "" : "s"} that pointed at fixtures no longer in the workspace.`
          : ""
      }${generation.warnings.length ? ` Warnings: ${generation.warnings.join(" ")}` : ""}`,
    );
  }

  async function loadLiveFixtures(mode: "append" | "replace") {
    setIsLoadingLiveFixtures(true);
    try {
      const result = await fetchLiveFixtures(supabase, liveFixturesCompetition);
      if (result.fixtures.length === 0) {
        setLiveFixturesMessage(result.warnings.join(" ") || "No live fixtures were returned.");
        return;
      }

      const applied = applyFixtureBatch(result.fixtures, fixtures, userTips, mode);
      setFixtures(applied.fixtures);
      setUserTips(applied.tips);
      setActiveFixtureId(applied.fixtures[0].id);
      setSelectedRound(normaliseRound(applied.fixtures[0].round));
      setLiveFixturesMessage(
        `Fetched ${result.fixtures.length} live fixtures using ${mode} mode.${
          applied.orphanedTipsCount > 0
            ? ` Removed ${applied.orphanedTipsCount} tip${applied.orphanedTipsCount === 1 ? "" : "s"} that pointed at fixtures no longer in the workspace.`
            : ""
        }${result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : ""}`,
      );
    } finally {
      setIsLoadingLiveFixtures(false);
    }
  }


  async function runLiveFixtureAdminAction(action: "status" | "refresh" | "cleanup") {
    if (!liveFixtureAdminSecret.trim()) {
      setLiveFixtureAdminMessage("Enter the admin / cron secret before running live fixture maintenance.");
      return;
    }

    if (action === "cleanup") {
      const confirmed = window.confirm(
        "Clean old rows from the shared live fixture cache? This only deletes cached live_fixtures rows older than the retention window and does not touch your workspace fixtures or entrant tips. Continue?",
      );
      if (!confirmed) return;
    }

    setIsLiveFixtureAdminBusy(true);
    try {
      const endpoint = "/api/admin/live-fixtures";
      const response = action === "status"
        ? await fetch(endpoint, {
            headers: { authorization: `Bearer ${liveFixtureAdminSecret.trim()}` },
          })
        : await fetch(endpoint, {
            method: "POST",
            headers: {
              authorization: `Bearer ${liveFixtureAdminSecret.trim()}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ action, competition: liveFixtureAdminCompetition }),
          });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Live fixture maintenance failed with HTTP ${response.status}`);
      }

      setLiveFixtureAdminStatus(payload.status ?? null);
      if (action === "status") {
        setLiveFixtureAdminMessage("Live fixture cache status loaded.");
      } else if (action === "refresh") {
        const refresh = payload.refresh;
        setLiveFixtureAdminMessage(
          `Refresh completed. Upserted ${refresh?.fixturesUpserted ?? 0} fixtures and processed ${refresh?.teamsProcessed ?? 0} teams.`,
        );
      } else {
        const cleanup = payload.cleanup;
        setLiveFixtureAdminMessage(
          `Cleanup completed. Deleted ${cleanup?.deletedRows ?? 0} stale live fixture row${cleanup?.deletedRows === 1 ? "" : "s"}.`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown live fixture maintenance error.";
      setLiveFixtureAdminMessage(message);
    } finally {
      setIsLiveFixtureAdminBusy(false);
    }
  }

  function exportFixturesCsv() {
    const csv = exportFixturesToCsv(fixtures);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `matchday-fixtures-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCsvMessage(`Exported ${fixtures.length} fixtures to CSV.`);
  }


  function describeBatchApply(applied: ReturnType<typeof applyFixtureBatch>) {
    const parts: string[] = [];
    if (applied.replacedCompetitionCount > 0) {
      parts.push(`Replaced ${applied.replacedCompetitionCount} imported competition${applied.replacedCompetitionCount === 1 ? "" : "s"} only; ${applied.preservedFixtureCount} fixture${applied.preservedFixtureCount === 1 ? "" : "s"} from other competitions stayed in the workspace.`);
    }
    if (applied.updatedFixtureCount > 0 || applied.addedFixtureCount > 0) {
      parts.push(`Updated ${applied.updatedFixtureCount} matching fixture${applied.updatedFixtureCount === 1 ? "" : "s"} and added ${applied.addedFixtureCount} new fixture${applied.addedFixtureCount === 1 ? "" : "s"}.`);
    }
    if (applied.orphanedTipsCount > 0) {
      parts.push(`Removed ${applied.orphanedTipsCount} tip${applied.orphanedTipsCount === 1 ? "" : "s"} that pointed at fixtures no longer in the workspace.`);
    }
    return parts.length ? ` ${parts.join(" ")}` : "";
  }

  function importFixturesCsv(csv: string, mode: FixtureBatchMode) {
    const importResult = importFixturesFromCsv(csv);
    if (importResult.fixtures.length === 0) {
      setCsvMessage(importResult.warnings.join(" ") || "CSV import failed: no valid fixtures found.");
      return;
    }

    const applied = applyFixtureBatch(importResult.fixtures, fixtures, userTips, mode);
    setFixtures(applied.fixtures);
    setUserTips(applied.tips);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setCsvMessage(
      `Imported ${importResult.fixtures.length} fixtures from CSV/XLSX using ${mode} mode.${describeBatchApply(applied)}${
        importResult.warnings.length ? ` Warnings: ${importResult.warnings.join(" ")}` : ""
      }`,
    );
  }

  function exportRawCompetitionTemplate() {
    const csv = exportRawCompetitionTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `matchday-raw-competition-template-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCustomCompetitionMessage("Exported raw competition results/fixtures template.");
  }

  function importRawCompetition(csv: string, mode: FixtureBatchMode) {
    const importResult = importCustomCompetitionFromCsv(csv);
    if (importResult.fixtures.length === 0) {
      setCustomCompetitionMessage(importResult.warnings.join(" ") || "Raw competition import failed: no valid rows found.");
      return;
    }

    const applied = applyFixtureBatch(importResult.fixtures, fixtures, userTips, mode, importResult.competitions);
    setFixtures(applied.fixtures);
    setUserTips(applied.tips);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setCustomCompetitionMessage(
      `Imported ${importResult.fixtures.length} custom competition fixture${importResult.fixtures.length === 1 ? "" : "s"} from ${importResult.competitions.join(", ") || "raw file"} using ${mode} mode. ` +
        `Processed ${importResult.finalRows} final result row${importResult.finalRows === 1 ? "" : "s"}, ${importResult.scheduledRows} scheduled row${importResult.scheduledRows === 1 ? "" : "s"}, and ${importResult.teams.length} team${importResult.teams.length === 1 ? "" : "s"}.` +
        describeBatchApply(applied) +
        `${importResult.warnings.length ? ` Warnings: ${importResult.warnings.join(" ")}` : ""}`,
    );
  }

  function updateSelectedRound(nextRound: string) {
    setSelectedRound(nextRound);
    const nextVisible =
      nextRound === ALL_ROUNDS
        ? fixtures
        : fixtures.filter((fixture) => normaliseRound(fixture.round) === nextRound);
    if (nextVisible.length > 0 && !nextVisible.some((fixture) => fixture.id === activeFixtureId)) {
      setActiveFixtureId(nextVisible[0].id);
    }
  }

  function addRound() {
    const nextRound = `Round ${roundNames.length + 1}`;
    setSelectedRound(nextRound);
    const nextFixture = createBlankFixture(nextRound, activeFixture?.competition ?? "New Competition");
    setFixtures((current) => [nextFixture, ...current]);
    setActiveFixtureId(nextFixture.id);
  }

  function updateScore(key: keyof MatchScores, value: number) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? { ...fixture, scores: { ...fixture.scores, [key]: value } }
          : fixture,
      ),
    );
  }

  function updateRuleWeight(key: keyof RuleWeights, value: number) {
    setRuleWeights((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetRuleWeights() {
    setRuleWeights({ ...defaultRuleWeights });
  }

  function updateEntrantName(entrantId: string, name: string) {
    setEntrants((current) =>
      current.map((entrant) =>
        entrant.id === entrantId ? { ...entrant, name } : entrant,
      ),
    );
  }

  function addEntrant() {
    const nextId = `entrant-${Date.now()}`;
    setEntrants((current) => [
      ...current,
      { id: nextId, name: `Player ${current.length + 1}` },
    ]);
  }

  function updateUserTip(entrantId: string, key: keyof UserTip, value: string | number) {
    setUserTips((current) => {
      const existing = current.find(
        (tip) => tip.fixtureId === activeFixture.id && tip.entrantId === entrantId,
      );
      const nextTip: UserTip = {
        fixtureId: activeFixture.id,
        entrantId,
        pick:
          key === "pick"
            ? (value as TipPick)
            : existing?.pick ?? "home",
        confidence:
          key === "confidence"
            ? Math.max(0, Math.min(100, Number(value)))
            : existing?.confidence ?? 50,
      };

      if (!existing) return [...current, nextTip];

      return current.map((tip) =>
        tip.fixtureId === activeFixture.id && tip.entrantId === entrantId
          ? nextTip
          : tip,
      );
    });
  }

  function updateStats(
    side: "homeStats" | "awayStats",
    key: keyof TeamStats,
    value: number,
  ) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? {
              ...fixture,
              [side]: { ...fixture[side], [key]: Math.max(0, value) },
            }
          : fixture,
      ),
    );
  }

  function updateRecentForm(
    side: "homeRecentForm" | "awayRecentForm",
    index: number,
    key: keyof RecentFormGame,
    value: number | RecentResult,
  ) {
    setFixtures((current) =>
      current.map((fixture) => {
        if (fixture.id !== activeFixture.id) return fixture;
        const nextForm = fixture[side].map((game, gameIndex) =>
          gameIndex === index
            ? {
                ...game,
                [key]: typeof value === "number" ? Math.max(0, value) : value,
              }
            : game,
        );
        return { ...fixture, [side]: nextForm };
      }),
    );
  }

  function updateMissingPlayer(
    side: "homeMissingPlayers" | "awayMissingPlayers",
    index: number,
    key: keyof MissingPlayer,
    value: string | boolean,
  ) {
    setFixtures((current) =>
      current.map((fixture) => {
        if (fixture.id !== activeFixture.id) return fixture;
        const nextPlayers = fixture[side].map((player, playerIndex) =>
          playerIndex === index ? { ...player, [key]: value } : player,
        );
        return { ...fixture, [side]: nextPlayers };
      }),
    );
  }

  function updateTeamContext(
    side: "homeContext" | "awayContext",
    key: keyof TeamContext,
    value: boolean,
  ) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? { ...fixture, [side]: { ...fixture[side], [key]: value } }
          : fixture,
      ),
    );
  }

  function updateMatchContext(key: keyof MatchContext, value: boolean) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? {
              ...fixture,
              matchContext: { ...fixture.matchContext, [key]: value },
            }
          : fixture,
      ),
    );
  }

  function updateOddsMarket(key: keyof OddsMarket, value: number | string) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? {
              ...fixture,
              oddsMarket: {
                ...fixture.oddsMarket,
                [key]: typeof value === "number" ? Math.max(0, value) : value,
              },
            }
          : fixture,
      ),
    );
  }

  function updateMatchResult(
    key: keyof MatchResultInput,
    value: number | string,
  ) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? {
              ...fixture,
              matchResult: {
                ...fixture.matchResult,
                [key]: typeof value === "number" ? Math.max(0, value) : value,
              },
            }
          : fixture,
      ),
    );
  }

  function resetFixture() {
    const original = initialFixtures.find(
      (fixture) => fixture.id === activeFixture.id,
    );
    if (!original) return;
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? {
              ...fixture,
              homeStats: { ...original.homeStats },
              awayStats: { ...original.awayStats },
              homeRecentForm: original.homeRecentForm.map((game) => ({
                ...game,
              })),
              awayRecentForm: original.awayRecentForm.map((game) => ({
                ...game,
              })),
              homeMissingPlayers: original.homeMissingPlayers.map((player) => ({
                ...player,
              })),
              awayMissingPlayers: original.awayMissingPlayers.map((player) => ({
                ...player,
              })),
              homeContext: { ...original.homeContext },
              awayContext: { ...original.awayContext },
              matchContext: { ...original.matchContext },
              oddsMarket: { ...original.oddsMarket },
              matchResult: { ...original.matchResult },
              scores: { ...original.scores },
            }
          : fixture,
      ),
    );
  }

  function addBlankFixture() {
    const nextFixture = createBlankFixture(
      selectedRound === ALL_ROUNDS ? "New Round" : selectedRound,
    );
    setFixtures((current) => [nextFixture, ...current]);
    setActiveFixtureId(nextFixture.id);
  }

  function updateFixtureField(
    key: keyof Pick<
      Fixture,
      "homeTeam" | "awayTeam" | "competition" | "round" | "date"
    >,
    value: string,
  ) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? { ...fixture, [key]: value }
          : fixture,
      ),
    );
  }

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="eyebrow">Tipping Gates App · P24</div>
          <h1>Evidence-based tipping gates with evidence readiness audits.</h1>
          <p className="lead">
            P24 adds custom competition import from raw CSV/XLSX results and fixtures, then auto-calculates standings, form and prediction-ready evidence for unsupported leagues.
          </p>
        </div>
        <button className="primary" onClick={addBlankFixture}>Add Fixture</button>
      </section>

      <RoundManagement
        selectedRound={selectedRound}
        selectedRoundLabel={selectedRoundLabel}
        roundNames={roundNames}
        roundSummaries={roundSummaries}
        visibleFixtureCount={visibleFixtureResults.length}
        selectedRoundAccuracySummary={selectedRoundAccuracySummary}
        onAddRound={addRound}
        onSelectRound={updateSelectedRound}
      />

      <nav className="workspace-tabs">
        <button className={activeTab === "tip" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("tip")}>
          Tip Now
        </button>
        <button className={activeTab === "evidence" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("evidence")}>
          Evidence{" "}
          <span className="workspace-tab-badge">{activeEvidenceAudit.completenessScore}%</span>
        </button>
        <button className={activeTab === "data" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("data")}>
          Data &amp; Import
        </button>
        <button className={activeTab === "analytics" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("analytics")}>
          Analytics &amp; Admin
        </button>
        <button className={activeTab === "competition" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("competition")}>
          Competition
        </button>
        <button className={activeTab === "tennis" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("tennis")}>
          Tennis
        </button>
      </nav>

      <section className="grid">
        <FixtureList
          activeFixtureId={activeFixture.id}
          fixtureCount={fixtures.length}
          selectedRoundLabel={selectedRoundLabel}
          visibleFixtureResults={visibleFixtureResults}
          onSelectFixture={setActiveFixtureId}
        />

        <div>
          {activeTab === "tip" && (
            <>
              <QuickPredictionPanel
                fixtures={fixtures}
                activeFixture={activeFixture}
                result={result}
                onMatchupFound={setActiveFixtureId}
              />
              <PredictionSummaryPanel
                fixture={activeFixture}
                result={result}
                quality={quality}
                form={form}
                availability={availability}
                context={context}
                odds={odds}
                conflict={conflict}
                accuracy={accuracy}
                evidenceAudit={activeEvidenceAudit}
              />
              <FixtureDetailsPanel fixture={activeFixture} onUpdateField={updateFixtureField} />
              <ResultInputsPanel fixture={activeFixture} accuracy={accuracy} onUpdateMatchResult={updateMatchResult} />
              <PredictionGatesPanel result={result} />
            </>
          )}

          {activeTab === "evidence" && (
            <>
              <TeamStrengthInputsPanel fixture={activeFixture} onUpdateStats={updateStats} />
              <RecentFormInputsPanel fixture={activeFixture} onUpdateRecentForm={updateRecentForm} />
              <AvailabilityInputsPanel fixture={activeFixture} onUpdateMissingPlayer={updateMissingPlayer} />
              <ContextInputsPanel
                fixture={activeFixture}
                onUpdateTeamContext={updateTeamContext}
                onUpdateMatchContext={updateMatchContext}
              />
              <GateEvidencePanels
                quality={quality}
                form={form}
                availability={availability}
                context={context}
                odds={odds}
                conflict={conflict}
              />
              <OddsInputsPanel fixture={activeFixture} onUpdateOddsMarket={updateOddsMarket} />
              <ManualGateInputsPanel
                scores={activeFixture.scores}
                onUpdateScore={updateScore}
                onResetFixture={resetFixture}
              />
            </>
          )}

          {activeTab === "data" && (
            <>
              <WorkspacePersistencePanel
                storageMessage={storageMessage}
                lastSavedAt={lastSavedAt}
                fixtureCount={fixtures.length}
                onExportBackup={exportWorkspaceBackup}
                onImportBackup={importWorkspaceBackup}
                onResetSamples={resetWorkspaceToSamples}
              />
              <FixtureAutomationPanel
                automationMessage={automationMessage}
                onGenerateFixtures={generateAutomatedFixtures}
              />
              <LiveFixturesPanel
                liveFixturesMessage={liveFixturesMessage}
                isLoadingLiveFixtures={isLoadingLiveFixtures}
                competition={liveFixturesCompetition}
                onCompetitionChange={setLiveFixturesCompetition}
                onFetchLiveFixtures={loadLiveFixtures}
              />
              <LiveFixtureMaintenancePanel
                adminSecret={liveFixtureAdminSecret}
                adminMessage={liveFixtureAdminMessage}
                adminStatus={liveFixtureAdminStatus}
                isAdminBusy={isLiveFixtureAdminBusy}
                competition={liveFixtureAdminCompetition}
                rememberAdminSecret={rememberAdminSecret}
                onAdminSecretChange={handleAdminSecretChange}
                onRememberAdminSecretChange={handleRememberAdminSecretChange}
                onCompetitionChange={setLiveFixtureAdminCompetition}
                onCheckStatus={() => runLiveFixtureAdminAction("status")}
                onRefreshNow={() => runLiveFixtureAdminAction("refresh")}
                onCleanupOldFixtures={() => runLiveFixtureAdminAction("cleanup")}
              />
              <CustomCompetitionImportPanel
                message={customCompetitionMessage}
                onExportTemplate={exportRawCompetitionTemplate}
                onImportRawCompetition={importRawCompetition}
              />
              <FixtureCsvPanel
                csvMessage={csvMessage}
                onExportCsv={exportFixturesCsv}
                onImportCsv={importFixturesCsv}
              />
              <CloudSyncPanel
                authEmail={authEmail}
                authMessage={authMessage}
                activeUserEmail={activeUserEmail}
                cloudWorkspaceId={cloudWorkspaceId}
                cloudMessage={cloudMessage}
                isCloudBusy={isCloudBusy || isAuthBusy || !hasSupabaseConfig}
                isSignedIn={Boolean(session)}
                onAuthEmailChange={setAuthEmail}
                onSendMagicLink={sendMagicLink}
                onSignOut={signOutOfSupabase}
                onCloudWorkspaceIdChange={setCloudWorkspaceId}
                onSaveCloud={saveWorkspaceToCloud}
                onLoadCloud={loadWorkspaceFromCloud}
                onNewCloudId={createNewCloudWorkspaceId}
              />
            </>
          )}

          {activeTab === "analytics" && (
            <>
              <AccuracyDashboard
                accuracySummary={accuracySummary}
                selectedRoundAccuracySummary={selectedRoundAccuracySummary}
                selectedRoundLabel={selectedRoundLabel}
              />
              <EvidenceReadinessPanel
                summary={evidenceAuditSummary}
                selectedRoundLabel={selectedRoundLabel}
              />
              <RuleLearningPanel ruleLearning={ruleLearning} />
              <RuleWeightTuningPanel
                ruleWeights={ruleWeights}
                quality={quality}
                conflict={conflict}
                onUpdateWeight={updateRuleWeight}
                onResetWeights={resetRuleWeights}
              />
            </>
          )}

          {activeTab === "competition" && (
            <>
              <EntrantsPicksPanel
                fixture={activeFixture}
                entrants={entrants}
                userTips={userTips}
                accuracy={accuracy}
                onUpdateEntrantName={updateEntrantName}
                onUpdateUserTip={updateUserTip}
                onAddEntrant={addEntrant}
              />
              <LeaderboardPanel leaderboard={leaderboard} selectedRoundLabel={selectedRoundLabel} />
            </>
          )}

          {activeTab === "tennis" && <TennisQuickPredictionPanel />}
        </div>
      </section>
    </main>
  );
}
