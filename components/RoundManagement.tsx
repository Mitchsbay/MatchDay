import { ALL_ROUNDS } from "../lib/workspace";

type RoundSummary = {
  roundName: string;
  fixtures: number;
  pendingFixtures: number;
  published: number;
  hitRate: number;
};

type AccuracySummary = {
  finalFixtures: number;
  hitRate: number;
};

type RoundManagementProps = {
  selectedRound: string;
  selectedRoundLabel: string;
  roundNames: string[];
  roundSummaries: RoundSummary[];
  visibleFixtureCount: number;
  selectedRoundAccuracySummary: AccuracySummary;
  onAddRound: () => void;
  onSelectRound: (round: string) => void;
};

export function RoundManagement({
  selectedRound,
  selectedRoundLabel,
  roundNames,
  roundSummaries,
  visibleFixtureCount,
  selectedRoundAccuracySummary,
  onAddRound,
  onSelectRound,
}: RoundManagementProps) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P16 Round Management</h3>
      <p className="section-help">
        Group fixtures by round, filter the workspace, and view the leaderboard
        for the selected round or the full competition.
      </p>
      <div className="field-row">
        <label>
          Round filter
          <select
            className="text-input"
            value={selectedRound}
            onChange={(event) => onSelectRound(event.target.value)}
          >
            <option value={ALL_ROUNDS}>All rounds</option>
            {roundNames.map((roundName) => (
              <option key={roundName} value={roundName}>
                {roundName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="result-grid compact">
        <div className="metric">
          <div className="label">Current View</div>
          <div className="value small-value">{selectedRoundLabel}</div>
        </div>
        <div className="metric">
          <div className="label">Visible Fixtures</div>
          <div className="value">{visibleFixtureCount}</div>
        </div>
        <div className="metric">
          <div className="label">Final in View</div>
          <div className="value">{selectedRoundAccuracySummary.finalFixtures}</div>
        </div>
        <div className="metric">
          <div className="label">Published Hit Rate</div>
          <div className="value">{selectedRoundAccuracySummary.hitRate}%</div>
        </div>
      </div>
      <div className="round-summary-grid">
        {roundSummaries.map((summary) => (
          <button
            key={summary.roundName}
            className={`round-card ${selectedRound === summary.roundName ? "active" : ""}`}
            onClick={() => onSelectRound(summary.roundName)}
          >
            <strong>{summary.roundName}</strong>
            <span>{summary.fixtures} fixtures · {summary.pendingFixtures} pending</span>
            <span>{summary.published} published · {summary.hitRate}% hit rate</span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => onSelectRound(ALL_ROUNDS)}>
          Show all rounds
        </button>
        <button className="secondary" onClick={onAddRound}>
          Add new round
        </button>
      </div>
    </section>
  );
}
