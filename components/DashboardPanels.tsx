"use client";

import type { Entrant } from "../lib/sampleData";
import type { EvidenceAuditSummary, FixtureEvidenceAudit } from "../lib/evidenceAudit";
import type { RuleWeights } from "../lib/scoringEngine";
import { ruleWeightDefinitions } from "../lib/scoringEngine";
import { signed } from "../lib/uiFormat";

type LeaderboardEntry = Entrant & { submitted: number; settled: number; correct: number; pending: number; points: number; hitRate: number; averageConfidence: number };

function auditStatusBadge(status: FixtureEvidenceAudit["status"]) {
  if (status === "ready") return <span className="badge good">Ready</span>;
  if (status === "review") return <span className="badge warn">Review</span>;
  return <span className="badge bad">Incomplete</span>;
}

export function EvidenceReadinessPanel(props: { summary: EvidenceAuditSummary; selectedRoundLabel: string }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P23 Evidence Readiness Audit</h3>
      <p className="section-help">Checks whether each fixture has enough raw evidence behind the gates before you trust the model output. This does not change the prediction; it flags missing inputs before they quietly weaken confidence.</p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Fixtures Checked</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">Avg Completeness</div><div className="value">{summary.averageCompleteness}%</div></div>
        <div className="metric"><div className="label">Ready</div><div className="value">{summary.readyFixtures}</div></div>
        <div className="metric"><div className="label">Review</div><div className="value">{summary.reviewFixtures}</div></div>
        <div className="metric"><div className="label">Incomplete</div><div className="value">{summary.incompleteFixtures}</div></div>
      </div>
      <div className="note-box">Selected view: {props.selectedRoundLabel}. Quality and form are usually API/CSV-ready; availability, context and odds often still need human review.</div>
      {summary.fixturesNeedingAttention.length > 0 ? (
        <div className="learning-table">
          <div className="learning-row header-row"><span>Fixture</span><span>Status</span><span>Complete</span><span>Top issue</span><span>Source</span></div>
          {summary.fixturesNeedingAttention.map((audit) => (
            <div className="learning-row" key={audit.fixtureId}>
              <span>{audit.fixtureLabel}</span>
              <span>{auditStatusBadge(audit.status)}</span>
              <span>{audit.completenessScore}%</span>
              <span>{audit.blockers[0] ?? audit.warnings[0] ?? "No major issue"}</span>
              <span>{audit.sourceSummary}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="note-box">All fixtures in this view have enough evidence for normal review.</div>
      )}
    </section>
  );
}

export function AccuracyDashboard(props: { accuracySummary: any; selectedRoundAccuracySummary: any; selectedRoundLabel: string }) {
  const { accuracySummary, selectedRoundAccuracySummary, selectedRoundLabel } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Accuracy Dashboard</h3>
      <p className="section-help">Overall competition results, plus selected-round results for the current round filter.</p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Final Fixtures</div><div className="value">{accuracySummary.finalFixtures}</div></div>
        <div className="metric"><div className="label">Published Tips</div><div className="value">{accuracySummary.publishedTips}</div></div>
        <div className="metric"><div className="label">Correct Tips</div><div className="value">{accuracySummary.correctTips}</div></div>
        <div className="metric"><div className="label">Hit Rate</div><div className="value">{accuracySummary.hitRate}%</div></div>
        <div className="metric"><div className="label">Review / No Tip</div><div className="value">{accuracySummary.reviewOrNoTips}</div></div>
        <div className="metric"><div className="label">Pending</div><div className="value">{accuracySummary.pendingFixtures}</div></div>
        <div className="metric"><div className="label">Points</div><div className="value">{accuracySummary.totalPoints}</div></div>
        <div className="metric"><div className="label">Avg Confidence</div><div className="value">{accuracySummary.averageConfidence}%</div></div>
      </div>
      <div className="note-box">Selected round: {selectedRoundLabel} · Published tips {selectedRoundAccuracySummary.publishedTips} · Correct {selectedRoundAccuracySummary.correctTips} · Hit rate {selectedRoundAccuracySummary.hitRate}%.</div>
    </section>
  );
}

export function LeaderboardPanel(props: { leaderboard: LeaderboardEntry[]; selectedRoundLabel: string }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P16 Competition Leaderboard</h3>
      <p className="section-help">Add entrants, record their fixture picks, then enter final scores. The leaderboard now follows the round filter: {props.selectedRoundLabel}. Correct home/away picks earn 1 point and correct draws earn 2 points.</p>
      <div className="leaderboard-table">
        <div className="leaderboard-row header-row"><span>Rank</span><span>Entrant</span><span>Points</span><span>Correct</span><span>Hit rate</span><span>Pending</span><span>Avg conf.</span></div>
        {props.leaderboard.map((entrant, index) => (
          <div className="leaderboard-row" key={entrant.id}><span>#{index + 1}</span><span>{entrant.name}</span><span>{entrant.points}</span><span>{entrant.correct}/{entrant.settled}</span><span>{entrant.hitRate}%</span><span>{entrant.pending}</span><span>{entrant.averageConfidence}%</span></div>
        ))}
      </div>
      <div className="note-box">Competition data and the selected round view are included in browser autosave, JSON backup and Supabase workspace save/load.</div>
    </section>
  );
}

export function RuleLearningPanel(props: { ruleLearning: any }) {
  const { ruleLearning } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>Rule Learning Dashboard</h3>
      <p className="section-help">P10 reviews settled results against each gate and lets you adjust rule weights manually. The changes are live in this browser session and do not rewrite the engine defaults.</p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Settled Fixtures</div><div className="value">{ruleLearning.settledFixtures}</div></div>
        <div className="metric"><div className="label">Learned Tips</div><div className="value">{ruleLearning.publishedTips}</div></div>
        <div className="metric"><div className="label">Review Holds</div><div className="value">{ruleLearning.reviewFixtures}</div></div>
        <div className="metric"><div className="label">Best Gate</div><div className="value small-value">{ruleLearning.bestGateName}</div></div>
      </div>
      <div className="learning-table">
        <div className="learning-row header-row"><span>Gate</span><span>Pass hit</span><span>Fail hit</span><span>Review flags</span><span>Recommendation</span></div>
        {ruleLearning.learningItems.map((gate: any) => (
          <div className="learning-row" key={gate.gateId}><span>{gate.gateName}</span><span>{gate.passHitRate}% ({gate.passCorrectTips}/{gate.passPublishedTips})</span><span>{gate.failHitRate}% ({gate.failCorrectTips}/{gate.failPublishedTips})</span><span>{gate.reviewFlags}</span><span>{gate.recommendation}</span></div>
        ))}
      </div>
      <ul className="evidence-list">{ruleLearning.insights.map((insight: string) => <li key={insight}>{insight}</li>)}</ul>
    </section>
  );
}

export function RuleWeightTuningPanel(props: { ruleWeights: RuleWeights; quality: any; conflict: any; onUpdateWeight: (key: keyof RuleWeights, value: number) => void; onResetWeights: () => void }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P10 Rule Weight Tuning Panel</h3>
      <p className="section-help">Adjust how much each gate contributes to the final edge and review decision. This is a live sandbox setting, so you can test the model before making any permanent engine change.</p>
      <div className="weight-grid">
        {ruleWeightDefinitions.map((definition) => (
          <div className="weight-row" key={definition.key}>
            <div><strong>{definition.label}</strong><span>{definition.helper}</span></div>
            <input type="range" min={definition.min} max={definition.max} step={definition.step} value={props.ruleWeights[definition.key]} onChange={(event) => props.onUpdateWeight(definition.key, Number(event.target.value))} />
            <input className="score-input small-input" type="number" min={definition.min} max={definition.max} step={definition.step} value={props.ruleWeights[definition.key]} onChange={(event) => props.onUpdateWeight(definition.key, Number(event.target.value))} />
          </div>
        ))}
      </div>
      <div className="note-box">Current final edge uses weighted evidence. For example, Quality Gap {signed(props.quality.qualityGap)} × {props.ruleWeights.qualityGap} and Conflict Score {props.conflict.conflictScore} × {props.ruleWeights.conflictScore} are included in the displayed Home Edge.</div>
      <div className="actions"><button className="secondary" onClick={props.onResetWeights}>Reset weights to defaults</button></div>
    </section>
  );
}
