"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { Fixture } from "../lib/sampleData";
import { RuleWeights, defaultRuleWeights } from "../lib/scoringEngine";
import { DEFAULT_TEAM_ALIAS_RULES, TeamAliasRule, cloneTeamAliases, isTeamAliasRuleArray } from "../lib/teamAliases";
import { TuningPreset, cloneTuningPresets, isTuningPresetArray } from "../lib/tuningPresets";
import { ModelChangeLogEntry, cloneModelChangeLog, isModelChangeLogArray } from "../lib/modelChangeLog";
import { cloneAdvancedDataWeightControls, defaultAdvancedDataWeightControls, type AdvancedDataWeightControls } from "../lib/advancedDataWeightControls";
import {
  ALL_ROUNDS,
  CLOUD_WORKSPACE_ID_KEY,
  LEGACY_CLOUD_WORKSPACE_ID_KEYS,
  cloneFixtures,
  createPersistedState,
  discoverLocalWorkspaceCandidates,
  isPersistedAppState,
  normaliseRound,
  selectBestLocalWorkspaceCandidate,
} from "../lib/workspace";
import {
  describeWorkspaceMetrics,
  getWorkspacePreservationMetrics,
  shouldBlockWeakerWorkspaceOverwrite,
} from "../lib/workspacePreservation";
import type { WorkspaceRecoverySnapshot } from "../lib/workspaceBackupVault";

type WorkspaceCloudSyncArgs = {
  supabase: SupabaseClient | null;
  session: Session | null;
  activeUserEmail: string;
  hasLoadedSavedState: boolean;
  fixtures: Fixture[];
  activeFixtureId: string;
  selectedRound: string;
  ruleWeights: RuleWeights;
  teamAliases: TeamAliasRule[];
  tuningPresets: TuningPreset[];
  modelChangeLog: ModelChangeLogEntry[];
  advancedDataControls: AdvancedDataWeightControls;
  // Mirrored to Supabase so the recovery vault survives losing the device
  // it was created on — see the top-level comment on PersistedAppState in
  // lib/workspace.ts for why this must never be embedded inside a snapshot.
  recoverySnapshots: WorkspaceRecoverySnapshot[];
  onAdoptRecoverySnapshots: (snapshots: WorkspaceRecoverySnapshot[]) => void;
  setFixtures: Dispatch<SetStateAction<Fixture[]>>;
  setActiveFixtureId: Dispatch<SetStateAction<string>>;
  setSelectedRound: Dispatch<SetStateAction<string>>;
  setRuleWeights: Dispatch<SetStateAction<RuleWeights>>;
  setTeamAliases: Dispatch<SetStateAction<TeamAliasRule[]>>;
  setTuningPresets: Dispatch<SetStateAction<TuningPreset[]>>;
  setModelChangeLog: Dispatch<SetStateAction<ModelChangeLogEntry[]>>;
  setAdvancedDataControls: Dispatch<SetStateAction<AdvancedDataWeightControls>>;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
};

type CloudWorkspaceRow = { payload: unknown; updated_at: string | null } | null;

function hasSupabaseTableConfig(supabase: SupabaseClient | null) {
  return Boolean(supabase);
}

export function useWorkspaceCloudSync({
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
  onAdoptRecoverySnapshots,
  setFixtures,
  setActiveFixtureId,
  setSelectedRound,
  setRuleWeights,
  setTeamAliases,
  setTuningPresets,
  setModelChangeLog,
  setAdvancedDataControls,
  setLastSavedAt,
}: WorkspaceCloudSyncArgs) {
  const [cloudWorkspaceId, setCloudWorkspaceId] = useState("");
  const [cloudMessage, setCloudMessage] = useState(
    "Sign in with Supabase Auth to mirror the full workspace to cloud and local storage.",
  );
  const [cloudMirrorStatus, setCloudMirrorStatus] = useState("Cloud mirror waiting for sign-in/configuration.");
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<string | null>(null);
  const [cloudPreviewState, setCloudPreviewState] = useState<ReturnType<typeof createPersistedState> | null>(null);
  const [cloudPreviewMessage, setCloudPreviewMessage] = useState("Cloud preview has not been refreshed yet.");
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const lastAutoSavedSignatureRef = useRef("");

  const currentWorkspaceState = useMemo(
    () => createPersistedState(fixtures, activeFixtureId, selectedRound, ruleWeights, teamAliases, tuningPresets, modelChangeLog, advancedDataControls, recoverySnapshots),
    [fixtures, activeFixtureId, selectedRound, ruleWeights, teamAliases, tuningPresets, modelChangeLog, advancedDataControls, recoverySnapshots],
  );

  function applyWorkspaceState(nextState: typeof currentWorkspaceState, sourceLabel: string) {
    const nextFixtures = cloneFixtures(nextState.fixtures);
    setFixtures(nextFixtures);
    setActiveFixtureId(
      nextFixtures.some((fixture) => fixture.id === nextState.activeFixtureId)
        ? nextState.activeFixtureId
        : nextFixtures[0]?.id ?? "",
    );
    const nextRound = nextState.selectedRound ?? ALL_ROUNDS;
    setSelectedRound(
      nextRound === ALL_ROUNDS || nextFixtures.some((fixture) => normaliseRound(fixture.round) === nextRound)
        ? nextRound
        : ALL_ROUNDS,
    );
    setRuleWeights({ ...defaultRuleWeights, ...nextState.ruleWeights });
    setTeamAliases(isTeamAliasRuleArray(nextState.teamAliases) ? cloneTeamAliases(nextState.teamAliases) : cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
    setTuningPresets(isTuningPresetArray(nextState.tuningPresets) ? cloneTuningPresets(nextState.tuningPresets) : []);
    setModelChangeLog(isModelChangeLogArray(nextState.modelChangeLog) ? cloneModelChangeLog(nextState.modelChangeLog) : []);
    setAdvancedDataControls(nextState.advancedDataControls ? cloneAdvancedDataWeightControls(nextState.advancedDataControls) : { ...defaultAdvancedDataWeightControls });
    if (Array.isArray(nextState.recoverySnapshots)) {
      onAdoptRecoverySnapshots(nextState.recoverySnapshots);
    }
    setLastSavedAt(nextState.savedAt);
    setCloudMessage(`${sourceLabel} restored: ${describeWorkspaceMetrics(getWorkspacePreservationMetrics(nextState))}.`);
  }

  useEffect(() => {
    const existingWorkspaceId =
      window.localStorage.getItem(CLOUD_WORKSPACE_ID_KEY) ??
      LEGACY_CLOUD_WORKSPACE_ID_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);

    if (existingWorkspaceId) {
      window.localStorage.setItem(CLOUD_WORKSPACE_ID_KEY, existingWorkspaceId);
      setCloudWorkspaceId(existingWorkspaceId);
      return;
    }

    const nextWorkspaceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `workspace-${Date.now()}`;
    window.localStorage.setItem(CLOUD_WORKSPACE_ID_KEY, nextWorkspaceId);
    setCloudWorkspaceId(nextWorkspaceId);
  }, []);

  useEffect(() => {
    if (cloudWorkspaceId) {
      window.localStorage.setItem(CLOUD_WORKSPACE_ID_KEY, cloudWorkspaceId.trim());
    }
  }, [cloudWorkspaceId]);

  function hasSupabaseConfig() {
    return hasSupabaseTableConfig(supabase);
  }

  function createNewCloudWorkspaceId() {
    const nextWorkspaceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `workspace-${Date.now()}`;
    setCloudWorkspaceId(nextWorkspaceId);
    setCloudMessage("New cloud workspace ID created. Save to your signed-in account when ready.");
  }

  async function fetchCloudWorkspace(workspaceId: string): Promise<CloudWorkspaceRow> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("matchday_workspaces")
      .select("payload, updated_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data as CloudWorkspaceRow;
  }

  async function upsertCloudWorkspace(workspaceId: string, allowWeakerOverwrite: boolean, sourceLabel: string) {
    if (!supabase || !session?.user.id) return false;

    const existingRow = await fetchCloudWorkspace(workspaceId);
    const existingState = isPersistedAppState(existingRow?.payload) ? existingRow.payload : null;

    if (existingState && !allowWeakerOverwrite && shouldBlockWeakerWorkspaceOverwrite(currentWorkspaceState, existingState)) {
      const localDescription = describeWorkspaceMetrics(getWorkspacePreservationMetrics(currentWorkspaceState));
      const cloudDescription = describeWorkspaceMetrics(getWorkspacePreservationMetrics(existingState));
      setCloudMirrorStatus(`Cloud mirror paused: local workspace looks weaker (${localDescription}) than cloud (${cloudDescription}). Load from Supabase or manually confirm save.`);
      return false;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("matchday_workspaces").upsert(
      {
        workspace_id: workspaceId,
        owner_user_id: session.user.id,
        payload: currentWorkspaceState,
        updated_at: now,
      },
      { onConflict: "workspace_id" },
    );

    if (error) throw error;
    setLastSavedAt(currentWorkspaceState.savedAt);
    setLastCloudSavedAt(now);
    setCloudMirrorStatus(`${sourceLabel} mirrored to Supabase at ${new Date(now).toLocaleString()}.`);
    return true;
  }

  async function saveWorkspaceToCloud() {
    if (!hasSupabaseConfig() || !supabase) {
      setCloudMessage("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.");
      return;
    }

    if (!session?.user.id) {
      setCloudMessage("Sign in before saving. P13 cloud workspaces are user-owned.");
      return;
    }

    const workspaceId = cloudWorkspaceId.trim();
    if (!workspaceId) {
      setCloudMessage("Enter or create a cloud workspace ID first.");
      return;
    }

    setIsCloudBusy(true);
    try {
      const existingRow = await fetchCloudWorkspace(workspaceId);
      const existingState = isPersistedAppState(existingRow?.payload) ? existingRow.payload : null;
      const manualOverride =
        existingState && shouldBlockWeakerWorkspaceOverwrite(currentWorkspaceState, existingState)
          ? window.confirm(
              "The existing Supabase workspace appears richer than the current local workspace. Saving now may overwrite competitions or fixtures. Continue anyway?",
            )
          : true;

      if (!manualOverride) {
        setCloudMessage("Cloud save cancelled to protect the richer Supabase workspace.");
        return;
      }

      await upsertCloudWorkspace(workspaceId, true, "Manual save");
      setCloudMessage(`Cloud workspace saved to ${activeUserEmail || "your account"}.`);
    } catch {
      setCloudMessage("Cloud save failed. Check Supabase env vars, schema.sql and authenticated RLS policies.");
    } finally {
      setIsCloudBusy(false);
    }
  }

  async function loadWorkspaceFromCloud() {
    if (!hasSupabaseConfig() || !supabase) {
      setCloudMessage("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.");
      return;
    }

    if (!session?.user.id) {
      setCloudMessage("Sign in before loading. P13 cloud workspaces are user-owned.");
      return;
    }

    const workspaceId = cloudWorkspaceId.trim();
    if (!workspaceId) {
      setCloudMessage("Enter the cloud workspace ID you want to load.");
      return;
    }

    setIsCloudBusy(true);
    try {
      const cloudRow = await fetchCloudWorkspace(workspaceId);
      const cloudState = cloudRow?.payload;
      if (!isPersistedAppState(cloudState)) {
        setCloudMessage("No valid cloud workspace found for your account and that ID.");
        return;
      }

      const localCandidate = selectBestLocalWorkspaceCandidate(discoverLocalWorkspaceCandidates(window.localStorage));
      if (localCandidate?.state && shouldBlockWeakerWorkspaceOverwrite(cloudState, localCandidate.state)) {
        const keepLocal = !window.confirm(
          "Your browser backup appears richer than the Supabase workspace. Loading cloud may hide local competitions or fixtures. Continue loading Supabase anyway?",
        );
        if (keepLocal) {
          setCloudMessage("Cloud load cancelled to protect the richer browser workspace.");
          return;
        }
      }

      applyWorkspaceState(cloudState, "Cloud workspace");
      setLastCloudSavedAt(cloudRow?.updated_at ?? cloudState.savedAt);
      setCloudMirrorStatus("Cloud workspace loaded. Future edits will mirror to Supabase and localStorage.");
    } catch {
      setCloudMessage("Cloud load failed. Check sign-in status, workspace ID, schema.sql and RLS policies.");
    } finally {
      setIsCloudBusy(false);
    }
  }

  async function refreshCloudPreview() {
    if (!hasSupabaseConfig() || !supabase) {
      setCloudPreviewMessage("Supabase is not configured, so no cloud copy can be compared yet.");
      setCloudPreviewState(null);
      return;
    }

    if (!session?.user.id) {
      setCloudPreviewMessage("Sign in before comparing the Supabase cloud copy.");
      setCloudPreviewState(null);
      return;
    }

    const workspaceId = cloudWorkspaceId.trim();
    if (!workspaceId) {
      setCloudPreviewMessage("Enter the cloud workspace ID before comparing.");
      setCloudPreviewState(null);
      return;
    }

    setIsCloudBusy(true);
    try {
      const cloudRow = await fetchCloudWorkspace(workspaceId);
      const cloudState = cloudRow?.payload;
      if (!isPersistedAppState(cloudState)) {
        setCloudPreviewState(null);
        setCloudPreviewMessage("No valid Supabase workspace found for that ID.");
        return;
      }
      setCloudPreviewState(cloudState);
      setCloudPreviewMessage(`Cloud preview loaded: ${describeWorkspaceMetrics(getWorkspacePreservationMetrics(cloudState))}.`);
    } catch {
      setCloudPreviewState(null);
      setCloudPreviewMessage("Cloud preview failed. Check sign-in, workspace ID, schema and RLS policies.");
    } finally {
      setIsCloudBusy(false);
    }
  }

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    if (!supabase || !session?.user.id || !cloudWorkspaceId.trim()) {
      setCloudMirrorStatus("Cloud mirror inactive. Sign in and configure Supabase to mirror the full workspace.");
      return;
    }

    const metrics = getWorkspacePreservationMetrics(currentWorkspaceState);
    if (metrics.fixtureCount === 0) {
      setCloudMirrorStatus("Cloud mirror paused: current workspace has no fixtures.");
      return;
    }

    const signature = JSON.stringify({
      workspaceId: cloudWorkspaceId.trim(),
      savedAt: currentWorkspaceState.savedAt,
      fixtureCount: metrics.fixtureCount,
      competitionCount: metrics.competitionCount,
      presetCount: metrics.tuningPresetCount,
      logCount: metrics.modelChangeLogCount,
    });

    const timeout = window.setTimeout(() => {
      if (lastAutoSavedSignatureRef.current === signature) return;
      upsertCloudWorkspace(cloudWorkspaceId.trim(), false, "Autosave").then((saved) => {
        if (saved) lastAutoSavedSignatureRef.current = signature;
      }).catch(() => {
        setCloudMirrorStatus("Cloud mirror failed. Browser autosave still has a local backup.");
      });
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [hasLoadedSavedState, supabase, session?.user.id, cloudWorkspaceId, currentWorkspaceState]);

  return {
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
  };
}
