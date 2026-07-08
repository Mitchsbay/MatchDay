import { useMemo, useState } from "react";
import type { Fixture } from "../lib/sampleData";
import type { PredictionResult } from "../lib/scoringEngine";
import {
  findFixtureForMatchup,
  getAvailableCompetitions,
  getAwayTeamsForMatchup,
  getTeamsForCompetition,
} from "../lib/quickPrediction";

function verdictTone(prediction: string): "good" | "warn" | "bad" {
  if (prediction === "Review Required") return "bad";
  if (prediction === "Draw / Low Confidence") return "warn";
  return "good";
}

export function QuickPredictionPanel(props: {
  fixtures: Fixture[];
  onMatchupFound: (fixtureId: string) => void;
  activeFixture: Fixture;
  result: PredictionResult;
}) {
  const competitions = useMemo(() => getAvailableCompetitions(props.fixtures), [props.fixtures]);
  const [competition, setCompetition] = useState(competitions[0] ?? "");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");

  const homeTeams = useMemo(
    () => getTeamsForCompetition(props.fixtures, competition),
    [props.fixtures, competition],
  );
  const awayTeams = useMemo(
    () => (homeTeam ? getAwayTeamsForMatchup(props.fixtures, competition, homeTeam) : []),
    [props.fixtures, competition, homeTeam],
  );

  const matchedFixture = useMemo(
    () =>
      homeTeam && awayTeam
        ? findFixtureForMatchup(props.fixtures, competition, homeTeam, awayTeam)
        : undefined,
    [props.fixtures, competition, homeTeam, awayTeam],
  );

  const isShowingMatch = matchedFixture && matchedFixture.id === props.activeFixture.id;

  function handleCompetitionChange(value: string) {
    setCompetition(value);
    setHomeTeam("");
    setAwayTeam("");
  }

  function handleHomeTeamChange(value: string) {
    setHomeTeam(value);
    setAwayTeam("");
  }

  function handleAwayTeamChange(value: string) {
    setAwayTeam(value);
    const match = findFixtureForMatchup(props.fixtures, competition, homeTeam, value);
    if (match) props.onMatchupFound(match.id);
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>Quick Prediction</h2>
      <p className="section-help">
        Pick a competition and the two teams. If that matchup is in your fixture list already
        (manually added, imported, generated, or pulled from the live fixture cache), the tip
        below updates automatically.
      </p>
      <div className="field-row">
        <label>
          Competition
          <select value={competition} onChange={(event) => handleCompetitionChange(event.target.value)}>
            <option value="" disabled>Select a competition…</option>
            {competitions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Home team
          <select value={homeTeam} onChange={(event) => handleHomeTeamChange(event.target.value)} disabled={!competition}>
            <option value="" disabled>Select home team…</option>
            {homeTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </label>
        <label>
          Away team
          <select value={awayTeam} onChange={(event) => handleAwayTeamChange(event.target.value)} disabled={!homeTeam}>
            <option value="" disabled>Select away team…</option>
            {awayTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </label>
      </div>

      {homeTeam && awayTeam && !matchedFixture && (
        <div className="warning-box slim">
          No fixture between {homeTeam} and {awayTeam} in {competition} is in your workspace yet.
          Fetch live fixtures, import a CSV, or generate fixtures for this competition first.
        </div>
      )}

      {isShowingMatch && (
        <div className={`verdict-card verdict-${verdictTone(props.result.prediction)}`}>
          <div className="verdict-label">{props.activeFixture.homeTeam} vs {props.activeFixture.awayTeam}</div>
          <div className="verdict-outcome">{props.result.prediction}</div>
          <div className="verdict-confidence">{props.result.confidence}% confidence</div>
          {props.result.warnings.length > 0 && (
            <div className="verdict-warning">{props.result.warnings[0]}</div>
          )}
        </div>
      )}
    </section>
  );
}
