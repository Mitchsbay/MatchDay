import { useMemo } from "react";
import type { Fixture } from "../lib/sampleData";
import type { PredictionResult } from "../lib/scoringEngine";

function verdictTone(prediction: string): "good" | "warn" | "bad" {
  if (prediction === "Review Required") return "bad";
  if (prediction === "Draw / Low Confidence") return "warn";
  return "good";
}

export function QuickPredictionPanel(props: {
  fixtures: Fixture[];
  filteredFixtureCount: number;
  selectedCompetition: string;
  activeFixture: Fixture;
  result: PredictionResult;
  onCompetitionChange: (competition: string) => void;
}) {
  const competitions = useMemo(
    () => Array.from(new Set(props.fixtures.map((fixture) => fixture.competition).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [props.fixtures],
  );

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>Tip Now</h2>
      <p className="section-help">
        Pick a competition to filter the fixtures list on the left. This uses the fixtures already loaded in your workspace from sheet imports, manual entry, generated rounds, or API fetches.
      </p>
      <div className="field-row">
        <label>
          Competition
          <select value={props.selectedCompetition} onChange={(event) => props.onCompetitionChange(event.target.value)}>
            <option value="">All competitions</option>
            {competitions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="note-box slim">
        Showing {props.filteredFixtureCount} fixture{props.filteredFixtureCount === 1 ? "" : "s"}
        {props.selectedCompetition ? ` for ${props.selectedCompetition}` : " across all competitions"}. Select any fixture on the left to use the same gates, signals, and evidence panels below.
      </div>
      <div className={`verdict-card verdict-${verdictTone(props.result.prediction)}`}>
        <div className="verdict-label">{props.activeFixture.homeTeam} vs {props.activeFixture.awayTeam}</div>
        <div className="verdict-outcome">{props.result.prediction}</div>
        <div className="verdict-confidence">{props.result.confidence}% confidence</div>
        {props.result.warnings.length > 0 && (
          <div className="verdict-warning">{props.result.warnings[0]}</div>
        )}
      </div>
    </section>
  );
}
