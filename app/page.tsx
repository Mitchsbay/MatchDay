"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { Fixture, fixtures as initialFixtures } from "../lib/sampleData";
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
  applyCalculatedGaps,
  calculateAccuracySummary,
  calculateAvailabilityFromMissingPlayers,
  calculateContextFromFlags,
  calculateConflictFromSignals,
  calculateFormFromRecentResults,
  calculateOddsFromMarket,
  calculateQualityFromTeamStats,
  calculateResultAccuracy,
  calculateRuleLearningSummary,
  emptyMatchContext,
  emptyMissingPlayers,
  emptyOddsMarket,
  emptyMatchResult,
  emptyRecentForm,
  emptyScores,
  emptyTeamContext,
  emptyTeamStats,
  defaultRuleWeights,
  manualScoreDefinitions,
  ruleWeightDefinitions,
  runPrediction,
} from "../lib/scoringEngine";

const statFields: Array<{
  key: keyof TeamStats;
  label: string;
  helper: string;
}> = [
  { key: "played", label: "Played", helper: "Total league games" },
  { key: "points", label: "Points", helper: "Total points" },
  { key: "wins", label: "Wins", helper: "Total wins" },
  { key: "draws", label: "Draws", helper: "Total draws" },
  { key: "losses", label: "Losses", helper: "Total losses" },
  { key: "goalsFor", label: "GF", helper: "Goals for" },
  { key: "goalsAgainst", label: "GA", helper: "Goals against" },
  { key: "homePlayed", label: "Home P", helper: "Home games" },
  { key: "homePoints", label: "Home Pts", helper: "Home points" },
  { key: "homeGoalsFor", label: "Home GF", helper: "Home goals for" },
  { key: "homeGoalsAgainst", label: "Home GA", helper: "Home goals against" },
  { key: "awayPlayed", label: "Away P", helper: "Away games" },
  { key: "awayPoints", label: "Away Pts", helper: "Away points" },
  { key: "awayGoalsFor", label: "Away GF", helper: "Away goals for" },
  { key: "awayGoalsAgainst", label: "Away GA", helper: "Away goals against" },
];

const teamContextFields: Array<{
  key: keyof TeamContext;
  label: string;
  helper: string;
}> = [
  {
    key: "mustWin",
    label: "Must win",
    helper: "Result matters more than normal",
  },
  {
    key: "titleRace",
    label: "Title race",
    helper: "Pressure to stay near the top",
  },
  {
    key: "relegationBattle",
    label: "Relegation battle",
    helper: "Survival pressure / six-pointer",
  },
  {
    key: "chasingFinalsOrEurope",
    label: "Chasing finals/Europe",
    helper: "Needs points for qualification places",
  },
  {
    key: "newManagerBounce",
    label: "New manager bounce",
    helper: "Short-term lift from new coach/manager",
  },
  {
    key: "homecomingOrStatement",
    label: "Statement game",
    helper: "Opening/homecoming/revenge response angle",
  },
  {
    key: "rotationRisk",
    label: "Rotation risk",
    helper: "Likely to rest players",
  },
  {
    key: "alreadyQualifiedOrSafe",
    label: "Already safe",
    helper: "Lower urgency or nothing to play for",
  },
  {
    key: "cupOrFixtureDistraction",
    label: "Distraction",
    helper: "Cup, travel, short turnaround or future priority",
  },
  {
    key: "travelFatigue",
    label: "Travel fatigue",
    helper: "Heavy travel or awkward schedule",
  },
];

const matchContextFields: Array<{
  key: keyof MatchContext;
  label: string;
  helper: string;
}> = [
  {
    key: "derbyOrRivalry",
    label: "Derby/rivalry",
    helper: "Raises volatility; not an automatic edge",
  },
  {
    key: "openingRound",
    label: "Opening round",
    helper: "Early-season uncertainty / statement angle",
  },
  {
    key: "knockoutOrElimination",
    label: "Knockout/elimination",
    helper: "High pressure fixture",
  },
  {
    key: "weatherRisk",
    label: "Weather risk",
    helper: "Conditions may distort normal performance",
  },
  {
    key: "unusualVenue",
    label: "Unusual venue",
    helper: "Neutral ground or venue disruption",
  },
];

function cloneFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((fixture) => ({
    ...fixture,
    homeStats: { ...fixture.homeStats },
    awayStats: { ...fixture.awayStats },
    homeRecentForm: fixture.homeRecentForm.map((game) => ({ ...game })),
    awayRecentForm: fixture.awayRecentForm.map((game) => ({ ...game })),
    homeMissingPlayers: fixture.homeMissingPlayers.map((player) => ({
      ...player,
    })),
    awayMissingPlayers: fixture.awayMissingPlayers.map((player) => ({
      ...player,
    })),
    homeContext: { ...fixture.homeContext },
    awayContext: { ...fixture.awayContext },
    matchContext: { ...fixture.matchContext },
    oddsMarket: { ...fixture.oddsMarket },
    matchResult: { ...fixture.matchResult },
    scores: { ...fixture.scores },
  }));
}

const STORAGE_KEY = "tipping-gates-app-p13-state-v1";
const LEGACY_STORAGE_KEYS = [
  "tipping-gates-app-p12-state-v1",
  "tipping-gates-app-p11-state-v1",
];
const CLOUD_WORKSPACE_ID_KEY = "tipping-gates-app-p13-cloud-workspace-id";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function createSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

type PersistedAppState = {
  version: string;
  savedAt: string;
  fixtures: Fixture[];
  activeFixtureId: string;
  ruleWeights: RuleWeights;
};

function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedAppState>;
  return (
    Array.isArray(candidate.fixtures) &&
    typeof candidate.activeFixtureId === "string" &&
    !!candidate.ruleWeights &&
    typeof candidate.ruleWeights === "object"
  );
}

function createPersistedState(
  fixtures: Fixture[],
  activeFixtureId: string,
  ruleWeights: RuleWeights,
): PersistedAppState {
  return {
    version: "0.13.0",
    savedAt: new Date().toISOString(),
    fixtures: cloneFixtures(fixtures),
    activeFixtureId,
    ruleWeights: { ...ruleWeights },
  };
}

function gateBadge(status: "passed" | "blocked" | "review") {
  if (status === "passed") return <span className="badge good">✓ Passed</span>;
  if (status === "blocked")
    return <span className="badge warn">! Blocked from strong tip</span>;
  return <span className="badge bad">! Review required</span>;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function outcomeLabel(outcome: string) {
  if (outcome === "home") return "Home win";
  if (outcome === "away") return "Away win";
  if (outcome === "draw") return "Draw";
  if (outcome === "review") return "Review / no tip";
  return "Pending";
}

function accuracyBadge(
  isCorrect: boolean | null,
  isSettled: boolean,
  isTipPublished: boolean,
) {
  if (!isSettled) return <span className="badge warn">Pending result</span>;
  if (!isTipPublished)
    return <span className="badge warn">Review / no tip</span>;
  if (isCorrect) return <span className="badge good">Correct</span>;
  return <span className="badge bad">Missed</span>;
}

export default function Home() {
  const [fixtures, setFixtures] = useState<Fixture[]>(() =>
    cloneFixtures(initialFixtures),
  );
  const [activeFixtureId, setActiveFixtureId] = useState(fixtures[0]?.id ?? "");
  const [ruleWeights, setRuleWeights] = useState<RuleWeights>(() => ({
    ...defaultRuleWeights,
  }));
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState(
    "Loading saved workspace...",
  );
  const [cloudWorkspaceId, setCloudWorkspaceId] = useState("");
  const [cloudMessage, setCloudMessage] = useState(
    "Sign in with Supabase Auth to save/load user-owned workspaces.",
  );
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState(
    "Supabase Auth is optional until env vars are added.",
  );
  const [session, setSession] = useState<Session | null>(null);

  const supabase = useMemo(() => createSupabaseClient(), []);

  const activeFixture =
    fixtures.find((fixture) => fixture.id === activeFixtureId) ?? fixtures[0];

  useEffect(() => {
    try {
      const rawState =
        window.localStorage.getItem(STORAGE_KEY) ??
        LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(
          Boolean,
        );
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
      setRuleWeights({ ...defaultRuleWeights, ...parsedState.ruleWeights });
      setLastSavedAt(parsedState.savedAt);
      setStorageMessage("Saved workspace restored from this browser.");
    } catch {
      setStorageMessage("Saved workspace could not be restored. Using sample data.");
    } finally {
      setHasLoadedSavedState(true);
    }
  }, []);

  useEffect(() => {
    const existingWorkspaceId = window.localStorage.getItem(CLOUD_WORKSPACE_ID_KEY);
    if (existingWorkspaceId) {
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

  useEffect(() => {
    if (!supabase) {
      setAuthMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthMessage("Could not read Supabase session.");
        return;
      }
      setSession(data.session);
      setAuthMessage(
        data.session?.user.email
          ? `Signed in as ${data.session.user.email}.`
          : "Not signed in. Use email magic link to enable cloud save/load.",
      );
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage(
        nextSession?.user.email
          ? `Signed in as ${nextSession.user.email}.`
          : "Signed out. Browser autosave still works locally.",
      );
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    try {
      const nextState = createPersistedState(
        fixtures,
        activeFixtureId,
        ruleWeights,
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setLastSavedAt(nextState.savedAt);
      setStorageMessage("Workspace autosaved in this browser.");
    } catch {
      setStorageMessage("Autosave failed. Export a backup before refreshing.");
    }
  }, [fixtures, activeFixtureId, ruleWeights, hasLoadedSavedState]);
  const quality = useMemo(
    () =>
      calculateQualityFromTeamStats(
        activeFixture.homeStats,
        activeFixture.awayStats,
      ),
    [activeFixture.homeStats, activeFixture.awayStats],
  );
  const form = useMemo(
    () =>
      calculateFormFromRecentResults(
        activeFixture.homeRecentForm,
        activeFixture.awayRecentForm,
      ),
    [activeFixture.homeRecentForm, activeFixture.awayRecentForm],
  );
  const availability = useMemo(
    () =>
      calculateAvailabilityFromMissingPlayers(
        activeFixture.homeMissingPlayers,
        activeFixture.awayMissingPlayers,
      ),
    [activeFixture.homeMissingPlayers, activeFixture.awayMissingPlayers],
  );
  const context = useMemo(
    () =>
      calculateContextFromFlags(
        activeFixture.homeContext,
        activeFixture.awayContext,
        activeFixture.matchContext,
      ),
    [
      activeFixture.homeContext,
      activeFixture.awayContext,
      activeFixture.matchContext,
    ],
  );
  const odds = useMemo(
    () => calculateOddsFromMarket(activeFixture.oddsMarket),
    [activeFixture.oddsMarket],
  );
  const preConflictScores = useMemo(
    () =>
      applyCalculatedGaps(
        activeFixture.scores,
        quality.qualityGap,
        form.recentFormGap,
        availability.injuryRisk,
        context.motivationEdge,
        odds.oddsSupport,
        0,
      ),
    [
      activeFixture.scores,
      quality.qualityGap,
      form.recentFormGap,
      availability.injuryRisk,
      context.motivationEdge,
      odds.oddsSupport,
    ],
  );
  const conflict = useMemo(
    () =>
      calculateConflictFromSignals({
        scores: preConflictScores,
        weights: ruleWeights,
        contextWarnings: context.warnings,
        oddsWarnings: odds.warnings,
        volatilityScore: context.volatilityScore,
        drawProbability: odds.drawProbability,
        externalFavourite: odds.externalFavourite,
        favouriteMargin: odds.favouriteMargin,
      }),
    [
      preConflictScores,
      ruleWeights,
      context.warnings,
      odds.warnings,
      context.volatilityScore,
      odds.drawProbability,
      odds.externalFavourite,
      odds.favouriteMargin,
    ],
  );
  const calculatedScores = useMemo(
    () =>
      applyCalculatedGaps(
        preConflictScores,
        quality.qualityGap,
        form.recentFormGap,
        availability.injuryRisk,
        context.motivationEdge,
        odds.oddsSupport,
        conflict.conflictScore,
      ),
    [
      preConflictScores,
      quality.qualityGap,
      form.recentFormGap,
      availability.injuryRisk,
      context.motivationEdge,
      odds.oddsSupport,
      conflict.conflictScore,
    ],
  );
  const result = useMemo(
    () => runPrediction(calculatedScores, ruleWeights),
    [calculatedScores, ruleWeights],
  );
  const accuracy = useMemo(
    () => calculateResultAccuracy(result, activeFixture.matchResult),
    [result, activeFixture.matchResult],
  );

  const computedFixtureResults = useMemo(() => {
    return fixtures.map((fixture) => {
      const fixtureQuality = calculateQualityFromTeamStats(
        fixture.homeStats,
        fixture.awayStats,
      );
      const fixtureForm = calculateFormFromRecentResults(
        fixture.homeRecentForm,
        fixture.awayRecentForm,
      );
      const fixtureAvailability = calculateAvailabilityFromMissingPlayers(
        fixture.homeMissingPlayers,
        fixture.awayMissingPlayers,
      );
      const fixtureContext = calculateContextFromFlags(
        fixture.homeContext,
        fixture.awayContext,
        fixture.matchContext,
      );
      const fixtureOdds = calculateOddsFromMarket(fixture.oddsMarket);
      const fixturePreConflictScores = applyCalculatedGaps(
        fixture.scores,
        fixtureQuality.qualityGap,
        fixtureForm.recentFormGap,
        fixtureAvailability.injuryRisk,
        fixtureContext.motivationEdge,
        fixtureOdds.oddsSupport,
        0,
      );
      const fixtureConflict = calculateConflictFromSignals({
        scores: fixturePreConflictScores,
        weights: ruleWeights,
        contextWarnings: fixtureContext.warnings,
        oddsWarnings: fixtureOdds.warnings,
        volatilityScore: fixtureContext.volatilityScore,
        drawProbability: fixtureOdds.drawProbability,
        externalFavourite: fixtureOdds.externalFavourite,
        favouriteMargin: fixtureOdds.favouriteMargin,
      });
      const fixtureScores = applyCalculatedGaps(
        fixturePreConflictScores,
        fixtureQuality.qualityGap,
        fixtureForm.recentFormGap,
        fixtureAvailability.injuryRisk,
        fixtureContext.motivationEdge,
        fixtureOdds.oddsSupport,
        fixtureConflict.conflictScore,
      );
      const fixturePrediction = runPrediction(fixtureScores, ruleWeights);
      const fixtureAccuracy = calculateResultAccuracy(
        fixturePrediction,
        fixture.matchResult,
      );
      return {
        fixture,
        prediction: fixturePrediction,
        accuracy: fixtureAccuracy,
        confidence: fixturePrediction.confidence,
      };
    });
  }, [fixtures, ruleWeights]);

  const accuracySummary = useMemo(
    () =>
      calculateAccuracySummary(
        computedFixtureResults.map((item) => item.accuracy),
        computedFixtureResults.map((item) => item.confidence),
      ),
    [computedFixtureResults],
  );

  const ruleLearning = useMemo(
    () =>
      calculateRuleLearningSummary(
        computedFixtureResults.map((item) => ({
          prediction: item.prediction,
          accuracy: item.accuracy,
        })),
      ),
    [computedFixtureResults],
  );

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

  function resetWorkspaceToSamples() {
    const nextFixtures = cloneFixtures(initialFixtures);
    setFixtures(nextFixtures);
    setActiveFixtureId(nextFixtures[0]?.id ?? "");
    setRuleWeights({ ...defaultRuleWeights });
    window.localStorage.removeItem(STORAGE_KEY);
    setStorageMessage("Workspace reset to sample data.");
  }

  function exportWorkspaceBackup() {
    const state = createPersistedState(fixtures, activeFixtureId, ruleWeights);
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
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
      setRuleWeights({ ...defaultRuleWeights, ...parsedState.ruleWeights });
      setStorageMessage("Workspace backup imported and autosaved.");
    } catch {
      setStorageMessage("Backup import failed. Check that the file is valid JSON.");
    }
  }

  function hasSupabaseConfig() {
    return Boolean(supabase);
  }

  const activeUserEmail = session?.user.email ?? "";

  async function sendMagicLink() {
    if (!supabase) {
      setAuthMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    const email = authEmail.trim();
    if (!email) {
      setAuthMessage("Enter your email address first.");
      return;
    }

    setIsCloudBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setAuthMessage("Magic link sent. Open the email on this device/browser to sign in.");
    } catch {
      setAuthMessage("Magic link failed. Check Supabase Auth settings and email configuration.");
    } finally {
      setIsCloudBusy(false);
    }
  }

  async function signOutOfSupabase() {
    if (!supabase) return;
    setIsCloudBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setAuthMessage("Signed out. Browser autosave still works locally.");
    } finally {
      setIsCloudBusy(false);
    }
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
      const state = createPersistedState(fixtures, activeFixtureId, ruleWeights);
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
      setRuleWeights({ ...defaultRuleWeights, ...cloudState.ruleWeights });
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
    const id = `fixture-${Date.now()}`;
    const nextFixture: Fixture = {
      id,
      competition: "New Competition",
      round: "New Round",
      date: "TBC",
      homeTeam: "Home Team",
      awayTeam: "Away Team",
      homeStats: { ...emptyTeamStats },
      awayStats: { ...emptyTeamStats },
      homeRecentForm: emptyRecentForm.map((game) => ({ ...game })),
      awayRecentForm: emptyRecentForm.map((game) => ({ ...game })),
      homeMissingPlayers: emptyMissingPlayers.map((player) => ({ ...player })),
      awayMissingPlayers: emptyMissingPlayers.map((player) => ({ ...player })),
      homeContext: { ...emptyTeamContext },
      awayContext: { ...emptyTeamContext },
      matchContext: { ...emptyMatchContext },
      oddsMarket: { ...emptyOddsMarket },
      matchResult: { ...emptyMatchResult },
      scores: { ...emptyScores },
    };
    setFixtures((current) => [nextFixture, ...current]);
    setActiveFixtureId(id);
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
          <div className="eyebrow">Tipping Gates App · P13</div>
          <h1>
            Evidence-based gates with accuracy tracking, adjustable weights,
            browser persistence and authenticated Supabase cloud sync.
          </h1>
          <p className="lead">
            Enter raw team data, recent results, missing-player evidence,
            motivation/context flags and external 1X2 probabilities. The app
            calculates Quality Gap, Recent Form Gap, Availability Risk,
            Motivation Edge, Odds Support and Conflict Score, then tracks final
            results so you can review hit rate over time and tune the model
            without changing code. P13 keeps browser autosave and upgrades Supabase cloud save/load to signed-in, user-owned workspaces.
          </p>
        </div>
        <button className="primary" onClick={addBlankFixture}>
          Add Fixture
        </button>
      </section>

      <section className="grid">
        <aside className="card">
          <h2>Fixtures</h2>
          <div className="fixture-list">
            {fixtures.map((fixture) => {
              const fixtureQuality = calculateQualityFromTeamStats(
                fixture.homeStats,
                fixture.awayStats,
              );
              const fixtureForm = calculateFormFromRecentResults(
                fixture.homeRecentForm,
                fixture.awayRecentForm,
              );
              const fixtureAvailability =
                calculateAvailabilityFromMissingPlayers(
                  fixture.homeMissingPlayers,
                  fixture.awayMissingPlayers,
                );
              const fixtureContext = calculateContextFromFlags(
                fixture.homeContext,
                fixture.awayContext,
                fixture.matchContext,
              );
              const fixtureOdds = calculateOddsFromMarket(fixture.oddsMarket);
              const fixturePreConflictScores = applyCalculatedGaps(
                fixture.scores,
                fixtureQuality.qualityGap,
                fixtureForm.recentFormGap,
                fixtureAvailability.injuryRisk,
                fixtureContext.motivationEdge,
                fixtureOdds.oddsSupport,
                0,
              );
              const fixtureConflict = calculateConflictFromSignals({
                scores: fixturePreConflictScores,
                weights: ruleWeights,
                contextWarnings: fixtureContext.warnings,
                oddsWarnings: fixtureOdds.warnings,
                volatilityScore: fixtureContext.volatilityScore,
                drawProbability: fixtureOdds.drawProbability,
                externalFavourite: fixtureOdds.externalFavourite,
                favouriteMargin: fixtureOdds.favouriteMargin,
              });
              const fixtureScores = applyCalculatedGaps(
                fixturePreConflictScores,
                fixtureQuality.qualityGap,
                fixtureForm.recentFormGap,
                fixtureAvailability.injuryRisk,
                fixtureContext.motivationEdge,
                fixtureOdds.oddsSupport,
                fixtureConflict.conflictScore,
              );
              const fixtureResult = runPrediction(fixtureScores, ruleWeights);
              const fixtureAccuracy = calculateResultAccuracy(
                fixtureResult,
                fixture.matchResult,
              );
              return (
                <button
                  key={fixture.id}
                  className={`fixture-btn ${fixture.id === activeFixture.id ? "active" : ""}`}
                  onClick={() => setActiveFixtureId(fixture.id)}
                >
                  <strong>
                    {fixture.homeTeam} vs {fixture.awayTeam}
                  </strong>
                  <div className="fixture-meta">
                    {fixture.competition} · {fixture.round} · {fixture.date}
                  </div>
                  <div className="fixture-meta">
                    Quality {signed(fixtureQuality.qualityGap)} · Form{" "}
                    {signed(fixtureForm.recentFormGap)} · Avail{" "}
                    {signed(fixtureAvailability.injuryRisk)} · Context{" "}
                    {signed(fixtureContext.motivationEdge)} · Odds{" "}
                    {signed(fixtureOdds.oddsSupport)} · Conflict{" "}
                    {fixtureConflict.conflictScore}/5 · Edge{" "}
                    {signed(fixtureResult.homeEdge)} ·{" "}
                    {fixtureResult.prediction}
                  </div>
                  <div className="fixture-meta">
                    Result: {outcomeLabel(fixtureAccuracy.actualOutcome)} ·
                    Accuracy:{" "}
                    {fixtureAccuracy.isCorrect === null
                      ? "Pending / not counted"
                      : fixtureAccuracy.isCorrect
                        ? "Correct"
                        : "Missed"}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div>
          <section className="card" style={{ marginBottom: 18 }}>
            <h3>P11/P12 Workspace Persistence</h3>
            <p className="section-help">
              Fixtures, raw evidence, final results and tuning weights are now
              autosaved to this browser. Use backups before replacing the repo,
              changing devices or clearing browser storage.
            </p>
            <div className="result-grid compact">
              <div className="metric">
                <div className="label">Autosave Status</div>
                <div className="value small-value">{storageMessage}</div>
              </div>
              <div className="metric">
                <div className="label">Last Saved</div>
                <div className="value small-value">
                  {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Not saved yet"}
                </div>
              </div>
              <div className="metric">
                <div className="label">Saved Fixtures</div>
                <div className="value">{fixtures.length}</div>
              </div>
            </div>
            <div className="actions">
              <button className="secondary" onClick={exportWorkspaceBackup}>
                Export backup JSON
              </button>
              <label className="secondary file-action">
                Import backup JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={importWorkspaceBackup}
                />
              </label>
              <button className="secondary danger" onClick={resetWorkspaceToSamples}>
                Reset to sample data
              </button>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>P13 Supabase Auth + User-Owned Cloud Persistence</h3>
            <p className="section-help">
              Optional cloud sync with Supabase Auth. Add your Supabase URL and anon key as Vercel
              environment variables, run the SQL in <code>supabase/schema.sql</code>,
              then sign in and save or load this workspace by ID. Browser autosave still works
              even when Supabase is not configured.
            </p>
            <div className="field-row">
              <label>
                Email for Supabase sign-in
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            </div>
            <div className="actions">
              <button
                className="secondary"
                onClick={sendMagicLink}
                disabled={isCloudBusy || Boolean(session)}
              >
                Send magic link
              </button>
              <button
                className="secondary"
                onClick={signOutOfSupabase}
                disabled={isCloudBusy || !session}
              >
                Sign out
              </button>
            </div>
            <div className="note-box">
              {authMessage}
              {activeUserEmail ? ` Cloud saves are owned by ${activeUserEmail}.` : ""}
            </div>
            <div className="field-row">
              <label>
                Cloud workspace ID
                <input
                  value={cloudWorkspaceId}
                  onChange={(event) => setCloudWorkspaceId(event.target.value)}
                />
              </label>
            </div>
            <div className="actions">
              <button
                className="secondary"
                onClick={saveWorkspaceToCloud}
                disabled={isCloudBusy}
              >
                Save to Supabase
              </button>
              <button
                className="secondary"
                onClick={loadWorkspaceFromCloud}
                disabled={isCloudBusy}
              >
                Load from Supabase
              </button>
              <button
                className="secondary"
                onClick={createNewCloudWorkspaceId}
                disabled={isCloudBusy}
              >
                New cloud ID
              </button>
            </div>
            <div className="note-box">{cloudMessage}</div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Accuracy Dashboard</h3>
            <div className="result-grid compact">
              <div className="metric">
                <div className="label">Final Fixtures</div>
                <div className="value">{accuracySummary.finalFixtures}</div>
              </div>
              <div className="metric">
                <div className="label">Published Tips</div>
                <div className="value">{accuracySummary.publishedTips}</div>
              </div>
              <div className="metric">
                <div className="label">Correct Tips</div>
                <div className="value">{accuracySummary.correctTips}</div>
              </div>
              <div className="metric">
                <div className="label">Hit Rate</div>
                <div className="value">{accuracySummary.hitRate}%</div>
              </div>
              <div className="metric">
                <div className="label">Review / No Tip</div>
                <div className="value">{accuracySummary.reviewOrNoTips}</div>
              </div>
              <div className="metric">
                <div className="label">Pending</div>
                <div className="value">{accuracySummary.pendingFixtures}</div>
              </div>
              <div className="metric">
                <div className="label">Points</div>
                <div className="value">{accuracySummary.totalPoints}</div>
              </div>
              <div className="metric">
                <div className="label">Avg Confidence</div>
                <div className="value">
                  {accuracySummary.averageConfidence}%
                </div>
              </div>
            </div>
            <div className="note-box">
              P10 keeps the P9 rule-learning insight and adds live weight
              tuning, so you can test whether a gate should matter more or less
              before changing the engine defaults.
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Rule Learning Dashboard</h3>
            <p className="section-help">
              P10 reviews settled results against each gate and lets you adjust
              rule weights manually. The changes are live in this browser
              session and do not rewrite the engine defaults.
            </p>
            <div className="result-grid compact">
              <div className="metric">
                <div className="label">Settled Fixtures</div>
                <div className="value">{ruleLearning.settledFixtures}</div>
              </div>
              <div className="metric">
                <div className="label">Learned Tips</div>
                <div className="value">{ruleLearning.publishedTips}</div>
              </div>
              <div className="metric">
                <div className="label">Review Holds</div>
                <div className="value">{ruleLearning.reviewFixtures}</div>
              </div>
              <div className="metric">
                <div className="label">Best Gate</div>
                <div className="value small-value">
                  {ruleLearning.bestGateName}
                </div>
              </div>
            </div>
            <div className="learning-table">
              <div className="learning-row header-row">
                <span>Gate</span>
                <span>Pass hit</span>
                <span>Fail hit</span>
                <span>Review flags</span>
                <span>Recommendation</span>
              </div>
              {ruleLearning.learningItems.map((gate) => (
                <div className="learning-row" key={gate.gateId}>
                  <span>{gate.gateName}</span>
                  <span>
                    {gate.passHitRate}% ({gate.passCorrectTips}/
                    {gate.passPublishedTips})
                  </span>
                  <span>
                    {gate.failHitRate}% ({gate.failCorrectTips}/
                    {gate.failPublishedTips})
                  </span>
                  <span>{gate.reviewFlags}</span>
                  <span>{gate.recommendation}</span>
                </div>
              ))}
            </div>
            <ul className="evidence-list">
              {ruleLearning.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>P10 Rule Weight Tuning Panel</h3>
            <p className="section-help">
              Adjust how much each gate contributes to the final edge and review
              decision. This is a live sandbox setting, so you can test the
              model before making any permanent engine change.
            </p>
            <div className="weight-grid">
              {ruleWeightDefinitions.map((definition) => (
                <div className="weight-row" key={definition.key}>
                  <div>
                    <strong>{definition.label}</strong>
                    <span>{definition.helper}</span>
                  </div>
                  <input
                    type="range"
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    value={ruleWeights[definition.key]}
                    onChange={(event) =>
                      updateRuleWeight(
                        definition.key,
                        Number(event.target.value),
                      )
                    }
                  />
                  <input
                    className="score-input small-input"
                    type="number"
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    value={ruleWeights[definition.key]}
                    onChange={(event) =>
                      updateRuleWeight(
                        definition.key,
                        Number(event.target.value),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <div className="note-box">
              Current final edge uses weighted evidence. For example, Quality
              Gap {signed(quality.qualityGap)} × {ruleWeights.qualityGap} and
              Conflict Score {conflict.conflictScore} ×{" "}
              {ruleWeights.conflictScore}
              are included in the displayed Home Edge.
            </div>
            <div className="actions">
              <button className="secondary" onClick={resetRuleWeights}>
                Reset weights to defaults
              </button>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h2>
              {activeFixture.homeTeam} vs {activeFixture.awayTeam}
            </h2>
            <div className="result-grid">
              <div className="metric">
                <div className="label">Prediction</div>
                <div className="value">{result.prediction}</div>
              </div>
              <div className="metric">
                <div className="label">Home Edge</div>
                <div className="value">{signed(result.homeEdge)}</div>
              </div>
              <div className="metric">
                <div className="label">Quality Gap</div>
                <div className="value">{signed(quality.qualityGap)}</div>
              </div>
              <div className="metric">
                <div className="label">Form Gap</div>
                <div className="value">{signed(form.recentFormGap)}</div>
              </div>
              <div className="metric">
                <div className="label">Availability Risk</div>
                <div className="value">{signed(availability.injuryRisk)}</div>
              </div>
              <div className="metric">
                <div className="label">Motivation Edge</div>
                <div className="value">{signed(context.motivationEdge)}</div>
              </div>
              <div className="metric">
                <div className="label">Odds Support</div>
                <div className="value">{signed(odds.oddsSupport)}</div>
              </div>
              <div className="metric">
                <div className="label">Conflict</div>
                <div className="value">{conflict.conflictScore}/5</div>
              </div>
              <div className="metric">
                <div className="label">Confidence</div>
                <div className="value">{result.confidence}%</div>
              </div>
              <div className="metric">
                <div className="label">Actual Outcome</div>
                <div className="value">
                  {outcomeLabel(accuracy.actualOutcome)}
                </div>
              </div>
              <div className="metric">
                <div className="label">Accuracy</div>
                <div className="value" style={{ fontSize: 15 }}>
                  {accuracyBadge(
                    accuracy.isCorrect,
                    accuracy.isSettled,
                    accuracy.isTipPublished,
                  )}
                </div>
              </div>
            </div>
            <div className="result-grid compact">
              <div className="metric">
                <div className="label">Home Match Strength</div>
                <div className="value">{quality.homeMatchStrength}</div>
              </div>
              <div className="metric">
                <div className="label">Away Match Strength</div>
                <div className="value">{quality.awayMatchStrength}</div>
              </div>
              <div className="metric">
                <div className="label">Raw Strength Gap</div>
                <div className="value">{signed(quality.rawStrengthGap)}</div>
              </div>
              <div className="metric">
                <div className="label">Gate Status</div>
                <div className="value" style={{ fontSize: 15 }}>
                  {gateBadge(result.gateStatus)}
                </div>
              </div>
            </div>

            <div className="note-box">
              <strong>Gate logic:</strong> Quality comes from team stats, form
              comes from recent results, availability comes from missing-player
              impact, motivation comes from structured context flags, and odds
              support comes from external 1X2 probabilities. P8 now lets you
              enter final results and compares the published tip against the
              actual outcome for accuracy tracking.
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Fixture Details</h3>
            <div className="two-col">
              <label>
                <span>Home Team</span>
                <input
                  className="text-input"
                  value={activeFixture.homeTeam}
                  onChange={(event) =>
                    updateFixtureField("homeTeam", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Away Team</span>
                <input
                  className="text-input"
                  value={activeFixture.awayTeam}
                  onChange={(event) =>
                    updateFixtureField("awayTeam", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Competition</span>
                <input
                  className="text-input"
                  value={activeFixture.competition}
                  onChange={(event) =>
                    updateFixtureField("competition", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Round</span>
                <input
                  className="text-input"
                  value={activeFixture.round}
                  onChange={(event) =>
                    updateFixtureField("round", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Date</span>
                <input
                  className="text-input"
                  value={activeFixture.date}
                  onChange={(event) =>
                    updateFixtureField("date", event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Result / Accuracy Inputs</h3>
            <p className="section-help">
              Enter the final score after the match. The app maps the prediction
              to home/draw/away and records whether the published tip was
              correct. Review Required predictions are tracked but not counted
              as published tips.
            </p>
            <div className="two-col">
              <label>
                <span>Result status</span>
                <select
                  className="text-input"
                  value={activeFixture.matchResult.status}
                  onChange={(event) =>
                    updateMatchResult("status", event.target.value)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="final">Final</option>
                </select>
              </label>
              <label>
                <span>Predicted outcome</span>
                <input
                  className="text-input"
                  value={outcomeLabel(accuracy.predictedOutcome)}
                  readOnly
                />
              </label>
              <label>
                <span>{activeFixture.homeTeam} goals</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  value={activeFixture.matchResult.homeGoals}
                  onChange={(event) =>
                    updateMatchResult("homeGoals", Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>{activeFixture.awayTeam} goals</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  value={activeFixture.matchResult.awayGoals}
                  onChange={(event) =>
                    updateMatchResult("awayGoals", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <div className="evidence-grid" style={{ marginTop: 14 }}>
              <div className="mini-metric">
                <span>Actual</span>
                <strong>{outcomeLabel(accuracy.actualOutcome)}</strong>
              </div>
              <div className="mini-metric">
                <span>Predicted</span>
                <strong>{outcomeLabel(accuracy.predictedOutcome)}</strong>
              </div>
              <div className="mini-metric">
                <span>Counted Tip</span>
                <strong>{accuracy.isTipPublished ? "Yes" : "No"}</strong>
              </div>
              <div className="mini-metric">
                <span>Points</span>
                <strong>{accuracy.pointsAwarded}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {accuracy.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Team Strength Inputs</h3>
            <p className="section-help">
              These raw numbers create the Quality Gap automatically. You no
              longer need to guess the team strength score.
            </p>
            <div className="stats-grid">
              <div className="stats-panel">
                <h4>{activeFixture.homeTeam}</h4>
                {statFields.map((field) => (
                  <label className="stat-row" key={`home-${field.key}`}>
                    <span>
                      <strong>{field.label}</strong>
                      <em>{field.helper}</em>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={activeFixture.homeStats[field.key]}
                      onChange={(event) =>
                        updateStats(
                          "homeStats",
                          field.key,
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="stats-panel">
                <h4>{activeFixture.awayTeam}</h4>
                {statFields.map((field) => (
                  <label className="stat-row" key={`away-${field.key}`}>
                    <span>
                      <strong>{field.label}</strong>
                      <em>{field.helper}</em>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={activeFixture.awayStats[field.key]}
                      onChange={(event) =>
                        updateStats(
                          "awayStats",
                          field.key,
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Recent Form Inputs</h3>
            <p className="section-help">
              Enter the latest 5 results for each team. Points and recent goal
              difference create the Recent Form Gap automatically.
            </p>
            <div className="form-grid">
              <div className="form-panel">
                <h4>{activeFixture.homeTeam}</h4>
                {activeFixture.homeRecentForm.map((game, index) => (
                  <div className="form-row" key={`home-form-${index}`}>
                    <span>Game {index + 1}</span>
                    <select
                      value={game.result}
                      onChange={(event) =>
                        updateRecentForm(
                          "homeRecentForm",
                          index,
                          "result",
                          event.target.value as RecentResult,
                        )
                      }
                    >
                      <option value="W">W</option>
                      <option value="D">D</option>
                      <option value="L">L</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={game.goalsFor}
                      onChange={(event) =>
                        updateRecentForm(
                          "homeRecentForm",
                          index,
                          "goalsFor",
                          Number(event.target.value),
                        )
                      }
                      aria-label="Home recent goals for"
                    />
                    <input
                      type="number"
                      min={0}
                      value={game.goalsAgainst}
                      onChange={(event) =>
                        updateRecentForm(
                          "homeRecentForm",
                          index,
                          "goalsAgainst",
                          Number(event.target.value),
                        )
                      }
                      aria-label="Home recent goals against"
                    />
                  </div>
                ))}
                <div className="form-hint">Columns: result, GF, GA</div>
              </div>
              <div className="form-panel">
                <h4>{activeFixture.awayTeam}</h4>
                {activeFixture.awayRecentForm.map((game, index) => (
                  <div className="form-row" key={`away-form-${index}`}>
                    <span>Game {index + 1}</span>
                    <select
                      value={game.result}
                      onChange={(event) =>
                        updateRecentForm(
                          "awayRecentForm",
                          index,
                          "result",
                          event.target.value as RecentResult,
                        )
                      }
                    >
                      <option value="W">W</option>
                      <option value="D">D</option>
                      <option value="L">L</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={game.goalsFor}
                      onChange={(event) =>
                        updateRecentForm(
                          "awayRecentForm",
                          index,
                          "goalsFor",
                          Number(event.target.value),
                        )
                      }
                      aria-label="Away recent goals for"
                    />
                    <input
                      type="number"
                      min={0}
                      value={game.goalsAgainst}
                      onChange={(event) =>
                        updateRecentForm(
                          "awayRecentForm",
                          index,
                          "goalsAgainst",
                          Number(event.target.value),
                        )
                      }
                      aria-label="Away recent goals against"
                    />
                  </div>
                ))}
                <div className="form-hint">Columns: result, GF, GA</div>
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Availability Inputs</h3>
            <p className="section-help">
              Enter missing or doubtful players. Importance, reason and
              expected-starter status create Availability Risk automatically.
            </p>
            <div className="availability-grid">
              <div className="availability-panel">
                <h4>{activeFixture.homeTeam}</h4>
                {activeFixture.homeMissingPlayers.map((player, index) => (
                  <div
                    className="availability-row"
                    key={`home-missing-${index}`}
                  >
                    <input
                      className="text-input"
                      value={player.name}
                      placeholder="Player/name"
                      onChange={(event) =>
                        updateMissingPlayer(
                          "homeMissingPlayers",
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      className="text-input"
                      value={player.role}
                      placeholder="Role"
                      onChange={(event) =>
                        updateMissingPlayer(
                          "homeMissingPlayers",
                          index,
                          "role",
                          event.target.value,
                        )
                      }
                    />
                    <select
                      value={player.importance}
                      onChange={(event) =>
                        updateMissingPlayer(
                          "homeMissingPlayers",
                          index,
                          "importance",
                          event.target.value as PlayerImportance,
                        )
                      }
                    >
                      <option value="backup">Backup</option>
                      <option value="rotation">Rotation</option>
                      <option value="starter">Starter</option>
                      <option value="key">Key</option>
                      <option value="critical">Critical</option>
                    </select>
                    <select
                      value={player.reason}
                      onChange={(event) =>
                        updateMissingPlayer(
                          "homeMissingPlayers",
                          index,
                          "reason",
                          event.target.value as AbsenceReason,
                        )
                      }
                    >
                      <option value="injury">Injury</option>
                      <option value="suspension">Suspension</option>
                      <option value="unavailable">Unavailable</option>
                      <option value="doubtful">Doubtful</option>
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={player.expectedStarter}
                        onChange={(event) =>
                          updateMissingPlayer(
                            "homeMissingPlayers",
                            index,
                            "expectedStarter",
                            event.target.checked,
                          )
                        }
                      />{" "}
                      Starter
                    </label>
                  </div>
                ))}
              </div>
              <div className="availability-panel">
                <h4>{activeFixture.awayTeam}</h4>
                {activeFixture.awayMissingPlayers.map((player, index) => (
                  <div
                    className="availability-row"
                    key={`away-missing-${index}`}
                  >
                    <input
                      className="text-input"
                      value={player.name}
                      placeholder="Player/name"
                      onChange={(event) =>
                        updateMissingPlayer(
                          "awayMissingPlayers",
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      className="text-input"
                      value={player.role}
                      placeholder="Role"
                      onChange={(event) =>
                        updateMissingPlayer(
                          "awayMissingPlayers",
                          index,
                          "role",
                          event.target.value,
                        )
                      }
                    />
                    <select
                      value={player.importance}
                      onChange={(event) =>
                        updateMissingPlayer(
                          "awayMissingPlayers",
                          index,
                          "importance",
                          event.target.value as PlayerImportance,
                        )
                      }
                    >
                      <option value="backup">Backup</option>
                      <option value="rotation">Rotation</option>
                      <option value="starter">Starter</option>
                      <option value="key">Key</option>
                      <option value="critical">Critical</option>
                    </select>
                    <select
                      value={player.reason}
                      onChange={(event) =>
                        updateMissingPlayer(
                          "awayMissingPlayers",
                          index,
                          "reason",
                          event.target.value as AbsenceReason,
                        )
                      }
                    >
                      <option value="injury">Injury</option>
                      <option value="suspension">Suspension</option>
                      <option value="unavailable">Unavailable</option>
                      <option value="doubtful">Doubtful</option>
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={player.expectedStarter}
                        onChange={(event) =>
                          updateMissingPlayer(
                            "awayMissingPlayers",
                            index,
                            "expectedStarter",
                            event.target.checked,
                          )
                        }
                      />{" "}
                      Starter
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Context / Motivation Inputs</h3>
            <p className="section-help">
              Tick the context factors that apply. Positive urgency boosts a
              side; rotation, distraction, safety and fatigue reduce its
              motivation edge. Match-level volatility adds review caution
              without automatically picking a side.
            </p>
            <div className="context-grid">
              <div className="context-panel">
                <h4>{activeFixture.homeTeam}</h4>
                {teamContextFields.map((field) => (
                  <label
                    className="context-row"
                    key={`home-context-${field.key}`}
                  >
                    <input
                      type="checkbox"
                      checked={activeFixture.homeContext[field.key]}
                      onChange={(event) =>
                        updateTeamContext(
                          "homeContext",
                          field.key,
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      <strong>{field.label}</strong>
                      <em>{field.helper}</em>
                    </span>
                  </label>
                ))}
              </div>
              <div className="context-panel">
                <h4>{activeFixture.awayTeam}</h4>
                {teamContextFields.map((field) => (
                  <label
                    className="context-row"
                    key={`away-context-${field.key}`}
                  >
                    <input
                      type="checkbox"
                      checked={activeFixture.awayContext[field.key]}
                      onChange={(event) =>
                        updateTeamContext(
                          "awayContext",
                          field.key,
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      <strong>{field.label}</strong>
                      <em>{field.helper}</em>
                    </span>
                  </label>
                ))}
              </div>
              <div className="context-panel match-context-panel">
                <h4>Match volatility</h4>
                {matchContextFields.map((field) => (
                  <label
                    className="context-row"
                    key={`match-context-${field.key}`}
                  >
                    <input
                      type="checkbox"
                      checked={activeFixture.matchContext[field.key]}
                      onChange={(event) =>
                        updateMatchContext(field.key, event.target.checked)
                      }
                    />
                    <span>
                      <strong>{field.label}</strong>
                      <em>{field.helper}</em>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Context Gate Evidence</h3>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Home Context</span>
                <strong>{signed(context.homeContextScore)}</strong>
              </div>
              <div className="mini-metric">
                <span>Away Context</span>
                <strong>{signed(context.awayContextScore)}</strong>
              </div>
              <div className="mini-metric">
                <span>Raw Gap</span>
                <strong>{signed(context.rawContextGap)}</strong>
              </div>
              <div className="mini-metric">
                <span>Motivation Edge</span>
                <strong>{signed(context.motivationEdge)}</strong>
              </div>
              <div className="mini-metric">
                <span>Volatility</span>
                <strong>{context.volatilityScore}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {context.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {context.warnings.length > 0 ? (
              <div className="warning-box slim">
                <strong>Context warnings</strong>
                <ul>
                  {context.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Availability Gate Evidence</h3>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Home Impact</span>
                <strong>{availability.homeImpact}</strong>
              </div>
              <div className="mini-metric">
                <span>Away Impact</span>
                <strong>{availability.awayImpact}</strong>
              </div>
              <div className="mini-metric">
                <span>Raw Gap</span>
                <strong>{signed(availability.rawAvailabilityGap)}</strong>
              </div>
              <div className="mini-metric">
                <span>Availability Risk</span>
                <strong>{signed(availability.injuryRisk)}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {availability.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Form Gate Evidence</h3>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Home Form</span>
                <strong>{form.homeFormScore}/100</strong>
              </div>
              <div className="mini-metric">
                <span>Away Form</span>
                <strong>{form.awayFormScore}/100</strong>
              </div>
              <div className="mini-metric">
                <span>Raw Form Gap</span>
                <strong>{signed(form.rawFormGap)}</strong>
              </div>
              <div className="mini-metric">
                <span>Form Gap</span>
                <strong>{signed(form.recentFormGap)}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {form.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Quality Gate Evidence</h3>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Home Overall</span>
                <strong>{quality.homeOverallStrength}/100</strong>
              </div>
              <div className="mini-metric">
                <span>Home Venue</span>
                <strong>{quality.homeVenueStrength}/100</strong>
              </div>
              <div className="mini-metric">
                <span>Away Overall</span>
                <strong>{quality.awayOverallStrength}/100</strong>
              </div>
              <div className="mini-metric">
                <span>Away Venue</span>
                <strong>{quality.awayVenueStrength}/100</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {quality.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Odds / External Sanity Check Inputs</h3>
            <p className="section-help">
              Enter an external 1X2 probability estimate. This can come from a
              market consensus, an odds feed later, or your own external sanity
              check. It confirms or cautions; it should not replace the evidence
              gates.
            </p>
            <div className="two-col">
              <label>
                <span>Source label</span>
                <input
                  className="text-input"
                  value={activeFixture.oddsMarket.sourceLabel}
                  onChange={(event) =>
                    updateOddsMarket("sourceLabel", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Home win probability %</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  max={100}
                  value={activeFixture.oddsMarket.homeWinProbability}
                  onChange={(event) =>
                    updateOddsMarket(
                      "homeWinProbability",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label>
                <span>Draw probability %</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  max={100}
                  value={activeFixture.oddsMarket.drawProbability}
                  onChange={(event) =>
                    updateOddsMarket(
                      "drawProbability",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label>
                <span>Away win probability %</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  max={100}
                  value={activeFixture.oddsMarket.awayWinProbability}
                  onChange={(event) =>
                    updateOddsMarket(
                      "awayWinProbability",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Odds Gate Evidence</h3>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Home %</span>
                <strong>{odds.homeProbability}%</strong>
              </div>
              <div className="mini-metric">
                <span>Draw %</span>
                <strong>{odds.drawProbability}%</strong>
              </div>
              <div className="mini-metric">
                <span>Away %</span>
                <strong>{odds.awayProbability}%</strong>
              </div>
              <div className="mini-metric">
                <span>Favourite</span>
                <strong>{odds.externalFavourite}</strong>
              </div>
              <div className="mini-metric">
                <span>Margin</span>
                <strong>{odds.favouriteMargin}</strong>
              </div>
              <div className="mini-metric">
                <span>Odds Support</span>
                <strong>{signed(odds.oddsSupport)}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {odds.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {odds.warnings.length > 0 ? (
              <div className="warning-box slim">
                <strong>Odds warnings</strong>
                <ul>
                  {odds.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Conflict Gate Evidence</h3>
            <p className="section-help">
              The Conflict Score is calculated from contradictions across the
              gates. It is the MS-AES-style blocker that prevents an otherwise
              high edge from becoming an overconfident tip.
            </p>
            <div className="evidence-grid">
              <div className="mini-metric">
                <span>Conflict Score</span>
                <strong>{conflict.conflictScore}/5</strong>
              </div>
              <div className="mini-metric">
                <span>Level</span>
                <strong>{conflict.conflictLevel}</strong>
              </div>
              <div className="mini-metric">
                <span>Blockers</span>
                <strong>{conflict.failedSignals}</strong>
              </div>
              <div className="mini-metric">
                <span>Cautions</span>
                <strong>{conflict.cautionSignals}</strong>
              </div>
            </div>
            <ul className="evidence-list">
              {conflict.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {conflict.blockers.length > 0 ? (
              <div className="warning-box slim">
                <strong>Conflict blockers</strong>
                <ul>
                  {conflict.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {conflict.warnings.length > conflict.blockers.length ? (
              <div className="note-box">
                <strong>Conflict cautions</strong>
                <ul>
                  {conflict.warnings
                    .filter((warning) => !conflict.blockers.includes(warning))
                    .map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="card" style={{ marginBottom: 18 }}>
            <h3>Remaining Manual Gate Inputs</h3>
            {manualScoreDefinitions.map((definition) => (
              <div className="score-row" key={definition.key}>
                <div className="score-label">
                  <strong>{definition.label}</strong>
                  <span>
                    {definition.helper} Range: {definition.min} to{" "}
                    {definition.max}
                  </span>
                </div>
                <input
                  className="score-input"
                  type="number"
                  min={definition.min}
                  max={definition.max}
                  step={1}
                  value={activeFixture.scores[definition.key]}
                  onChange={(event) =>
                    updateScore(definition.key, Number(event.target.value))
                  }
                />
              </div>
            ))}
            <div className="actions">
              <button className="secondary" onClick={resetFixture}>
                Reset selected fixture
              </button>
            </div>
          </section>

          <section className="card">
            <h3>Prediction Gates</h3>
            <div className="gate-list">
              {result.gates.map((gate) => (
                <div className="gate" key={gate.id}>
                  <span
                    className={`dot ${gate.status === "pass" ? "pass" : ""}`}
                  />
                  <div>
                    <div className="gate-name">{gate.name}</div>
                    <div className="gate-note">{gate.note}</div>
                  </div>
                  <strong>{gate.status.toUpperCase()}</strong>
                </div>
              ))}
            </div>

            {result.warnings.length > 0 ? (
              <div className="warning-box">
                <strong>Warnings</strong>
                <ul>
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="note-box">
                No warnings. This fixture currently has a clean gate profile.
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
