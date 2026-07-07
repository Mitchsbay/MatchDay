"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  Entrant,
  Fixture,
  UserTip,
  entrants as initialEntrants,
  userTips as initialUserTips,
} from "../lib/sampleData";
import { RuleWeights, defaultRuleWeights } from "../lib/scoringEngine";
import {
  ALL_ROUNDS,
  CLOUD_WORKSPACE_ID_KEY,
  LEGACY_CLOUD_WORKSPACE_ID_KEYS,
  cloneEntrants,
  cloneFixtures,
  cloneUserTips,
  createPersistedState,
  isPersistedAppState,
  normaliseRound,
} from "../lib/workspace";

type WorkspaceCloudSyncArgs = {
  supabase: SupabaseClient | null;
  session: Session | null;
  activeUserEmail: string;
  fixtures: Fixture[];
  activeFixtureId: string;
  selectedRound: string;
  ruleWeights: RuleWeights;
  entrants: Entrant[];
  userTips: UserTip[];
  setFixtures: Dispatch<SetStateAction<Fixture[]>>;
  setActiveFixtureId: Dispatch<SetStateAction<string>>;
  setSelectedRound: Dispatch<SetStateAction<string>>;
  setRuleWeights: Dispatch<SetStateAction<RuleWeights>>;
  setEntrants: Dispatch<SetStateAction<Entrant[]>>;
  setUserTips: Dispatch<SetStateAction<UserTip[]>>;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceCloudSync({
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
}: WorkspaceCloudSyncArgs) {
  const [cloudWorkspaceId, setCloudWorkspaceId] = useState("");
  const [cloudMessage, setCloudMessage] = useState(
    "Sign in with Supabase Auth to save/load user-owned workspaces.",
  );
  const [isCloudBusy, setIsCloudBusy] = useState(false);

  useEffect(() => {
    const existingWorkspaceId =
      window.localStorage.getItem(CLOUD_WORKSPACE_ID_KEY) ??
      LEGACY_CLOUD_WORKSPACE_ID_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);

    if (existingWorkspaceId) {
      // Migrate forward so future loads hit the current key directly.
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
    return Boolean(supabase);
  }

  function createNewCloudWorkspaceId() {
    const nextWorkspaceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `workspace-${Date.now()}`;
    setCloudWorkspaceId(nextWorkspaceId);
    setCloudMessage("New cloud workspace ID created. Save to your signed-in account when ready.");
  }

  async function saveWorkspaceToCloud() {
    if (!hasSupabaseConfig() || !supabase) {
      setCloudMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
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
      const now = new Date().toISOString();
      const state = createPersistedState(fixtures, activeFixtureId, selectedRound, ruleWeights, entrants, userTips);
      const { error } = await supabase.from("matchday_workspaces").upsert(
        {
          workspace_id: workspaceId,
          owner_user_id: session.user.id,
          payload: state,
          updated_at: now,
        },
        { onConflict: "workspace_id" },
      );

      if (error) throw error;

      setLastSavedAt(state.savedAt);
      setCloudMessage(
        `Cloud workspace saved to ${activeUserEmail || "your account"} at ${new Date(now).toLocaleString()}.`,
      );
    } catch {
      setCloudMessage(
        "Cloud save failed. Check Supabase env vars, schema.sql and authenticated RLS policies.",
      );
    } finally {
      setIsCloudBusy(false);
    }
  }

  async function loadWorkspaceFromCloud() {
    if (!hasSupabaseConfig() || !supabase) {
      setCloudMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
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
      const { data, error } = await supabase
        .from("matchday_workspaces")
        .select("payload, updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;

      const cloudState = data?.payload;
      if (!isPersistedAppState(cloudState)) {
        setCloudMessage("No valid cloud workspace found for your account and that ID.");
        return;
      }

      const nextFixtures = cloneFixtures(cloudState.fixtures);
      setFixtures(nextFixtures);
      setActiveFixtureId(
        nextFixtures.some((fixture) => fixture.id === cloudState.activeFixtureId)
          ? cloudState.activeFixtureId
          : nextFixtures[0]?.id ?? "",
      );
      const cloudRound = cloudState.selectedRound ?? ALL_ROUNDS;
      setSelectedRound(
        cloudRound === ALL_ROUNDS ||
          nextFixtures.some((fixture) => normaliseRound(fixture.round) === cloudRound)
          ? cloudRound
          : ALL_ROUNDS,
      );
      setRuleWeights({ ...defaultRuleWeights, ...cloudState.ruleWeights });
      setEntrants(cloudState.entrants ? cloneEntrants(cloudState.entrants) : cloneEntrants(initialEntrants));
      setUserTips(cloudState.userTips ? cloneUserTips(cloudState.userTips) : cloneUserTips(initialUserTips));
      setLastSavedAt(cloudState.savedAt);
      setCloudMessage("Cloud workspace loaded and will now autosave locally.");
    } catch {
      setCloudMessage(
        "Cloud load failed. Check sign-in status, workspace ID, schema.sql and RLS policies.",
      );
    } finally {
      setIsCloudBusy(false);
    }
  }

  return {
    cloudMessage,
    cloudWorkspaceId,
    createNewCloudWorkspaceId,
    hasSupabaseConfig,
    isCloudBusy,
    loadWorkspaceFromCloud,
    saveWorkspaceToCloud,
    setCloudWorkspaceId,
  };
}
