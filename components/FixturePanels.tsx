"use client";

import type { Entrant, Fixture, TipPick, UserTip } from "../lib/sampleData";
import type { FixtureEvidenceAudit } from "../lib/evidenceAudit";
import type { MatchResultInput } from "../lib/scoringEngine";
import { accuracyBadge, gateBadge, outcomeLabel, signed } from "../lib/uiFormat";
import { getTipFor } from "../lib/workspace";

export function PredictionSummaryPanel(props: { fixture: Fixture; result: any; quality: any; form: any; availability: any; context: any; odds: any; conflict: any; accuracy: any; evidenceAudit: FixtureEvidenceAudit }) {
  const { fixture, result, quality, form, availability, context, odds, conflict, accuracy, evidenceAudit } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2>{fixture.homeTeam} vs {fixture.awayTeam}</h2>
      <div className="result-grid">
        <div className="metric"><div className="label">Prediction</div><div className="value">{result.prediction}</div></div>
        <div className="metric"><div className="label">Home Edge</div><div className="value">{signed(result.homeEdge)}</div></div>
        <div className="metric"><div className="label">Quality Gap</div><div className="value">{signed(quality.qualityGap)}</div></div>
        <div className="metric"><div className="label">Form Gap</div><div className="value">{signed(form.recentFormGap)}</div></div>
        <div className="metric"><div className="label">Availability Risk</div><div className="value">{signed(availability.injuryRisk)}</div></div>
        <div className="metric"><div className="label">Motivation Edge</div><div className="value">{signed(context.motivationEdge)}</div></div>
        <div className="metric"><div className="label">Odds Support</div><div className="value">{signed(odds.oddsSupport)}</div></div>
        <div className="metric"><div className="label">Conflict</div><div className="value">{conflict.conflictScore}/5</div></div>
        <div className="metric"><div className="label">Confidence</div><div className="value">{result.confidence}%</div></div>
        <div className="metric"><div className="label">Actual Outcome</div><div className="value">{outcomeLabel(accuracy.actualOutcome)}</div></div>
        <div className="metric"><div className="label">Accuracy</div><div className="value" style={{ fontSize: 15 }}>{accuracyBadge(accuracy.isCorrect, accuracy.isSettled, accuracy.isTipPublished)}</div></div>
      </div>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Home Match Strength</div><div className="value">{quality.homeMatchStrength}</div></div>
        <div className="metric"><div className="label">Away Match Strength</div><div className="value">{quality.awayMatchStrength}</div></div>
        <div className="metric"><div className="label">Raw Strength Gap</div><div className="value">{signed(quality.rawStrengthGap)}</div></div>
        <div className="metric"><div className="label">Gate Status</div><div className="value" style={{ fontSize: 15 }}>{gateBadge(result.gateStatus)}</div></div>
      </div>
      <div className="note-box"><strong>Gate logic:</strong> Quality comes from team stats, form comes from recent results, availability comes from missing-player impact, motivation comes from structured context flags, and odds support comes from external 1X2 probabilities.</div>
      <div className="warning-box slim">
        <strong>Evidence readiness:</strong> {evidenceAudit.completenessScore}% · {evidenceAudit.status.toUpperCase()} · {evidenceAudit.sourceSummary}
        {evidenceAudit.blockers.length > 0 ? <div style={{ marginTop: 8 }}>Top blocker: {evidenceAudit.blockers[0]}</div> : null}
        {evidenceAudit.blockers.length === 0 && evidenceAudit.warnings.length > 0 ? <div style={{ marginTop: 8 }}>Top warning: {evidenceAudit.warnings[0]}</div> : null}
      </div>
    </section>
  );
}

export function FixtureDetailsPanel(props: { fixture: Fixture; onUpdateField: (key: keyof Pick<Fixture, "homeTeam" | "awayTeam" | "competition" | "round" | "date">, value: string) => void }) {
  const { fixture } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Fixture Details</h3>
      <div className="two-col">
        <label><span>Home Team</span><input className="text-input" value={fixture.homeTeam} onChange={(event) => props.onUpdateField("homeTeam", event.target.value)} /></label>
        <label><span>Away Team</span><input className="text-input" value={fixture.awayTeam} onChange={(event) => props.onUpdateField("awayTeam", event.target.value)} /></label>
        <label><span>Competition</span><input className="text-input" value={fixture.competition} onChange={(event) => props.onUpdateField("competition", event.target.value)} /></label>
        <label><span>Round</span><input className="text-input" value={fixture.round} onChange={(event) => props.onUpdateField("round", event.target.value)} /></label>
        <label><span>Date</span><input className="text-input" value={fixture.date} onChange={(event) => props.onUpdateField("date", event.target.value)} /></label>
      </div>
    </section>
  );
}

export function EntrantsPicksPanel(props: { fixture: Fixture; entrants: Entrant[]; userTips: UserTip[]; accuracy: any; onUpdateEntrantName: (entrantId: string, name: string) => void; onUpdateUserTip: (entrantId: string, key: keyof UserTip, value: string | number) => void; onAddEntrant: () => void }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P14 Entrants + Picks</h3>
      <p className="section-help">Record each entrant’s tip for the selected fixture. These picks are separate from the model prediction, so the app can run both the prediction engine and the actual tipping competition.</p>
      <div className="entrant-list">
        {props.entrants.map((entrant) => {
          const tip = getTipFor(props.userTips, props.fixture.id, entrant.id);
          return (
            <div className="entrant-row" key={entrant.id}>
              <input className="text-input" value={entrant.name} onChange={(event) => props.onUpdateEntrantName(entrant.id, event.target.value)} />
              <select value={tip?.pick ?? "home"} onChange={(event) => props.onUpdateUserTip(entrant.id, "pick", event.target.value as TipPick)}><option value="home">Home win</option><option value="draw">Draw</option><option value="away">Away win</option></select>
              <input type="number" min={0} max={100} className="score-input" value={tip?.confidence ?? 50} onChange={(event) => props.onUpdateUserTip(entrant.id, "confidence", Number(event.target.value))} />
              <span className="fixture-meta">confidence</span>
            </div>
          );
        })}
      </div>
      <div className="actions"><button className="secondary" onClick={props.onAddEntrant}>Add entrant</button></div>
      <div className="note-box">Final score for this fixture: {outcomeLabel(props.accuracy.actualOutcome)}. Correct draw picks are worth 2 points because they are harder to land.</div>
    </section>
  );
}

export function ResultInputsPanel(props: { fixture: Fixture; accuracy: any; onUpdateMatchResult: (key: keyof MatchResultInput, value: number | string) => void }) {
  const { fixture, accuracy } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Result / Accuracy Inputs</h3>
      <p className="section-help">Enter the final score after the match. The app maps the prediction to home/draw/away and records whether the published tip was correct.</p>
      <div className="two-col">
        <label><span>Result status</span><select className="text-input" value={fixture.matchResult.status} onChange={(event) => props.onUpdateMatchResult("status", event.target.value)}><option value="pending">Pending</option><option value="final">Final</option></select></label>
        <label><span>Predicted outcome</span><input className="text-input" value={outcomeLabel(accuracy.predictedOutcome)} readOnly /></label>
        <label><span>{fixture.homeTeam} goals</span><input className="text-input" type="number" min={0} value={fixture.matchResult.homeGoals} onChange={(event) => props.onUpdateMatchResult("homeGoals", Number(event.target.value))} /></label>
        <label><span>{fixture.awayTeam} goals</span><input className="text-input" type="number" min={0} value={fixture.matchResult.awayGoals} onChange={(event) => props.onUpdateMatchResult("awayGoals", Number(event.target.value))} /></label>
      </div>
      <div className="evidence-grid" style={{ marginTop: 14 }}>
        <div className="mini-metric"><span>Actual</span><strong>{outcomeLabel(accuracy.actualOutcome)}</strong></div>
        <div className="mini-metric"><span>Predicted</span><strong>{outcomeLabel(accuracy.predictedOutcome)}</strong></div>
        <div className="mini-metric"><span>Counted Tip</span><strong>{accuracy.isTipPublished ? "Yes" : "No"}</strong></div>
        <div className="mini-metric"><span>Points</span><strong>{accuracy.pointsAwarded}</strong></div>
      </div>
      <ul className="evidence-list">{accuracy.evidence.map((item: string) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
