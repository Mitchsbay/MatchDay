import { ALL_ROUNDS } from "../lib/workspace";

type AccuracySummary = {
  finalFixtures: number;
  hitRate: number;
};

type RoundManagementProps = {
  selectedRound: string;
  selectedRoundLabel: string;
  roundNames: string[];
  visibleFixtureCount: number;
  selectedRoundAccuracySummary: AccuracySummary;
  onAddRound: () => void;
  onSelectRound: (round: string) => void;
};

export function RoundManagement({
  selectedRound,
  selectedRoundLabel,
  roundNames,
  visibleFixtureCount,
  selectedRoundAccuracySummary,
  onAddRound,
  onSelectRound,
}: RoundManagementProps) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Round filter</h3>
      <p className="section-help">
        Filter Tip Now by round. The larger round-card grid has been removed so this stays compact.
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
