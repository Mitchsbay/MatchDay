import type { Fixture, FixtureBetLog, TipPick } from "../lib/sampleData";
import { getActualOutcomeFromScore } from "../lib/workspace";
import { calculateBetPayout, parseFractionalOdds } from "../lib/bankroll";

function outcomeLabel(outcome: TipPick | "pending"): string {
  if (outcome === "home") return "Home";
  if (outcome === "draw") return "Draw";
  if (outcome === "away") return "Away";
  return "Pending";
}

export function BetLoggingPanel(props: {
  fixture: Fixture;
  onUpdateBetLog: (betLog: FixtureBetLog | undefined) => void;
}) {
  const betLog = props.fixture.betLog ?? { outcomeBacked: "home" as TipPick, odds: "", stake: 0 };
  const actualOutcome = getActualOutcomeFromScore(props.fixture.matchResult);
  const calculated = calculateBetPayout({
    odds: betLog.odds,
    stake: betLog.stake,
    outcomeBacked: betLog.outcomeBacked,
    actualOutcome,
  });
  const oddsAreValid = !betLog.odds.trim() || parseFractionalOdds(betLog.odds) !== null;

  function update(next: Partial<FixtureBetLog>) {
    props.onUpdateBetLog({
      outcomeBacked: betLog.outcomeBacked,
      odds: betLog.odds,
      stake: betLog.stake,
      ...next,
    });
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>My Bet Log</h2>
      <p className="section-help">
        Log your own bet for this fixture. This is separate from Result / Accuracy Inputs, which still controls the actual match result used by the prediction model.
      </p>
      <div className="field-row">
        <label>
          Outcome backed
          <select value={betLog.outcomeBacked} onChange={(event) => update({ outcomeBacked: event.target.value as TipPick })}>
            <option value="home">Home</option>
            <option value="draw">Draw</option>
            <option value="away">Away</option>
          </select>
        </label>
        <label>
          Odds
          <input
            className="text-input"
            value={betLog.odds}
            placeholder="3:1"
            onChange={(event) => update({ odds: event.target.value })}
          />
        </label>
        <label>
          Stake
          <input
            className="text-input"
            type="number"
            min={0}
            step="0.01"
            value={betLog.stake}
            onChange={(event) => update({ stake: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
      </div>
      {!oddsAreValid && <div className="warning-box slim">Use fractional odds like 3:1 or 7/2.</div>}
      <div className="note-box slim">
        Actual result: {outcomeLabel(actualOutcome)} · Settlement: {calculated.settlement} · Payout: {calculated.payout >= 0 ? "+" : ""}${calculated.payout.toFixed(2)}
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => props.onUpdateBetLog(undefined)}>Clear bet log</button>
      </div>
    </section>
  );
}
