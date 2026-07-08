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
import {
  ALL_ROUNDS,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  cloneEntrants,
  cloneFixtures,
  cloneUserTips,
  createPersistedState,
  isPersistedAppState,
  normaliseRound,
} from "../lib/workspace";

type WorkspaceAutosaveArgs = {
  fixtures: Fixture[];
  activeFixtureId: string;
  selectedRound: string;
  ruleWeights: RuleWeights;
  entrants: Entrant[];
  userTips: UserTip[];
  teamAliases: TeamAliasRule[];
  setFixtures: Dispatch<SetStateAction<Fixture[]>>;
  setActiveFixtureId: Dispatch<SetStateAction<string>>;
  setSelectedRound: Dispatch<SetStateAction<string>>;
  setRuleWeights: Dispatch<SetStateAction<RuleWeights>>;
  setEntrants: Dispatch<SetStateAction<Entrant[]>>;
  setUserTips: Dispatch<SetStateAction<UserTip[]>>;
  setTeamAliases: Dispatch<SetStateAction<TeamAliasRule[]>>;
};

export function useWorkspaceAutosave({
  fixtures,
  activeFixtureId,
  selectedRound,
  ruleWeights,
  entrants,
  userTips,
  teamAliases,
  setFixtures,
  setActiveFixtureId,
  setSelectedRound,
  setRuleWeights,
  setEntrants,
  setUserTips,
  setTeamAliases,
}: WorkspaceAutosaveArgs) {
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState("Loading saved workspace...");

  useEffect(() => {
    try {
      const rawState =
        window.localStorage.getItem(STORAGE_KEY) ??
        LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);

      if (!rawState) {
        setStorageMessage("No saved workspace found. Using sample data.");
        return;
      }

      const parsedState: unknown = JSON.parse(rawState);
      if (!isPersistedAppState(parsedState)) {
        setStorageMessage("Saved workspace could not be read. Using sample data.");
        return;
      }

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
      setLastSavedAt(parsedState.savedAt);
      setStorageMessage("Saved workspace restored from this browser.");
    } catch {
      setStorageMessage("Saved workspace could not be restored. Using sample data.");
    } finally {
      setHasLoadedSavedState(true);
    }
  }, [setActiveFixtureId, setEntrants, setFixtures, setRuleWeights, setSelectedRound, setUserTips, setTeamAliases]);

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
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setLastSavedAt(nextState.savedAt);
      setStorageMessage("Workspace autosaved in this browser.");
    } catch {
      setStorageMessage("Autosave failed. Export a backup before refreshing.");
    }
  }, [fixtures, activeFixtureId, selectedRound, ruleWeights, entrants, userTips, teamAliases, hasLoadedSavedState]);

  function resetWorkspaceToSamples() {
    const nextFixtures = cloneFixtures(initialFixtures);
    setFixtures(nextFixtures);
    setActiveFixtureId(nextFixtures[0]?.id ?? "");
    setSelectedRound(ALL_ROUNDS);
    setRuleWeights({ ...defaultRuleWeights });
    setEntrants(cloneEntrants(initialEntrants));
    setUserTips(cloneUserTips(initialUserTips));
    setTeamAliases(cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
    window.localStorage.removeItem(STORAGE_KEY);
    setStorageMessage("Workspace reset to sample data.");
  }

  function exportWorkspaceBackup() {
    const state = createPersistedState(fixtures, activeFixtureId, selectedRound, ruleWeights, entrants, userTips, teamAliases);
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

      const nextFixtures = cloneFixtures(parsedState.fixtures);
      setFixtures(nextFixtures);
      setActiveFixtureId(
        nextFixtures.some((fixture) => fixture.id === parsedState.activeFixtureId)
          ? parsedState.activeFixtureId
          : nextFixtures[0]?.id ?? "",
      );
      const importedRound = parsedState.selectedRound ?? ALL_ROUNDS;
      setSelectedRound(
        importedRound === ALL_ROUNDS ||
          nextFixtures.some((fixture) => normaliseRound(fixture.round) === importedRound)
          ? importedRound
          : ALL_ROUNDS,
      );
      setRuleWeights({ ...defaultRuleWeights, ...parsedState.ruleWeights });
      setEntrants(parsedState.entrants ? cloneEntrants(parsedState.entrants) : cloneEntrants(initialEntrants));
      setUserTips(parsedState.userTips ? cloneUserTips(parsedState.userTips) : cloneUserTips(initialUserTips));
      setTeamAliases(isTeamAliasRuleArray(parsedState.teamAliases) ? cloneTeamAliases(parsedState.teamAliases) : cloneTeamAliases(DEFAULT_TEAM_ALIAS_RULES));
      setStorageMessage("Workspace backup imported and autosaved.");
    } catch {
      setStorageMessage("Backup import failed. Check that the file is valid JSON.");
    }
  }

  return {
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
