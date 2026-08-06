import type { BankrollRow } from "../lib/bankroll";

function money(value: number): string {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function outcomeLabel(outcome: string): string {
  if (outcome === "home") return "Home";
  if (outcome === "draw") return "Draw";
  if (outcome === "away") return "Away";
  return outcome;
}

export function BankrollPanel(props: { rows: BankrollRow[] }) {
  const settledRows = props.rows.filter((row) => row.settlement !== "pending");
  const totalStaked = props.rows.reduce((sum, row) => sum + row.stake, 0);
  const settledTotal = props.rows.at(-1)?.rollingTotal ?? 0;

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>My Bankroll</h2>
      <p className="section-help">
        Logged bets appear here automatically from each fixture. Win/Loss and payout are calculated from the fixture result once Result / Accuracy Inputs are marked final.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Logged Bets</div><div className="value">{props.rows.length}</div></div>
        <div className="metric"><div className="label">Settled Bets</div><div className="value">{settledRows.length}</div></div>
        <div className="metric"><div className="label">Total Staked</div><div className="value small-value">${totalStaked.toFixed(2)}</div></div>
        <div className="metric"><div className="label">Rolling Total</div><div className="value small-value">{money(settledTotal)}</div></div>
      </div>
      <div className="bankroll-table">
        <div className="bankroll-row header-row">
          <span>Competition</span><span>Match</span><span>Date / Time</span><span>Outcome backed</span><span>Odds</span><span>Stake</span><span>Win/Loss</span><span>Payout</span><span>Rolling total</span>
        </div>
        {props.rows.map((row) => (
          <div className="bankroll-row" key={row.fixtureId}>
            <span>{row.competition}</span>
            <span>{row.match}</span>
            <span>{row.date}</span>
            <span>{outcomeLabel(row.outcomeBacked)}</span>
            <span>{row.odds}</span>
            <span>${row.stake.toFixed(2)}</span>
            <span>{row.settlement === "pending" ? "Pending" : row.settlement === "win" ? "Win" : "Loss"}</span>
            <span>{money(row.payout)}</span>
            <span>{money(row.rollingTotal)}</span>
          </div>
        ))}
        {props.rows.length === 0 && <div className="note-box">No bets logged yet. Open Tip Now, select a fixture, and fill in My Bet Log.</div>}
      </div>
    </section>
  );
}
