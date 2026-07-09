"use client";

import type { Fixture } from "../lib/sampleData";
import type {
  AbsenceReason,
  MatchContext,
  MatchScores,
  MissingPlayer,
  OddsMarket,
  PlayerImportance,
  RecentFormGame,
  RecentResult,
  TeamContext,
  TeamStats,
} from "../lib/scoringEngine";
import { manualScoreDefinitions } from "../lib/scoringEngine";
import { matchContextFields, statFields, teamContextFields } from "../lib/fieldDefinitions";
import { signed } from "../lib/uiFormat";

export function TeamStrengthInputsPanel(props: { fixture: Fixture; onUpdateStats: (side: "homeStats" | "awayStats", key: keyof TeamStats, value: number) => void }) {
  const renderStats = (side: "homeStats" | "awayStats", teamName: string) => (
    <div className="stats-panel">
      <h4>{teamName}</h4>
      {statFields.map((field) => (
        <label className="stat-row" key={`${side}-${field.key}`}>
          <span><strong>{field.label}</strong><em>{field.helper}</em></span>
          <input type="number" min={0} value={props.fixture[side][field.key]} onChange={(event) => props.onUpdateStats(side, field.key, Number(event.target.value))} />
        </label>
      ))}
    </div>
  );

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Team Strength Inputs</h3>
      <p className="section-help">These raw numbers create the Quality Gap automatically. You no longer need to guess the team strength score.</p>
      <div className="stats-grid">
        {renderStats("homeStats", props.fixture.homeTeam)}
        {renderStats("awayStats", props.fixture.awayTeam)}
      </div>
    </section>
  );
}

export function RecentFormInputsPanel(props: { fixture: Fixture; onUpdateRecentForm: (side: "homeRecentForm" | "awayRecentForm", index: number, key: keyof RecentFormGame, value: number | RecentResult) => void }) {
  const renderForm = (side: "homeRecentForm" | "awayRecentForm", teamName: string) => (
    <div className="form-panel">
      <h4>{teamName}</h4>
      {props.fixture[side].map((game, index) => (
        <div className="form-row" key={`${side}-${index}`}>
          <span>Game {index + 1}</span>
          <select value={game.result} onChange={(event) => props.onUpdateRecentForm(side, index, "result", event.target.value as RecentResult)}><option value="W">W</option><option value="D">D</option><option value="L">L</option></select>
          <input type="number" min={0} value={game.goalsFor} onChange={(event) => props.onUpdateRecentForm(side, index, "goalsFor", Number(event.target.value))} aria-label={`${side} recent goals for`} />
          <input type="number" min={0} value={game.goalsAgainst} onChange={(event) => props.onUpdateRecentForm(side, index, "goalsAgainst", Number(event.target.value))} aria-label={`${side} recent goals against`} />
        </div>
      ))}
      <div className="form-hint">Columns: result, GF, GA</div>
    </div>
  );

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Recent Form Inputs</h3>
      <p className="section-help">Enter the latest 5 results for each team. Points and recent goal difference create the Recent Form Gap automatically.</p>
      <div className="form-grid">
        {renderForm("homeRecentForm", props.fixture.homeTeam)}
        {renderForm("awayRecentForm", props.fixture.awayTeam)}
      </div>
    </section>
  );
}

export function AvailabilityInputsPanel(props: { fixture: Fixture; onUpdateMissingPlayer: (side: "homeMissingPlayers" | "awayMissingPlayers", index: number, key: keyof MissingPlayer, value: string | boolean) => void }) {
  const renderPlayers = (side: "homeMissingPlayers" | "awayMissingPlayers", teamName: string) => (
    <div className="availability-panel">
      <h4>{teamName}</h4>
      {props.fixture[side].map((player, index) => (
        <div className="availability-row" key={`${side}-${index}`}>
          <input className="text-input" value={player.name} placeholder="Player/name" onChange={(event) => props.onUpdateMissingPlayer(side, index, "name", event.target.value)} />
          <input className="text-input" value={player.role} placeholder="Role" onChange={(event) => props.onUpdateMissingPlayer(side, index, "role", event.target.value)} />
          <select value={player.importance} onChange={(event) => props.onUpdateMissingPlayer(side, index, "importance", event.target.value as PlayerImportance)}><option value="backup">Backup</option><option value="rotation">Rotation</option><option value="starter">Starter</option><option value="key">Key</option><option value="critical">Critical</option></select>
          <select value={player.reason} onChange={(event) => props.onUpdateMissingPlayer(side, index, "reason", event.target.value as AbsenceReason)}><option value="injury">Injury</option><option value="suspension">Suspension</option><option value="unavailable">Unavailable</option><option value="doubtful">Doubtful</option></select>
          <label className="check-label"><input type="checkbox" checked={player.expectedStarter} onChange={(event) => props.onUpdateMissingPlayer(side, index, "expectedStarter", event.target.checked)} /> Starter</label>
        </div>
      ))}
    </div>
  );

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Availability Inputs</h3>
      <p className="section-help">Enter missing or doubtful players. Importance, reason and expected-starter status create Availability Risk automatically.</p>
      <div className="availability-grid">
        {renderPlayers("homeMissingPlayers", props.fixture.homeTeam)}
        {renderPlayers("awayMissingPlayers", props.fixture.awayTeam)}
      </div>
    </section>
  );
}

export function ContextInputsPanel(props: { fixture: Fixture; onUpdateTeamContext: (side: "homeContext" | "awayContext", key: keyof TeamContext, value: boolean) => void; onUpdateMatchContext: (key: keyof MatchContext, value: boolean) => void }) {
  const renderTeamContext = (side: "homeContext" | "awayContext", teamName: string) => (
    <div className="context-panel">
      <h4>{teamName}</h4>
      {teamContextFields.map((field) => (
        <label className="context-row" key={`${side}-${field.key}`}>
          <input type="checkbox" checked={props.fixture[side][field.key]} onChange={(event) => props.onUpdateTeamContext(side, field.key, event.target.checked)} />
          <span><strong>{field.label}</strong><em>{field.helper}</em></span>
        </label>
      ))}
    </div>
  );

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Context / Motivation Inputs</h3>
      <p className="section-help">Tick the context factors that apply. Positive urgency boosts a side; match-level volatility adds review caution without automatically picking a side.</p>
      <div className="context-grid">
        {renderTeamContext("homeContext", props.fixture.homeTeam)}
        {renderTeamContext("awayContext", props.fixture.awayTeam)}
        <div className="context-panel match-context-panel">
          <h4>Match volatility</h4>
          {matchContextFields.map((field) => (
            <label className="context-row" key={`match-${field.key}`}>
              <input type="checkbox" checked={props.fixture.matchContext[field.key]} onChange={(event) => props.onUpdateMatchContext(field.key, event.target.checked)} />
              <span><strong>{field.label}</strong><em>{field.helper}</em></span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OddsInputsPanel(props: { fixture: Fixture; onUpdateOddsMarket: (key: keyof OddsMarket, value: number | string) => void }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Odds / External Sanity Check Inputs</h3>
      <p className="section-help">Enter an external 1X2 probability estimate. It confirms or cautions; it should not replace the evidence gates.</p>
      <div className="two-col">
        <label><span>Source label</span><input className="text-input" value={props.fixture.oddsMarket.sourceLabel} onChange={(event) => props.onUpdateOddsMarket("sourceLabel", event.target.value)} /></label>
        <label><span>Home win probability %</span><input className="text-input" type="number" min={0} max={100} value={props.fixture.oddsMarket.homeWinProbability} onChange={(event) => props.onUpdateOddsMarket("homeWinProbability", Number(event.target.value))} /></label>
        <label><span>Draw probability %</span><input className="text-input" type="number" min={0} max={100} value={props.fixture.oddsMarket.drawProbability} onChange={(event) => props.onUpdateOddsMarket("drawProbability", Number(event.target.value))} /></label>
        <label><span>Away win probability %</span><input className="text-input" type="number" min={0} max={100} value={props.fixture.oddsMarket.awayWinProbability} onChange={(event) => props.onUpdateOddsMarket("awayWinProbability", Number(event.target.value))} /></label>
      </div>
    </section>
  );
}

function EvidenceList({ items }: { items: string[] }) {
  return <ul className="evidence-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function GateEvidencePanels(props: { quality: any; form: any; availability: any; context: any; odds: any; conflict: any; probabilities: any }) {
  const { quality, form, availability, context, odds, conflict, probabilities } = props;
  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Context Gate Evidence</h3>
        <div className="evidence-grid"><div className="mini-metric"><span>Home Context</span><strong>{signed(context.homeContextScore)}</strong></div><div className="mini-metric"><span>Away Context</span><strong>{signed(context.awayContextScore)}</strong></div><div className="mini-metric"><span>Raw Gap</span><strong>{signed(context.rawContextGap)}</strong></div><div className="mini-metric"><span>Motivation Edge</span><strong>{signed(context.motivationEdge)}</strong></div><div className="mini-metric"><span>Volatility</span><strong>{context.volatilityScore}</strong></div></div>
        <EvidenceList items={context.evidence} />
        {context.warnings.length > 0 ? <div className="warning-box slim"><strong>Context warnings</strong><ul>{context.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Availability Gate Evidence</h3>
        <div className="evidence-grid"><div className="mini-metric"><span>Home Impact</span><strong>{availability.homeImpact}</strong></div><div className="mini-metric"><span>Away Impact</span><strong>{availability.awayImpact}</strong></div><div className="mini-metric"><span>Raw Gap</span><strong>{signed(availability.rawAvailabilityGap)}</strong></div><div className="mini-metric"><span>Availability Risk</span><strong>{signed(availability.injuryRisk)}</strong></div></div>
        <EvidenceList items={availability.evidence} />
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Form Gate Evidence</h3>
        <div className="evidence-grid"><div className="mini-metric"><span>Home Form</span><strong>{form.homeFormScore}/100</strong></div><div className="mini-metric"><span>Away Form</span><strong>{form.awayFormScore}/100</strong></div><div className="mini-metric"><span>Raw Form Gap</span><strong>{signed(form.rawFormGap)}</strong></div><div className="mini-metric"><span>Form Gap</span><strong>{signed(form.recentFormGap)}</strong></div></div>
        <EvidenceList items={form.evidence} />
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Quality Gate Evidence</h3>
        <div className="evidence-grid"><div className="mini-metric"><span>Home Overall</span><strong>{quality.homeOverallStrength}/100</strong></div><div className="mini-metric"><span>Home Venue</span><strong>{quality.homeVenueStrength}/100</strong></div><div className="mini-metric"><span>Away Overall</span><strong>{quality.awayOverallStrength}/100</strong></div><div className="mini-metric"><span>Away Venue</span><strong>{quality.awayVenueStrength}/100</strong></div></div>
        <EvidenceList items={quality.evidence} />
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Odds Gate Evidence</h3>
        <div className="evidence-grid"><div className="mini-metric"><span>Home %</span><strong>{odds.homeProbability}%</strong></div><div className="mini-metric"><span>Draw %</span><strong>{odds.drawProbability}%</strong></div><div className="mini-metric"><span>Away %</span><strong>{odds.awayProbability}%</strong></div><div className="mini-metric"><span>Favourite</span><strong>{odds.externalFavourite}</strong></div><div className="mini-metric"><span>Margin</span><strong>{odds.favouriteMargin}</strong></div><div className="mini-metric"><span>Odds Support</span><strong>{signed(odds.oddsSupport)}</strong></div></div>
        <EvidenceList items={odds.evidence} />
        {odds.warnings.length > 0 ? <div className="warning-box slim"><strong>Odds warnings</strong><ul>{odds.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3>P28 Outcome Probability Evidence</h3>
        <p className="section-help">Estimated Home/Draw/Away probabilities are generated after the gates have run. They translate the weighted edge and conflict pressure into a clearer outcome split.</p>
        <div className="evidence-grid"><div className="mini-metric"><span>Home</span><strong>{probabilities.home}%</strong></div><div className="mini-metric"><span>Draw</span><strong>{probabilities.draw}%</strong></div><div className="mini-metric"><span>Away</span><strong>{probabilities.away}%</strong></div><div className="mini-metric"><span>Favourite</span><strong>{probabilities.favourite}</strong></div><div className="mini-metric"><span>Spread</span><strong>{probabilities.spread}</strong></div><div className="mini-metric"><span>Band</span><strong>{probabilities.confidenceBand}</strong></div></div>
        <EvidenceList items={probabilities.evidence} />
        {probabilities.warnings.length > 0 ? <div className="warning-box slim"><strong>Probability warnings</strong><ul>{probabilities.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Conflict Gate Evidence</h3>
        <p className="section-help">The Conflict Score is calculated from contradictions across the gates. It prevents a high edge from becoming an overconfident tip.</p>
        <div className="evidence-grid"><div className="mini-metric"><span>Conflict Score</span><strong>{conflict.conflictScore}/5</strong></div><div className="mini-metric"><span>Level</span><strong>{conflict.conflictLevel}</strong></div><div className="mini-metric"><span>Blockers</span><strong>{conflict.failedSignals}</strong></div><div className="mini-metric"><span>Cautions</span><strong>{conflict.cautionSignals}</strong></div></div>
        <EvidenceList items={conflict.evidence} />
        {conflict.blockers.length > 0 ? <div className="warning-box slim"><strong>Conflict blockers</strong><ul>{conflict.blockers.map((blocker: string) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
        {conflict.warnings.length > conflict.blockers.length ? <div className="note-box"><strong>Conflict cautions</strong><ul>{conflict.warnings.filter((warning: string) => !conflict.blockers.includes(warning)).map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      </section>
    </>
  );
}

export function ManualGateInputsPanel(props: { scores: MatchScores; onUpdateScore: (key: keyof MatchScores, value: number) => void; onResetFixture: () => void }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Remaining Manual Gate Inputs</h3>
      {manualScoreDefinitions.map((definition) => (
        <div className="score-row" key={definition.key}>
          <div className="score-label"><strong>{definition.label}</strong><span>{definition.helper} Range: {definition.min} to {definition.max}</span></div>
          <input className="score-input" type="number" min={definition.min} max={definition.max} step={1} value={props.scores[definition.key]} onChange={(event) => props.onUpdateScore(definition.key, Number(event.target.value))} />
        </div>
      ))}
      <div className="actions"><button className="secondary" onClick={props.onResetFixture}>Reset selected fixture</button></div>
    </section>
  );
}

export function PredictionGatesPanel(props: { result: any }) {
  return (
    <section className="card">
      <h3>Prediction Gates</h3>
      <div className="gate-list">
        {props.result.gates.map((gate: any) => (
          <div className="gate" key={gate.id}><span className={`dot ${gate.status === "pass" ? "pass" : ""}`} /><div><div className="gate-name">{gate.name}</div><div className="gate-note">{gate.note}</div></div><strong>{gate.status.toUpperCase()}</strong></div>
        ))}
      </div>
      {props.result.warnings.length > 0 ? <div className="warning-box"><strong>Warnings</strong><ul>{props.result.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : <div className="note-box">No warnings. This fixture currently has a clean gate profile.</div>}
    </section>
  );
}
