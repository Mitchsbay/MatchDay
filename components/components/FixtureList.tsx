import { Fixture } from "../lib/sampleData";
import { signed, outcomeLabel } from "../lib/uiFormat";
import { calculateFixturePrediction } from "../hooks/usePredictionModel";

type FixturePredictionItem = ReturnType<typeof calculateFixturePrediction> & {
  fixture: Fixture;
};

type FixtureListProps = {
  activeFixtureId: string;
  fixtureCount: number;
  selectedRoundLabel: string;
  visibleFixtureResults: FixturePredictionItem[];
  onSelectFixture: (fixtureId: string) => void;
};

export function FixtureList({
  activeFixtureId,
  fixtureCount,
  selectedRoundLabel,
  visibleFixtureResults,
  onSelectFixture,
}: FixtureListProps) {
  return (
    <aside className="card">
      <h2>Fixtures</h2>
      <p className="section-help">
        Showing {visibleFixtureResults.length} of {fixtureCount} fixtures · {selectedRoundLabel}
      </p>
      <div className="fixture-list">
        {visibleFixtureResults.map(({ fixture, quality, form, availability, context, odds, conflict, prediction, accuracy }) => (
          <button
            key={fixture.id}
            className={`fixture-btn ${fixture.id === activeFixtureId ? "active" : ""}`}
            onClick={() => onSelectFixture(fixture.id)}
          >
            <strong>
              {fixture.homeTeam} vs {fixture.awayTeam}
            </strong>
            <div className="fixture-meta">
              {fixture.competition} · {fixture.round} · {fixture.date}
            </div>
            <div className="fixture-meta">
              Quality {signed(quality.qualityGap)} · Form {signed(form.recentFormGap)} · Avail{" "}
              {signed(availability.injuryRisk)} · Context {signed(context.motivationEdge)} · Odds{" "}
              {signed(odds.oddsSupport)} · Conflict {conflict.conflictScore}/5 · Edge{" "}
              {signed(prediction.homeEdge)} · {prediction.prediction}
            </div>
            <div className="fixture-meta">
              Result: {outcomeLabel(accuracy.actualOutcome)} · Accuracy:{" "}
              {accuracy.isCorrect === null
                ? "Pending / not counted"
                : accuracy.isCorrect
                  ? "Correct"
                  : "Missed"}
            </div>
          </button>
        ))}
        {visibleFixtureResults.length === 0 ? (
          <div className="note-box">No fixtures in this round yet. Add a fixture or show all rounds.</div>
        ) : null}
      </div>
    </aside>
  );
}
