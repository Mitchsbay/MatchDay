import { useEffect, useMemo, useState } from "react";
import type {
  TennisFormResult,
  TennisFormGapResult,
  TennisManualFactors,
  TennisPlayerSummary,
  TennisPredictionResult,
  TennisQualityResult,
  TennisServeGapResult,
  TennisServeStats,
  TennisTour,
} from "../lib/tennisScoringEngine";

function verdictTone(prediction: string): "good" | "warn" | "bad" {
  if (prediction === "Review Required") return "bad";
  if (prediction === "Too Close to Call") return "warn";
  return "good";
}

type MatchupResponse = {
  ok: boolean;
  error?: string;
  playerA: TennisPlayerSummary;
  playerB: TennisPlayerSummary;
  playerARecentForm: TennisFormResult[];
  playerBRecentForm: TennisFormResult[];
  quality: TennisQualityResult;
  form: TennisFormGapResult;
  serve: TennisServeGapResult;
  prediction: TennisPredictionResult;
};

function PlayerPicker(props: {
  label: string;
  players: TennisPlayerSummary[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (player: TennisPlayerSummary | null) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? props.players.filter((player) => player.name.toLowerCase().includes(term))
      : props.players;
    return base.slice(0, 50);
  }, [props.players, search]);

  return (
    <div className="field-row">
      <label style={{ flex: 1 }}>
        {props.label}
        <input
          className="text-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={props.isLoading ? "Loading players…" : "Type to search…"}
          disabled={props.isLoading}
        />
      </label>
      <label style={{ flex: 1 }}>
        {"\u00A0"}
        <select
          value={props.selectedId ?? ""}
          onChange={(event) => {
            const id = Number(event.target.value);
            props.onSelect(props.players.find((player) => player.id === id) ?? null);
          }}
          disabled={props.isLoading || filtered.length === 0}
        >
          <option value="" disabled>
            {filtered.length === 0 ? "No matches" : "Select player…"}
          </option>
          {filtered.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name} (#{player.currentRank ?? "—"})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function TennisQuickPredictionPanel() {
  const [tour, setTour] = useState<TennisTour>("atp");
  const [players, setPlayers] = useState<TennisPlayerSummary[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersMessage, setPlayersMessage] = useState("");
  const [playerA, setPlayerA] = useState<TennisPlayerSummary | null>(null);
  const [playerB, setPlayerB] = useState<TennisPlayerSummary | null>(null);
  const [headToHeadEdge, setHeadToHeadEdge] = useState(0);
  const [otherFactorsEdge, setOtherFactorsEdge] = useState(0);
  const emptyServeStats: TennisServeStats = { firstServeInPct: 0, firstServeWinPct: 0, secondServeWinPct: 0 };
  const [serveStatsA, setServeStatsA] = useState<TennisServeStats>(emptyServeStats);
  const [serveStatsB, setServeStatsB] = useState<TennisServeStats>(emptyServeStats);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState("");
  const [result, setResult] = useState<MatchupResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingPlayers(true);
    setPlayerA(null);
    setPlayerB(null);
    setResult(null);
    fetch(`/api/tennis/players?tour=${tour}`)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        if (!payload.ok) {
          setPlayersMessage(payload.error ?? "Could not load players.");
          setPlayers([]);
          return;
        }
        setPlayers(payload.players ?? []);
        setPlayersMessage(`Loaded ${payload.players?.length ?? 0} ${tour.toUpperCase()} players.`);
      })
      .catch((err) => {
        if (!cancelled) setPlayersMessage(err instanceof Error ? err.message : "Could not load players.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlayers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tour]);

  async function getPrediction() {
    if (!playerA || !playerB) {
      setPredictionMessage("Select both players first.");
      return;
    }
    if (playerA.id === playerB.id) {
      setPredictionMessage("Player A and Player B can't be the same player.");
      return;
    }

    setIsPredicting(true);
    setPredictionMessage("");
    try {
      const manual: TennisManualFactors = { headToHeadEdge, otherFactorsEdge };
      const hasServeStatsA = serveStatsA.firstServeInPct > 0 || serveStatsA.firstServeWinPct > 0 || serveStatsA.secondServeWinPct > 0;
      const hasServeStatsB = serveStatsB.firstServeInPct > 0 || serveStatsB.firstServeWinPct > 0 || serveStatsB.secondServeWinPct > 0;
      const res = await fetch("/api/tennis/matchup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tour,
          playerA,
          playerB,
          manual,
          serveStatsA: hasServeStatsA ? serveStatsA : undefined,
          serveStatsB: hasServeStatsB ? serveStatsB : undefined,
        }),
      });
      const payload = (await res.json()) as MatchupResponse;
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Prediction failed with HTTP ${res.status}`);
      }
      setResult(payload);
    } catch (err) {
      setPredictionMessage(err instanceof Error ? err.message : "Unknown error getting prediction.");
      setResult(null);
    } finally {
      setIsPredicting(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>Tennis Quick Prediction</h2>
      <p className="section-help">
        Rankings and recent form come automatically from the Matchstat Tennis API — no manual data
        entry needed for those two. Head-to-head and other factors stay manual for now, same as any
        gate without an automated source. Odds aren&apos;t available on the free tier, so there&apos;s
        no Odds Gate here yet.
      </p>
      <div className="field-row">
        <label>Tour
          <select value={tour} onChange={(event) => setTour(event.target.value as TennisTour)}>
            <option value="atp">ATP (men&apos;s)</option>
            <option value="wta">WTA (women&apos;s)</option>
          </select>
        </label>
      </div>
      {playersMessage && <p className="section-help">{playersMessage}</p>}

      <PlayerPicker
        label="Player A"
        players={players}
        isLoading={isLoadingPlayers}
        selectedId={playerA?.id ?? null}
        onSelect={setPlayerA}
      />
      <PlayerPicker
        label="Player B"
        players={players}
        isLoading={isLoadingPlayers}
        selectedId={playerB?.id ?? null}
        onSelect={setPlayerB}
      />

      <div className="field-row">
        <label>Manual head-to-head edge
          <input
            type="number"
            value={headToHeadEdge}
            onChange={(event) => setHeadToHeadEdge(Math.max(-10, Math.min(10, Number(event.target.value))))}
          />
        </label>
        <label>Manual other factors edge
          <input
            type="number"
            value={otherFactorsEdge}
            onChange={(event) => setOtherFactorsEdge(Math.max(-10, Math.min(10, Number(event.target.value))))}
          />
        </label>
      </div>

      <p className="section-help">
        Serve Gate: fetched automatically from career serve stats (no surface breakdown available on
        this endpoint — one number covering a player&apos;s whole career). Leave the fields below at 0
        to use the automatic numbers; fill them in only if you want to override with fresher or
        surface-specific stats from elsewhere.
      </p>
      <div className="field-row">
        <label>{playerA?.name ?? "Player A"} 1st serve in %
          <input
            type="number"
            value={serveStatsA.firstServeInPct}
            onChange={(event) => setServeStatsA({ ...serveStatsA, firstServeInPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
        <label>1st serve win %
          <input
            type="number"
            value={serveStatsA.firstServeWinPct}
            onChange={(event) => setServeStatsA({ ...serveStatsA, firstServeWinPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
        <label>2nd serve win %
          <input
            type="number"
            value={serveStatsA.secondServeWinPct}
            onChange={(event) => setServeStatsA({ ...serveStatsA, secondServeWinPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
      </div>
      <div className="field-row">
        <label>{playerB?.name ?? "Player B"} 1st serve in %
          <input
            type="number"
            value={serveStatsB.firstServeInPct}
            onChange={(event) => setServeStatsB({ ...serveStatsB, firstServeInPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
        <label>1st serve win %
          <input
            type="number"
            value={serveStatsB.firstServeWinPct}
            onChange={(event) => setServeStatsB({ ...serveStatsB, firstServeWinPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
        <label>2nd serve win %
          <input
            type="number"
            value={serveStatsB.secondServeWinPct}
            onChange={(event) => setServeStatsB({ ...serveStatsB, secondServeWinPct: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </label>
      </div>

      <div className="actions">
        <button className="primary" onClick={getPrediction} disabled={isPredicting || !playerA || !playerB}>
          {isPredicting ? "Working…" : "Get prediction"}
        </button>
      </div>

      {predictionMessage && <div className="warning-box slim">{predictionMessage}</div>}

      {result && (
        <div className={`verdict-card verdict-${verdictTone(result.prediction.prediction)}`}>
          <div className="verdict-label">{result.playerA.name} vs {result.playerB.name}</div>
          <div className="verdict-outcome">{result.prediction.prediction}</div>
          <div className="verdict-confidence">{result.prediction.confidence}% confidence</div>
          <div className="verdict-warning">
            {result.playerA.name}: rank {result.playerA.currentRank ?? "—"}, form{" "}
            {result.playerARecentForm.join("-") || "n/a"} · {result.playerB.name}: rank{" "}
            {result.playerB.currentRank ?? "—"}, form {result.playerBRecentForm.join("-") || "n/a"}
            {result.serve.serveGap !== 0 && (
              <> · Serve gap {result.serve.serveGap >= 0 ? "+" : ""}{result.serve.serveGap} ({result.serve.playerAServeScore} vs {result.serve.playerBServeScore})</>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
