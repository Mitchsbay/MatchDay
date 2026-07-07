"use client";

import { useMemo, useState } from "react";
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
import { WorkspacePersistencePanel, CloudSyncPanel, FixtureCsvPanel } from "../components/WorkspacePanels";
import { AccuracyDashboard, LeaderboardPanel, RuleLearningPanel, RuleWeightTuningPanel } from "../components/DashboardPanels";
import { PredictionSummaryPanel, FixtureDetailsPanel, EntrantsPicksPanel, ResultInputsPanel } from "../components/FixturePanels";
import { TeamStrengthInputsPanel, RecentFormInputsPanel, AvailabilityInputsPanel, ContextInputsPanel, OddsInputsPanel, GateEvidencePanels, ManualGateInputsPanel, PredictionGatesPanel } from "../components/EvidenceInputPanels";
import {
  ALL_ROUNDS,
  calculateTipPoints,
  cloneEntrants,
  cloneFixtures,
  cloneUserTips,
  createBlankFixture,
  getActualOutcomeFromScore,
  getTipFor,
  normaliseRound,
} from "../lib/workspace";
import { exportFixturesToCsv, importFixturesFromCsv } from "../lib/csvWorkspace";

export default function Home() {
  const [fixtures, setFixtures] = useState<Fixture[]>(() => cloneFixtures(initialFixtures));
  const [activeFixtureId, setActiveFixtureId] = useState(fixtures[0]?.id ?? "");
  const [selectedRound, setSelectedRound] = useState<string>(ALL_ROUNDS);
  const [ruleWeights, setRuleWeights] = useState<RuleWeights>(() => ({ ...defaultRuleWeights }));
  const [entrants, setEntrants] = useState<Entrant[]>(() => cloneEntrants(initialEntrants));
  const [userTips, setUserTips] = useState<UserTip[]>(() => cloneUserTips(initialUserTips));
  const [csvMessage, setCsvMessage] = useState("CSV import/export has not run yet.");

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

  function importFixturesCsv(csv: string, mode: "append" | "replace") {
    const importResult = importFixturesFromCsv(csv);
    if (importResult.fixtures.length === 0) {
      setCsvMessage(importResult.warnings.join(" ") || "CSV import failed: no valid fixtures found.");
      return;
    }

    setFixtures((current) =>
      mode === "replace" ? importResult.fixtures : [...importResult.fixtures, ...current],
    );
    setActiveFixtureId(importResult.fixtures[0].id);
    setSelectedRound(normaliseRound(importResult.fixtures[0].round));
    setCsvMessage(
      `Imported ${importResult.fixtures.length} fixtures from CSV using ${mode} mode.${
        importResult.warnings.length ? ` Warnings: ${importResult.warnings.join(" ")}` : ""
      }`,
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
          <div className="eyebrow">Tipping Gates App · P19</div>
          <h1>Evidence-based tipping gates with CSV fixture workflows.</h1>
          <p className="lead">
            P19 adds spreadsheet-friendly fixture import/export, so rounds, fixtures,
            team-stat evidence, recent form, market probabilities and results can be
            managed in bulk without losing the gated prediction workflow.
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

      <section className="grid">
        <FixtureList
          activeFixtureId={activeFixture.id}
          fixtureCount={fixtures.length}
          selectedRoundLabel={selectedRoundLabel}
          visibleFixtureResults={visibleFixtureResults}
          onSelectFixture={setActiveFixtureId}
        />

        <div>
          <WorkspacePersistencePanel
            storageMessage={storageMessage}
            lastSavedAt={lastSavedAt}
            fixtureCount={fixtures.length}
            onExportBackup={exportWorkspaceBackup}
            onImportBackup={importWorkspaceBackup}
            onResetSamples={resetWorkspaceToSamples}
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
          <AccuracyDashboard
            accuracySummary={accuracySummary}
            selectedRoundAccuracySummary={selectedRoundAccuracySummary}
            selectedRoundLabel={selectedRoundLabel}
          />
          <LeaderboardPanel leaderboard={leaderboard} selectedRoundLabel={selectedRoundLabel} />
          <RuleLearningPanel ruleLearning={ruleLearning} />
          <RuleWeightTuningPanel
            ruleWeights={ruleWeights}
            quality={quality}
            conflict={conflict}
            onUpdateWeight={updateRuleWeight}
            onResetWeights={resetRuleWeights}
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
          />
          <FixtureDetailsPanel fixture={activeFixture} onUpdateField={updateFixtureField} />
          <EntrantsPicksPanel
            fixture={activeFixture}
            entrants={entrants}
            userTips={userTips}
            accuracy={accuracy}
            onUpdateEntrantName={updateEntrantName}
            onUpdateUserTip={updateUserTip}
            onAddEntrant={addEntrant}
          />
          <ResultInputsPanel fixture={activeFixture} accuracy={accuracy} onUpdateMatchResult={updateMatchResult} />
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
          <PredictionGatesPanel result={result} />
        </div>
      </section>
    </main>
  );
}
