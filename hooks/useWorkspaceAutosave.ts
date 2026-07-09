"use client";

import { ChangeEvent, Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  Entrant,
  Fixture,
  UserTip,
  entrants as initialEntrants,
  fixtures as initialFixtures,
  userTips as initialUserTips,
} from "../lib/sampleData";
import { RuleWeights, defaultRuleWeights } from "../lib/scoringEngine";
import { DEFAULT_TEAM_ALIAS_RULES, TeamAliasRule, cloneTeamAliases, isTeamAliasRuleArray } from "../lib/teamAliases";
import { TuningPreset, cloneTuningPresets, isTuningPresetArray } from "../lib/tuningPresets";
import { ModelChangeLogEntry, cloneModelChangeLog, isModelChangeLogArray } from "../lib/modelChangeLog";
import { cloneAdvancedDataWeightControls, defaultAdvancedDataWeightControls, type AdvancedDataWeightControls } from "../lib/advancedDataWeightControls";
import {
  ALL_ROUNDS,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  cloneEntrants,
  cloneFixtures,
  cloneUserTips,
  createPersistedState,
  discoverLocalWorkspaceCandidates,
  selectBestLocalWorkspaceCandidate,
  isPersistedAppState,
  normaliseRound,
  type PersistedAppState,
} from "../lib/workspace";

import {
  WORKSPACE_BACKUP_VAULT_KEY,
  addWorkspaceRecoverySnapshot,
  createWorkspaceRecoverySnapshot,
  parseWorkspaceRecoveryVault,
  shouldCreateAutomaticWorkspaceSnapshot,
  summariseWorkspaceRecoveryVault,
  type WorkspaceRecoverySnapshot,
  type WorkspaceRecoveryVaultSummary,
} from "../lib/workspaceBackupVault";

type WorkspaceAutosaveArgs = {
  fixtures: Fixture[];
  activeFixtureId: string;
  selectedRound: string;
  ruleWeights: RuleWeights;
  entrants: Entrant[];
  userTips: UserTip[];
  teamAliases: TeamAliasRule[];
  tuningPresets: TuningPreset[];
  modelChangeLog: ModelChangeLogEntry[];
  advancedDataControls: AdvancedDataWeightControls;
  setFixtures: Dispatch<SetStateAction<Fixture[]>>;
  setActiveFixtureId: Dispatch<SetStateAction<string>>;
  setSelectedRound: Dispatch<SetStateAction<string>>;
  setRuleWeights: Dispatch<SetStateAction<RuleWeights>>;
  setEntrants: Dispatch<SetStateAction<Entrant[]>>;
  setUserTips: Dispatch<SetStateAction<UserTip[]>>;
  setTeamAliases: Dispatch<SetStateAction<TeamAliasRule[]>>;
  setTuningPresets: Dispatch<SetStateAction<TuningPreset[]>>;
  setModelChangeLog: Dispatch<SetStateAction<ModelChangeLogEntry[]>>;
  setAdvancedDataControls: Dispatch<SetStateAction<AdvancedDataWeightControls>>;
};

export function useWorkspaceAutosave({
  fixtures,
  activeFixtureId,
  selectedRound,
  ruleWeights,
  entrants,
  userTips,
  teamAliases,
  tuningPresets,
  modelChangeLog,
  advancedDataControls,
  setFixtures,
  setActiveFixtureId,
  setSelectedRound,
  setRuleWeights,
  setEntrants,
  setUserTips,
  setTeamAliases,
  setTuningPresets,
  setModelChangeLog,
  setAdvancedDataControls,
}: WorkspaceAutosaveArgs) {
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState("Loading saved workspace...");
  const [recoverySnapshots, setRecoverySnapshots] = useState<WorkspaceRecoverySnapshot[]>([]);
  const [recoveryVaultMessage, setRecoveryVaultMessage] = useState("Recovery vault has not loaded yet.");


  function getCurrentPersistedState(): PersistedAppState {
    return createPersistedState(
      fixtures,
      activeFixtureId,
      selectedRound,
      ruleWeights,
      entrants,
      userTips,
      teamAliases,
      tuningPresets,
      modelChangeLog,
      advancedDataControls,
    );
  }

  function saveRecoverySnapshots(nextSnapshots: WorkspaceRecoverySnapshot[], message?: string) {
    const pruned = nextSnapshots;
    window.localStorage.setItem(WORKSPACE_BACKUP_VAULT_KEY, JSON.stringify(pruned));
    setRecoverySnapshots(pruned);
    if (message) setRecoveryVaultMessage(message);
  }

  function applyPersistedState(parsedState: PersistedAppState, sourceLabel: string) {
    const nextFixtures = cloneFixtures(parsedState.fixtures);
    setFixtures(nextFixtures);
    setActiveFixtureId(
      nextFixtures.some((fixture) => fixture.id === parsedState.activeFixtureId)
        ? parsedState.activeFixtureId
        : nextFixtures[0]?.id ?? "",
    );
    const restoredRound = parsedState.selectedRound ?? ALL_ROUNDS;
    setSelectedRound(
      restoredRound === ALL_ROUNDS ||
        nextFixtures.some((fixture) => normaliseRound(fixture.round) === restoredRound)
        ? restoredRound
        : ALL_ROUNDS,
    );
    setRuleWeights({ ...defaultRuleWeights, ...parsedState.ruleWeights });
    setEntrants(parsedState.entrants ? cloneEntrants(parsedState.entrants) : cloneEntrants(initialEntrants));
    setUserTips(parsedState.userTips ? cloneUserTips(parsedState.userTips) : cloneUserTips(initialUserTips));
    setTeamAliases(isTeamAliasRuleArray(parsedState.teamAliases) ? cloneTeamAliases(parsedState.teamAliases) : cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
    setTuningPresets(isTuningPresetArray(parsedState.tuningPresets) ? cloneTuningPresets(parsedState.tuningPresets) : []);
    setModelChangeLog(isModelChangeLogArray(parsedState.modelChangeLog) ? cloneModelChangeLog(parsedState.modelChangeLog) : []);
    setAdvancedDataControls(parsedState.advancedDataControls ? cloneAdvancedDataWeightControls(parsedState.advancedDataControls) : { ...defaultAdvancedDataWeightControls });
    if (Array.isArray(parsedState.recoverySnapshots)) {
      saveRecoverySnapshots(parsedState.recoverySnapshots);
    }
    setLastSavedAt(parsedState.savedAt);
    setStorageMessage(sourceLabel);
  }

  useEffect(() => {
    const loadedSnapshots = parseWorkspaceRecoveryVault(window.localStorage.getItem(WORKSPACE_BACKUP_VAULT_KEY));
    setRecoverySnapshots(loadedSnapshots);
    setRecoveryVaultMessage(loadedSnapshots.length ? `Loaded ${loadedSnapshots.length} recovery snapshot${loadedSnapshots.length === 1 ? "" : "s"}.` : "No recovery snapshots found yet.");
    try {
      const bestCandidate = selectBestLocalWorkspaceCandidate(discoverLocalWorkspaceCandidates(window.localStorage));

      if (!bestCandidate) {
        setStorageMessage("No saved workspace found. Using sample data.");
        return;
      }

      applyPersistedState(bestCandidate.state, `Saved workspace restored from ${bestCandidate.key}.`);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bestCandidate.state));
    } catch {
      setStorageMessage("Saved workspace could not be restored. Using sample data.");
    } finally {
      setHasLoadedSavedState(true);
    }
  }, [setActiveFixtureId, setEntrants, setFixtures, setRuleWeights, setSelectedRound, setUserTips, setTeamAliases, setTuningPresets, setModelChangeLog, setAdvancedDataControls]);

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    try {
      const nextState = createPersistedState(
        fixtures,
        activeFixtureId,
        selectedRound,
        ruleWeights,
        entrants,
        userTips,
        teamAliases,
        tuningPresets,
        modelChangeLog,
        advancedDataControls,
      );
      if (shouldCreateAutomaticWorkspaceSnapshot(recoverySnapshots, nextState)) {
        const nextSnapshots = addWorkspaceRecoverySnapshot(
          recoverySnapshots,
          createWorkspaceRecoverySnapshot(nextState, "Automatic workspace recovery point", "automatic"),
        );
        saveRecoverySnapshots(nextSnapshots, "Automatic recovery snapshot saved.");
      }
      // The top-level state written to the main storage key carries the
      // live vault along with it (so it also gets mirrored to Supabase from
      // here — see useWorkspaceCloudSync). nextState above deliberately does
      // NOT carry it, so a snapshot never embeds a nested copy of the vault
      // it's itself a member of.
      const stateForStorage: typeof nextState = { ...nextState, recoverySnapshots };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage));
      setLastSavedAt(nextState.savedAt);
      setStorageMessage("Workspace autosaved in this browser.");
    } catch {
      setStorageMessage("Autosave failed. Export a backup before refreshing.");
    }
  }, [fixtures, activeFixtureId, selectedRound, ruleWeights, entrants, userTips, teamAliases, tuningPresets, modelChangeLog, advancedDataControls, hasLoadedSavedState, recoverySnapshots]);

  function resetWorkspaceToSamples() {
    try {
      const snapshot = createWorkspaceRecoverySnapshot(getCurrentPersistedState(), "Before reset to sample data", "pre-reset");
      saveRecoverySnapshots(addWorkspaceRecoverySnapshot(recoverySnapshots, snapshot), "Recovery snapshot saved before reset.");
    } catch {
      setRecoveryVaultMessage("Could not save recovery snapshot before reset.");
    }
    const nextFixtures = cloneFixtures(initialFixtures);
    setFixtures(nextFixtures);
    setActiveFixtureId(nextFixtures[0]?.id ?? "");
    setSelectedRound(ALL_ROUNDS);
    setRuleWeights({ ...defaultRuleWeights });
    setEntrants(cloneEntrants(initialEntrants));
    setUserTips(cloneUserTips(initialUserTips));
    setTeamAliases(cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
    setTuningPresets([]);
    setModelChangeLog([]);
    setAdvancedDataControls({ ...defaultAdvancedDataWeightControls });
    window.localStorage.removeItem(STORAGE_KEY);
    setStorageMessage("Workspace reset to sample data.");
  }

  function exportWorkspaceBackup() {
    const baseState = createPersistedState(fixtures, activeFixtureId, selectedRound, ruleWeights, entrants, userTips, teamAliases, tuningPresets, modelChangeLog, advancedDataControls);
    const state: typeof baseState = { ...baseState, recoverySnapshots };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matchday-backup-${state.savedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStorageMessage("Workspace backup exported.");
  }

  async function importWorkspaceBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsedState: unknown = JSON.parse(text);
      if (!isPersistedAppState(parsedState)) {
        setStorageMessage("Backup file is not a valid MatchDay workspace.");
        return;
      }

      const snapshot = createWorkspaceRecoverySnapshot(getCurrentPersistedState(), "Before JSON backup import", "pre-import");
      saveRecoverySnapshots(addWorkspaceRecoverySnapshot(recoverySnapshots, snapshot), "Recovery snapshot saved before backup import.");
      applyPersistedState(parsedState, "Workspace backup imported and autosaved.");
    } catch {
      setStorageMessage("Backup import failed. Check that the file is valid JSON.");
    }
  }


  function createManualRecoverySnapshot() {
    try {
      const snapshot = createWorkspaceRecoverySnapshot(getCurrentPersistedState(), "Manual recovery snapshot", "manual");
      saveRecoverySnapshots(addWorkspaceRecoverySnapshot(recoverySnapshots, snapshot), "Manual recovery snapshot saved.");
    } catch {
      setRecoveryVaultMessage("Manual recovery snapshot failed.");
    }
  }

  function restoreRecoverySnapshot(snapshotId: string) {
    const snapshot = recoverySnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      setRecoveryVaultMessage("Recovery snapshot not found.");
      return;
    }
    const beforeRestore = createWorkspaceRecoverySnapshot(getCurrentPersistedState(), "Before recovery snapshot restore", "pre-import");
    saveRecoverySnapshots(addWorkspaceRecoverySnapshot(recoverySnapshots, beforeRestore), "Recovery snapshot saved before restore.");
    applyPersistedState(snapshot.state, `Recovery snapshot restored: ${snapshot.label}.`);
  }

  function deleteRecoverySnapshot(snapshotId: string) {
    const nextSnapshots = recoverySnapshots.filter((snapshot) => snapshot.id !== snapshotId);
    saveRecoverySnapshots(nextSnapshots, "Recovery snapshot deleted.");
  }

  function exportRecoveryVault() {
    const blob = new Blob([JSON.stringify(recoverySnapshots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matchday-recovery-vault-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setRecoveryVaultMessage("Recovery vault exported.");
  }

  function clearRecoveryVault() {
    if (!window.confirm("Clear every local recovery snapshot? This does not delete the active workspace or Supabase copy.")) return;
    window.localStorage.removeItem(WORKSPACE_BACKUP_VAULT_KEY);
    setRecoverySnapshots([]);
    setRecoveryVaultMessage("Recovery vault cleared.");
  }

  function adoptRecoverySnapshots(snapshots: WorkspaceRecoverySnapshot[]) {
    saveRecoverySnapshots(snapshots, "Recovery vault restored from cloud.");
  }

  const recoveryVaultSummary: WorkspaceRecoveryVaultSummary = summariseWorkspaceRecoveryVault(recoverySnapshots);

  return {
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
    setStorageMessage,
    storageMessage,
  };
}
