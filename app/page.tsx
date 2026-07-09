"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Fixture,
  FixtureBetLog,
  TipPick,
  fixtures as initialFixtures,
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
  calculateRuleLearningSummary,
  defaultRuleWeights,
} from "../lib/scoringEngine";
import { createBrowserSupabaseClient } from "../lib/supabaseClient";
import { usePredictionModel } from "../hooks/usePredictionModel";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { useWorkspaceAutosave } from "../hooks/useWorkspaceAutosave";
import { useWorkspaceCloudSync } from "../hooks/useWorkspaceCloudSync";
import { FixtureList } from "../components/FixtureList";
import { RoundManagement } from "../components/RoundManagement";
import { WorkspacePersistencePanel, WorkspaceRecoveryVaultPanel, WorkspaceRestoreResolverPanel, CloudSyncPanel, CustomCompetitionImportPanel, FixtureCsvPanel, FixtureAutomationPanel, LiveFixturesPanel, LiveFixtureMaintenancePanel, TeamAliasManagerPanel, type LiveFixtureAdminStatus } from "../components/WorkspacePanels";
import { AccuracyDashboard, AdvancedDataCalibrationPanel, AdvancedDataGatePanel, AdvancedDataWeightControlsPanel, AdvancedDataWeightSandboxPanel, AdvancedEvidenceImpactPanel, AdvancedEvidencePanel, CompetitionDataQualityPanel, CompetitionInsightsPanel, EvidenceReadinessPanel, ModelTuningRecommendationsPanel, ModelVersionComparisonPanel, ProbabilityCalibrationPanel, ReleaseChecklistPanel, RuleLearningPanel, RuleWeightTuningPanel, TuningSandboxPanel } from "../components/DashboardPanels";
import { PredictionSummaryPanel, FixtureDetailsPanel, ResultInputsPanel } from "../components/FixturePanels";
import { QuickPredictionPanel } from "../components/QuickPredictionPanel";
import { BetLoggingPanel } from "../components/BetLoggingPanel";
import { BankrollPanel } from "../components/BankrollPanel";
import { AuthGatePanel } from "../components/AuthGatePanel";
import { TennisQuickPredictionPanel } from "../components/TennisPanels";
import { TeamStrengthInputsPanel, RecentFormInputsPanel, AvailabilityInputsPanel, ContextInputsPanel, OddsInputsPanel, GateEvidencePanels, ManualGateInputsPanel, PredictionGatesPanel } from "../components/EvidenceInputPanels";
import {
  ALL_ROUNDS,
  applyFixtureBatch,
  cloneFixtures,
  createBlankFixture,
  createPersistedState,
  discoverLocalWorkspaceCandidates,
  getActualOutcomeFromScore,
  getFixtureBatchPreview,
  normaliseRound,
  type FixtureBatchMode,
} from "../lib/workspace";
import { exportFixturesToCsv, importFixturesFromCsv } from "../lib/csvWorkspace";
import { exportRawCompetitionTemplateCsv, getCustomWorkbookTemplate, importCustomCompetitionFromCsv, importCustomCompetitionFromWorkbookSheets } from "../lib/customCompetitionImport";
import { generateRoundRobinFixtures, FixtureGenerationRequest } from "../lib/fixtureAutomation";
import { fetchLiveFixtures } from "../lib/liveFixtures";
import {
  loadRememberedAdminSecret,
  saveRememberedAdminSecret,
  forgetRememberedAdminSecret,
} from "../lib/adminSecretStorage";
import { auditFixtureEvidence, summariseEvidenceAudits } from "../lib/evidenceAudit";
import { DEFAULT_TEAM_ALIAS_RULES, TeamAliasRule, applyTeamAliasesToFixtures, cloneTeamAliases, detectTeamNameIssues } from "../lib/teamAliases";
import { getCompetitionNames, summariseCompetition } from "../lib/competitionInsights";
import { summariseProbabilityCalibration } from "../lib/probabilityCalibration";
import { summariseModelTuningRecommendations } from "../lib/modelTuningRecommendations";
import { summariseTuningSandbox } from "../lib/tuningSandbox";
import { buildModelVersionComparisonTargets, summariseModelVersionComparison } from "../lib/modelVersionComparison";
import { buildReleaseChecklist } from "../lib/releaseChecklist";
import { buildWorkspaceRestoreResolverSummary } from "../lib/workspaceRestoreResolver";
import { summariseCompetitionDataQuality } from "../lib/competitionDataQuality";
import { summariseAdvancedEvidence } from "../lib/advancedEvidence";
import { buildAdvancedEvidenceImpactSummary } from "../lib/advancedEvidenceImpact";
import { buildAdvancedDataGateSummary } from "../lib/advancedDataGate";
import { defaultAdvancedDataWeightControls, type AdvancedDataWeightControls } from "../lib/advancedDataWeightControls";
import { summariseAdvancedDataCalibration } from "../lib/advancedDataCalibration";
import { TuningPreset, cloneTuningPresets, createTuningPreset, deleteTuningPreset, updateTuningPreset } from "../lib/tuningPresets";
import { buildBankrollRows } from "../lib/bankroll";
import {
  ModelChangeLogEntry,
  appendModelChangeLogEntry,
  createModelChangeLogEntry,
  summariseModelChangeLog,
} from "../lib/modelChangeLog";

export default function Home() {
  type WorkspaceTab = "tip" | "evidence" | "data" | "analytics" | "bankroll" | "tennis";
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tip");
  const [fixtures, setFixtures] = useState<Fixture[]>(() => cloneFixtures(initialFixtures));
  const [activeFixtureId, setActiveFixtureId] = useState(fixtures[0]?.id ?? "");
  const [selectedRound, setSelectedRound] = useState<string>(ALL_ROUNDS);
  const [ruleWeights, setRuleWeights] = useState<RuleWeights>(() => ({ ...defaultRuleWeights }));
  const [sandboxRuleWeights, setSandboxRuleWeights] = useState<RuleWeights>(() => ({ ...defaultRuleWeights }));
  const [teamAliases, setTeamAliases] = useState<TeamAliasRule[]>(() => cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
  const [tuningPresets, setTuningPresets] = useState<TuningPreset[]>([]);
  const [modelChangeLog, setModelChangeLog] = useState<ModelChangeLogEntry[]>([]);
  const [advancedDataControls, setAdvancedDataControls] = useState<AdvancedDataWeightControls>(() => ({ ...defaultAdvancedDataWeightControls }));
  const [selectedModelComparisonTargetId, setSelectedModelComparisonTargetId] = useState("default");
  const [newPresetName, setNewPresetName] = useState("Weekly review preset");
  const [newPresetDescription, setNewPresetDescription] = useState("Tested in P31 sandbox before applying live.");
  const [selectedCompetitionView, setSelectedCompetitionView] = useState("");
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
    authMessage,
    isAdmin,
    isAuthBusy,
    loginEmail,
    loginPassword,
    session,
    setLoginEmail,
    setLoginPassword,
    signInWithPassword,
    signOutOfSupabase,
  } = useSupabaseAuth(supabase);

  const {
    adoptRecoverySnapshots,
    createManualRecoverySnapshot,
    deleteRecoverySnapshot,
    exportRecoveryVault,
    recoverySnapshots,
    recoveryVaultMessage,
    recoveryVaultSummary,
    restoreRecoverySnapshot,
    clearRecoveryVault,
    exportWorkspaceBackup,
    hasLoadedSavedState,
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
    teamAliases,
    tuningPresets,
    modelChangeLog,
    advancedDataControls,
    setFixtures,
    setActiveFixtureId,
    setSelectedRound,
    setRuleWeights,
    setTeamAliases,
    setTuningPresets,
    setModelChangeLog,
    setAdvancedDataControls,
  });

  const {
    cloudMessage,
    cloudMirrorStatus,
    cloudPreviewMessage,
    cloudPreviewState,
    cloudWorkspaceId,
    createNewCloudWorkspaceId,
    hasSupabaseConfig,
    isCloudBusy,
    lastCloudSavedAt,
    loadWorkspaceFromCloud,
    refreshCloudPreview,
    saveWorkspaceToCloud,
    setCloudWorkspaceId,
  } = useWorkspaceCloudSync({
    supabase,
    session,
    activeUserEmail,
    hasLoadedSavedState,
    fixtures,
    activeFixtureId,
    selectedRound,
    ruleWeights,
    teamAliases,
    tuningPresets,
    modelChangeLog,
    advancedDataControls,
    recoverySnapshots,
    onAdoptRecoverySnapshots: adoptRecoverySnapshots,
    setFixtures,
    setActiveFixtureId,
    setSelectedRound,
    setRuleWeights,
    setTeamAliases,
    setTuningPresets,
    setModelChangeLog,
    setAdvancedDataControls,
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
    probabilities,
    quality,
    ruleLearning,
    advancedDataIntegrationSummary,
    advancedDataWeightSandboxSummary,
  } = usePredictionModel(fixtures, activeFixtureId, ruleWeights, advancedDataControls);

  const roundNames = useMemo(() => {
    return Array.from(new Set(fixtures.map((fixture) => normaliseRound(fixture.round)))).sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [fixtures]);


  const competitionNames = useMemo(() => getCompetitionNames(fixtures), [fixtures]);

  useEffect(() => {
    if (competitionNames.length === 0) return;
    if (selectedCompetitionView && !competitionNames.includes(selectedCompetitionView)) {
      setSelectedCompetitionView(competitionNames[0]);
    }
  }, [competitionNames, selectedCompetitionView]);

  const competitionInsights = useMemo(
    () => summariseCompetition(fixtures, selectedCompetitionView || competitionNames[0] || ""),
    [fixtures, selectedCompetitionView, competitionNames],
  );

  const competitionDataQuality = useMemo(
    () => summariseCompetitionDataQuality(fixtures, selectedCompetitionView || competitionNames[0] || ""),
    [fixtures, selectedCompetitionView, competitionNames],
  );

  const advancedEvidenceSummary = useMemo(
    () => summariseAdvancedEvidence(fixtures),
    [fixtures],
  );

  const advancedEvidenceImpactSummary = useMemo(
    () => buildAdvancedEvidenceImpactSummary(computedFixtureResults),
    [computedFixtureResults],
  );

  const advancedDataGateSummary = useMemo(
    () => buildAdvancedDataGateSummary(computedFixtureResults),
    [computedFixtureResults],
  );

  const advancedDataCalibrationSummary = useMemo(
    () => summariseAdvancedDataCalibration(computedFixtureResults),
    [computedFixtureResults],
  );

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

  const tipVisibleFixtureResults = useMemo(() => {
    if (!selectedCompetitionView) return visibleFixtureResults;
    return visibleFixtureResults.filter((item) => item.fixture.competition === selectedCompetitionView);
  }, [visibleFixtureResults, selectedCompetitionView]);

  const displayedFixtureResults = activeTab === "tip" ? tipVisibleFixtureResults : visibleFixtureResults;

  useEffect(() => {
    if (activeTab !== "tip" || tipVisibleFixtureResults.length === 0) return;
    if (!tipVisibleFixtureResults.some((item) => item.fixture.id === activeFixtureId)) {
      setActiveFixtureId(tipVisibleFixtureResults[0].fixture.id);
    }
  }, [activeTab, tipVisibleFixtureResults, activeFixtureId]);

  const selectedRoundLabel = selectedRound === ALL_ROUNDS ? "All rounds" : selectedRound;

  const selectedRoundAccuracySummary = useMemo(
    () =>
      calculateAccuracySummary(
        visibleFixtureResults.map((item) => item.accuracy),
        visibleFixtureResults.map((item) => item.confidence),
      ),
    [visibleFixtureResults],
  );

  const tipNowAccuracySummary = useMemo(
    () =>
      calculateAccuracySummary(
        tipVisibleFixtureResults.map((item) => item.accuracy),
        tipVisibleFixtureResults.map((item) => item.confidence),
      ),
    [tipVisibleFixtureResults],
  );

  const bankrollRows = useMemo(() => buildBankrollRows(fixtures), [fixtures]);

  const evidenceAuditSummary = useMemo(
    () => summariseEvidenceAudits(visibleFixtures),
    [visibleFixtures],
  );

  const selectedRoundRuleLearning = useMemo(
    () =>
      calculateRuleLearningSummary(
        visibleFixtureResults.map((item) => ({
          prediction: item.prediction,
          accuracy: item.accuracy,
        })),
      ),
    [visibleFixtureResults],
  );

  const selectedRoundProbabilityCalibration = useMemo(() => {
    // The P29 calibration dashboard should follow the current round filter,
    // while the hook-level summary remains the all-fixtures workspace view.
    const items = visibleFixtureResults.map((item) => ({
      fixture: item.fixture,
      probabilities: item.probabilities,
      accuracy: item.accuracy,
    }));
    return summariseProbabilityCalibration(items);
  }, [visibleFixtureResults]);

  const selectedRoundModelTuning = useMemo(
    () =>
      summariseModelTuningRecommendations({
        items: visibleFixtureResults.map((item) => ({
          fixture: item.fixture,
          prediction: item.prediction,
          probabilities: item.probabilities,
          accuracy: item.accuracy,
        })),
        calibration: selectedRoundProbabilityCalibration,
        ruleLearning: selectedRoundRuleLearning,
        ruleWeights,
      }),
    [visibleFixtureResults, selectedRoundProbabilityCalibration, selectedRoundRuleLearning, ruleWeights],
  );

  const selectedRoundTuningSandbox = useMemo(
    () =>
      summariseTuningSandbox({
        fixtures: visibleFixtures,
        baselineWeights: ruleWeights,
        sandboxWeights: sandboxRuleWeights,
      }),
    [visibleFixtures, ruleWeights, sandboxRuleWeights],
  );

  const modelChangeLogSummary = useMemo(() => summariseModelChangeLog(modelChangeLog), [modelChangeLog]);
  const modelVersionComparisonTargets = useMemo(
    () => buildModelVersionComparisonTargets({ changeLog: modelChangeLog, presets: tuningPresets }),
    [modelChangeLog, tuningPresets],
  );
  const selectedModelComparisonTarget = useMemo(
    () => modelVersionComparisonTargets.find((target) => target.id === selectedModelComparisonTargetId) ?? modelVersionComparisonTargets[0],
    [modelVersionComparisonTargets, selectedModelComparisonTargetId],
  );
  const selectedModelVersionComparison = useMemo(
    () => summariseModelVersionComparison({
      fixtures: visibleFixtures,
      currentWeights: ruleWeights,
      comparisonWeights: selectedModelComparisonTarget.weights,
      target: selectedModelComparisonTarget,
    }),
    [visibleFixtures, ruleWeights, selectedModelComparisonTarget],
  );


  const workspaceRestoreResolverSummary = useMemo(() => {
    const currentState = createPersistedState(
      fixtures,
      activeFixtureId,
      selectedRound,
      ruleWeights,
      teamAliases,
      tuningPresets,
      modelChangeLog,
      advancedDataControls,
    );
    const localCandidates = typeof window === "undefined" ? [] : discoverLocalWorkspaceCandidates(window.localStorage);
    return buildWorkspaceRestoreResolverSummary({
      currentState,
      cloudState: cloudPreviewState,
      localCandidates,
      recoverySnapshots,
    });
  }, [fixtures, activeFixtureId, selectedRound, ruleWeights, teamAliases, tuningPresets, modelChangeLog, advancedDataControls, cloudPreviewState, recoverySnapshots]);

  const releaseChecklistSummary = useMemo(
    () => buildReleaseChecklist({
      fixtureCount: fixtures.length,
      competitionCount: competitionNames.length,
      aliasRuleCount: teamAliases.length,
      tuningPresetCount: tuningPresets.length,
      modelChangeLogCount: modelChangeLog.length,
      hasSupabaseConfig: hasSupabaseConfig(),
    }),
    [fixtures.length, competitionNames.length, teamAliases.length, tuningPresets.length, modelChangeLog.length, hasSupabaseConfig],
  );

  const activeEvidenceAudit = useMemo(
    () => auditFixtureEvidence(activeFixture),
    [activeFixture],
  );

  const teamNameIssues = useMemo(() => detectTeamNameIssues(fixtures), [fixtures]);

  function generateAutomatedFixtures(request: FixtureGenerationRequest, mode: "append" | "replace") {
    const generation = generateRoundRobinFixtures(request);
    if (generation.fixtures.length === 0) {
      setAutomationMessage(generation.warnings.join(" ") || "Fixture generation failed: no fixtures created.");
      return;
    }

    const applied = applyFixtureBatch(generation.fixtures, fixtures, mode);
    setFixtures(applied.fixtures);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setAutomationMessage(
      `Generated ${generation.fixtures.length} fixtures for ${generation.teams.length} teams using ${request.format} round-robin ${mode} mode.${generation.warnings.length ? ` Warnings: ${generation.warnings.join(" ")}` : ""}`,
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

      const applied = applyFixtureBatch(result.fixtures, fixtures, mode);
      setFixtures(applied.fixtures);
      setActiveFixtureId(applied.fixtures[0].id);
      setSelectedRound(normaliseRound(applied.fixtures[0].round));
      setLiveFixturesMessage(
        `Fetched ${result.fixtures.length} live fixtures using ${mode} mode.${result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : ""}`,
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
        "Clean old rows from the shared live fixture cache? This only deletes cached live_fixtures rows older than the retention window and does not touch your workspace fixtures. Continue?",
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
    return parts.length ? ` ${parts.join(" ")}` : "";
  }

  function confirmImportApply(mode: FixtureBatchMode, label: string) {
    if (mode === "append" || mode === "update") return true;
    const action = mode === "replace" ? "replace the entire workspace" : "replace only the imported competition scope";
    return window.confirm(`Apply ${label}? This will ${action}. Review the preview details before continuing.`);
  }

  function formatImportModeLabel(mode: FixtureBatchMode) {
    if (mode === "append") return "add/import without replacing";
    if (mode === "update") return "update matching fixtures";
    if (mode === "replaceCompetition") return "replace imported competition only";
    return "replace entire workspace";
  }

  function previewFixturesCsv(csv: string, mode: FixtureBatchMode) {
    const importResult = importFixturesFromCsv(csv);
    if (importResult.fixtures.length === 0) {
      throw new Error(importResult.warnings.join(" ") || "CSV/XLSX import failed: no valid fixtures found.");
    }
    return {
      title: "Prediction-ready import preview",
      mode,
      preview: getFixtureBatchPreview(importResult.fixtures, fixtures, mode),
      warnings: importResult.warnings,
      apply: () => {
        if (!confirmImportApply(mode, "prediction-ready import")) return;
        importFixturesCsv(csv, mode);
      },
    };
  }

  function importFixturesCsv(csv: string, mode: FixtureBatchMode) {
    const importResult = importFixturesFromCsv(csv);
    if (importResult.fixtures.length === 0) {
      setCsvMessage(importResult.warnings.join(" ") || "CSV import failed: no valid fixtures found.");
      return;
    }

    const applied = applyFixtureBatch(importResult.fixtures, fixtures, mode);
    setFixtures(applied.fixtures);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setCsvMessage(
      `Imported ${importResult.fixtures.length} fixtures from CSV/XLSX using ${formatImportModeLabel(mode)} mode.${describeBatchApply(applied)}${
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

  async function exportCustomWorkbookTemplate() {
    const XLSX = await import("xlsx");
    const template = getCustomWorkbookTemplate();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...template.teamsHeaders], ...template.teamsRows]), "Teams");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...template.fixturesHeaders], ...template.fixturesRows]), "Fixtures");
    XLSX.writeFile(workbook, `matchday-custom-competition-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setCustomCompetitionMessage("Exported Teams + Fixtures + Advanced Evidence workbook template.");
  }

  function applyCustomCompetitionImportResult(
    importResult: ReturnType<typeof importCustomCompetitionFromCsv>,
    mode: FixtureBatchMode,
    sourceLabel: string,
  ) {
    if (importResult.fixtures.length === 0) {
      setCustomCompetitionMessage(importResult.warnings.join(" ") || `${sourceLabel} import failed: no valid rows found.`);
      return;
    }

    const applied = applyFixtureBatch(importResult.fixtures, fixtures, mode, importResult.competitions);
    setFixtures(applied.fixtures);
    setActiveFixtureId(applied.fixtures[0].id);
    setSelectedRound(normaliseRound(applied.fixtures[0].round));
    setCustomCompetitionMessage(
      `Imported ${importResult.fixtures.length} custom competition fixture${importResult.fixtures.length === 1 ? "" : "s"} from ${importResult.competitions.join(", ") || sourceLabel} using ${formatImportModeLabel(mode)} mode. ` +
        `Processed ${importResult.finalRows} final result row${importResult.finalRows === 1 ? "" : "s"}, ${importResult.scheduledRows} scheduled row${importResult.scheduledRows === 1 ? "" : "s"}, and ${importResult.teams.length} team${importResult.teams.length === 1 ? "" : "s"}.` +
        describeBatchApply(applied) +
        `${importResult.warnings.length ? ` Warnings: ${importResult.warnings.join(" ")}` : ""}`,
    );
  }

  function applyAliasesToImportResult(importResult: ReturnType<typeof importCustomCompetitionFromCsv>) {
    const aliasResult = applyTeamAliasesToFixtures(importResult.fixtures, teamAliases);
    return {
      ...importResult,
      fixtures: aliasResult.fixtures,
      warnings: [
        ...importResult.warnings,
        ...aliasResult.changes.map((change) => `Team alias applied: ${change}.`),
      ],
      teams: Array.from(new Set(aliasResult.fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]))).sort(),
    };
  }

  function previewRawCompetition(csv: string, mode: FixtureBatchMode) {
    const importResult = applyAliasesToImportResult(importCustomCompetitionFromCsv(csv));
    if (importResult.fixtures.length === 0) {
      throw new Error(importResult.warnings.join(" ") || "Raw custom competition import failed: no valid rows found.");
    }
    return {
      title: "Custom raw competition import preview",
      mode,
      preview: getFixtureBatchPreview(importResult.fixtures, fixtures, mode, importResult.competitions),
      warnings: importResult.warnings,
      apply: () => {
        if (!confirmImportApply(mode, "custom competition import")) return;
        importRawCompetition(csv, mode);
      },
    };
  }

  function previewTeamsFixturesWorkbook(teamsCsv: string, fixturesCsv: string, mode: FixtureBatchMode) {
    const importResult = applyAliasesToImportResult(importCustomCompetitionFromWorkbookSheets(teamsCsv, fixturesCsv));
    if (importResult.fixtures.length === 0) {
      throw new Error(importResult.warnings.join(" ") || "Teams + Fixtures workbook import failed: no valid fixtures found.");
    }
    return {
      title: "Teams + Fixtures workbook import preview",
      mode,
      preview: getFixtureBatchPreview(importResult.fixtures, fixtures, mode, importResult.competitions),
      warnings: importResult.warnings,
      apply: () => {
        if (!confirmImportApply(mode, "Teams + Fixtures workbook import")) return;
        importTeamsFixturesWorkbook(teamsCsv, fixturesCsv, mode);
      },
    };
  }

  function importRawCompetition(csv: string, mode: FixtureBatchMode) {
    applyCustomCompetitionImportResult(applyAliasesToImportResult(importCustomCompetitionFromCsv(csv)), mode, "raw file");
  }

  function importTeamsFixturesWorkbook(teamsCsv: string, fixturesCsv: string, mode: FixtureBatchMode) {
    applyCustomCompetitionImportResult(
      applyAliasesToImportResult(importCustomCompetitionFromWorkbookSheets(teamsCsv, fixturesCsv)),
      mode,
      "Teams + Fixtures workbook",
    );
  }

  function addTeamAliasRule(rule: Omit<TeamAliasRule, "id">) {
    const alias = rule.alias.trim();
    const canonical = rule.canonical.trim();
    if (!alias || !canonical) return;
    setTeamAliases((current) => [
      ...current,
      {
        id: `alias-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        alias,
        canonical,
        competition: rule.competition?.trim() || undefined,
      },
    ]);
  }

  function removeTeamAliasRule(id: string) {
    setTeamAliases((current) => current.filter((rule) => rule.id !== id));
  }

  function resetTeamAliasRules() {
    setTeamAliases(cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
  }

  function applyAliasesToWorkspaceFixtures() {
    const aliasResult = applyTeamAliasesToFixtures(fixtures, teamAliases);
    setFixtures(aliasResult.fixtures);
    setCustomCompetitionMessage(
      aliasResult.changes.length
        ? `Applied ${aliasResult.changes.length} team alias change${aliasResult.changes.length === 1 ? "" : "s"} to workspace fixtures: ${aliasResult.changes.join("; ")}.`
        : "No workspace fixture names needed alias changes.",
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

  function updateTipCompetitionView(competition: string) {
    setSelectedCompetitionView(competition);
    setSelectedRound(ALL_ROUNDS);
    const nextVisible = visibleFixtureResults.filter((item) => !competition || item.fixture.competition === competition);
    if (nextVisible.length > 0 && !nextVisible.some((item) => item.fixture.id === activeFixtureId)) {
      setActiveFixtureId(nextVisible[0].fixture.id);
    }
  }

  function updateFixtureBetLog(betLog: FixtureBetLog | undefined) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === activeFixture.id
          ? { ...fixture, betLog: betLog ? { ...betLog } : undefined }
          : fixture,
      ),
    );
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
    const entry = createModelChangeLogEntry({
      reason: "live-reset",
      label: "Reset live weights to defaults",
      note: "P33 audit entry created from the Rule Weight Tuning reset action.",
      beforeWeights: ruleWeights,
      afterWeights: defaultRuleWeights,
    });
    setRuleWeights({ ...defaultRuleWeights });
    setModelChangeLog((current) => appendModelChangeLogEntry(current, entry));
  }

  function updateSandboxRuleWeight(key: keyof RuleWeights, value: number) {
    setSandboxRuleWeights((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function copyLiveWeightsToSandbox() {
    setSandboxRuleWeights({ ...ruleWeights });
  }

  function resetSandboxRuleWeights() {
    setSandboxRuleWeights({ ...defaultRuleWeights });
  }

  function saveSandboxAsPreset() {
    const preset = createTuningPreset({
      name: newPresetName,
      description: newPresetDescription,
      weights: sandboxRuleWeights,
      existingPresets: tuningPresets,
    });
    setTuningPresets((current) => [...current, preset]);
    setNewPresetName(`${preset.name} copy`);
  }

  function loadPresetIntoSandbox(presetId: string) {
    const preset = tuningPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setSandboxRuleWeights({ ...defaultRuleWeights, ...preset.weights });
  }

  function overwritePresetFromSandbox(presetId: string) {
    setTuningPresets((current) =>
      updateTuningPreset({
        presets: current,
        presetId,
        weights: sandboxRuleWeights,
      }),
    );
  }

  function removeTuningPreset(presetId: string) {
    const preset = tuningPresets.find((item) => item.id === presetId);
    if (!preset) return;
    if (!window.confirm(`Delete tuning preset "${preset.name}"? This will not change live weights or sandbox weights.`)) return;
    setTuningPresets((current) => deleteTuningPreset(current, presetId));
  }

  function applySandboxWeightsToLive() {
    if (!window.confirm("Apply current sandbox weights to the live model? This changes Quick Prediction, analytics, and future autosaved workspace state.")) return;
    const entry = createModelChangeLogEntry({
      reason: "sandbox-apply",
      label: "Applied sandbox weights to live model",
      note: `${selectedRoundLabel} sandbox comparison: ${selectedRoundTuningSandbox.predictionChanges} prediction change(s), ${selectedRoundTuningSandbox.hitRateDelta > 0 ? "+" : ""}${selectedRoundTuningSandbox.hitRateDelta}% hit-rate delta.`,
      beforeWeights: ruleWeights,
      afterWeights: sandboxRuleWeights,
    });
    setRuleWeights({ ...sandboxRuleWeights });
    setModelChangeLog((current) => appendModelChangeLogEntry(current, entry));
  }

  function addManualModelChangeSnapshot() {
    const entry = createModelChangeLogEntry({
      reason: "manual-snapshot",
      label: "Manual live-weight snapshot",
      note: "Snapshot recorded without changing the live model.",
      beforeWeights: ruleWeights,
      afterWeights: ruleWeights,
    });
    setModelChangeLog((current) => appendModelChangeLogEntry(current, entry));
  }

  function clearModelChangeLog() {
    if (!window.confirm("Clear the model change log? This does not change live weights, presets, or fixtures.")) return;
    setModelChangeLog([]);
  }

  function exportTuningPresets() {
    const blob = new Blob([JSON.stringify(cloneTuningPresets(tuningPresets), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matchday-tuning-presets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function addBlankFixture() {
    const nextFixture = createBlankFixture(selectedRound === ALL_ROUNDS ? "Round 1" : selectedRound, activeFixture?.competition ?? (selectedCompetitionView || "New Competition"));
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

  // Gate the entire app behind sign-in. Only skip this when Supabase isn't
  // configured at all — otherwise nobody, including the owner, would ever
  // be able to authenticate and the app would be permanently locked out.
  if (supabase && !isAdmin) {
    return (
      <AuthGatePanel
        session={session}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        authMessage={authMessage}
        isAuthBusy={isAuthBusy}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onSignIn={signInWithPassword}
        onSignOut={signOutOfSupabase}
      />
    );
  }

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="eyebrow">Tipping Gates App · P47.4</div>
          <h1>Evidence-based tipping gates with cleaner day-to-day tipping flow.</h1>
          <p className="lead">
            P47.4 filters Tip Now by competition, adds fixture bet logging, introduces My Bankroll, and keeps round controls scoped to Tip Now.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {session && (
            <span className="section-help" style={{ margin: 0 }}>
              Signed in as {activeUserEmail}. <button className="link-button" onClick={signOutOfSupabase}>Sign out</button>
            </span>
          )}
          <button className="primary" onClick={addBlankFixture}>Add Fixture</button>
        </div>
      </section>

      {!supabase && (
        <section className="warning-box" style={{ marginBottom: 18 }}>
          Supabase is not configured, so this app currently has no sign-in gate — anyone with this
          URL has full access, including tennis predictions that consume your metered API quota.
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel to require sign-in.
        </section>
      )}

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
        <button className={activeTab === "bankroll" ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab("bankroll")}>
          My Bankroll
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
          visibleFixtureResults={displayedFixtureResults}
          onSelectFixture={setActiveFixtureId}
        />

        <div>
          {activeTab === "tip" && (
            <>
              <QuickPredictionPanel
                fixtures={fixtures}
                filteredFixtureCount={tipVisibleFixtureResults.length}
                selectedCompetition={selectedCompetitionView}
                activeFixture={activeFixture}
                result={result}
                onCompetitionChange={updateTipCompetitionView}
              />
              <RoundManagement
                selectedRound={selectedRound}
                selectedRoundLabel={selectedRoundLabel}
                roundNames={roundNames}
                visibleFixtureCount={tipVisibleFixtureResults.length}
                selectedRoundAccuracySummary={tipNowAccuracySummary}
                onAddRound={addRound}
                onSelectRound={updateSelectedRound}
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
                probabilities={probabilities}
                accuracy={accuracy}
                evidenceAudit={activeEvidenceAudit}
              />
              <FixtureDetailsPanel fixture={activeFixture} onUpdateField={updateFixtureField} />
              <BetLoggingPanel fixture={activeFixture} onUpdateBetLog={updateFixtureBetLog} />
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
                probabilities={probabilities}
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
              <WorkspaceRecoveryVaultPanel
                message={recoveryVaultMessage}
                snapshots={recoverySnapshots}
                summary={recoveryVaultSummary}
                onCreateSnapshot={createManualRecoverySnapshot}
                onRestoreSnapshot={restoreRecoverySnapshot}
                onDeleteSnapshot={deleteRecoverySnapshot}
                onExportVault={exportRecoveryVault}
                onClearVault={clearRecoveryVault}
              />
              <WorkspaceRestoreResolverPanel
                summary={workspaceRestoreResolverSummary}
                cloudPreviewMessage={cloudPreviewMessage}
                isCloudBusy={isCloudBusy}
                onRefreshCloudPreview={refreshCloudPreview}
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
              <TeamAliasManagerPanel
                aliases={teamAliases}
                detectedIssues={teamNameIssues}
                onAddAlias={addTeamAliasRule}
                onRemoveAlias={removeTeamAliasRule}
                onResetDefaults={resetTeamAliasRules}
                onApplyToWorkspace={applyAliasesToWorkspaceFixtures}
              />
              <CustomCompetitionImportPanel
                message={customCompetitionMessage}
                onExportTemplate={exportRawCompetitionTemplate}
                onExportWorkbookTemplate={exportCustomWorkbookTemplate}
                onPreviewRawCompetition={previewRawCompetition}
                onImportRawCompetition={importRawCompetition}
                onPreviewTeamsFixturesWorkbook={previewTeamsFixturesWorkbook}
                onImportTeamsFixturesWorkbook={importTeamsFixturesWorkbook}
              />
              <FixtureCsvPanel
                csvMessage={csvMessage}
                onExportCsv={exportFixturesCsv}
                onPreviewCsv={previewFixturesCsv}
                onImportCsv={importFixturesCsv}
              />
              <CloudSyncPanel
                authMessage={authMessage}
                activeUserEmail={activeUserEmail}
                cloudWorkspaceId={cloudWorkspaceId}
                cloudMessage={cloudMessage}
                cloudMirrorStatus={cloudMirrorStatus}
                isCloudBusy={isCloudBusy || isAuthBusy || !hasSupabaseConfig}
                isSignedIn={Boolean(session)}
                lastCloudSavedAt={lastCloudSavedAt}
                onCloudWorkspaceIdChange={setCloudWorkspaceId}
                onSaveCloud={saveWorkspaceToCloud}
                onLoadCloud={loadWorkspaceFromCloud}
                onNewCloudId={createNewCloudWorkspaceId}
              />
            </>
          )}

          {activeTab === "analytics" && (
            <>
              <ReleaseChecklistPanel summary={releaseChecklistSummary} />
              <CompetitionInsightsPanel insights={competitionInsights} />
              <CompetitionDataQualityPanel summary={competitionDataQuality} />
              <AccuracyDashboard
                accuracySummary={accuracySummary}
                selectedRoundAccuracySummary={selectedRoundAccuracySummary}
                selectedRoundLabel={selectedRoundLabel}
              />
              <EvidenceReadinessPanel
                summary={evidenceAuditSummary}
                selectedRoundLabel={selectedRoundLabel}
              />
              <AdvancedEvidencePanel summary={advancedEvidenceSummary} />
              <AdvancedEvidenceImpactPanel summary={advancedEvidenceImpactSummary} />
              <AdvancedDataGatePanel summary={advancedDataGateSummary} />
              <AdvancedDataWeightControlsPanel
                summary={advancedDataIntegrationSummary}
                controls={advancedDataControls}
                onChange={setAdvancedDataControls}
              />
              <AdvancedDataWeightSandboxPanel summary={advancedDataWeightSandboxSummary} />
              <AdvancedDataCalibrationPanel summary={advancedDataCalibrationSummary} />
              <ProbabilityCalibrationPanel
                summary={selectedRoundProbabilityCalibration}
                selectedRoundLabel={selectedRoundLabel}
              />
              <ModelTuningRecommendationsPanel
                summary={selectedRoundModelTuning}
                selectedRoundLabel={selectedRoundLabel}
              />
              <TuningSandboxPanel
                summary={selectedRoundTuningSandbox}
                selectedRoundLabel={selectedRoundLabel}
                ruleWeights={ruleWeights}
                sandboxWeights={sandboxRuleWeights}
                onUpdateSandboxWeight={updateSandboxRuleWeight}
                onCopyLiveWeights={copyLiveWeightsToSandbox}
                onResetSandboxWeights={resetSandboxRuleWeights}
                onApplySandboxWeightsToLive={applySandboxWeightsToLive}
                presets={tuningPresets}
                newPresetName={newPresetName}
                newPresetDescription={newPresetDescription}
                onNewPresetNameChange={setNewPresetName}
                onNewPresetDescriptionChange={setNewPresetDescription}
                onSaveSandboxAsPreset={saveSandboxAsPreset}
                onLoadPresetIntoSandbox={loadPresetIntoSandbox}
                onOverwritePresetFromSandbox={overwritePresetFromSandbox}
                onDeletePreset={removeTuningPreset}
                onExportPresets={exportTuningPresets}
                changeLogSummary={modelChangeLogSummary}
                onAddManualSnapshot={addManualModelChangeSnapshot}
                onClearChangeLog={clearModelChangeLog}
              />
              <ModelVersionComparisonPanel
                summary={selectedModelVersionComparison}
                targets={modelVersionComparisonTargets}
                selectedTargetId={selectedModelComparisonTarget.id}
                selectedRoundLabel={selectedRoundLabel}
                onSelectedTargetChange={setSelectedModelComparisonTargetId}
              />
              <RuleLearningPanel ruleLearning={selectedRoundRuleLearning} />
              <RuleWeightTuningPanel
                ruleWeights={ruleWeights}
                quality={quality}
                conflict={conflict}
                onUpdateWeight={updateRuleWeight}
                onResetWeights={resetRuleWeights}
              />
            </>
          )}

          {activeTab === "bankroll" && <BankrollPanel rows={bankrollRows} />}

          {activeTab === "tennis" && <TennisQuickPredictionPanel session={session} />}
        </div>
      </section>
    </main>
  );
}
