"use client";

import type { EvidenceAuditSummary, FixtureEvidenceAudit } from "../lib/evidenceAudit";
import type { RuleWeights } from "../lib/scoringEngine";
import type { CompetitionInsights } from "../lib/competitionInsights";
import type { ProbabilityCalibrationSummary } from "../lib/probabilityCalibration";
import type { ModelTuningSummary, TuningRecommendationPriority } from "../lib/modelTuningRecommendations";
import type { TuningSandboxComparison } from "../lib/tuningSandbox";
import type { TuningPreset } from "../lib/tuningPresets";
import type { ModelChangeLogSummary, ModelChangeLogEntry } from "../lib/modelChangeLog";
import type { ModelVersionComparisonSummary, ModelVersionComparisonTarget } from "../lib/modelVersionComparison";
import type { ReleaseChecklistSummary, ReleaseCheckStatus } from "../lib/releaseChecklist";
import type { CompetitionDataQualitySummary, CompetitionDataQualitySeverity } from "../lib/competitionDataQuality";
import { getPresetWeightChangeCount } from "../lib/tuningPresets";
import { ruleWeightDefinitions } from "../lib/scoringEngine";
import { signed } from "../lib/uiFormat";


function auditStatusBadge(status: FixtureEvidenceAudit["status"]) {
  if (status === "ready") return <span className="badge good">Ready</span>;
  if (status === "review") return <span className="badge warn">Review</span>;
  return <span className="badge bad">Incomplete</span>;
}

function StandingsTable(props: { rows: CompetitionInsights["resultStandings"]; emptyLabel: string; showSourceCount?: boolean }) {
  if (props.rows.length === 0) return <div className="note-box">{props.emptyLabel}</div>;
  return (
    <div className="table-wrap">
      <table className="mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>Pts</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>PPG</th>
            <th>Home</th>
            <th>Away</th>
            {props.showSourceCount && <th>Sources</th>}
            <th>Form</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={`${row.team}-${index}`}>
              <td>{index + 1}</td>
              <td><strong>{row.team}</strong></td>
              <td>{row.played}</td>
              <td><strong>{row.points}</strong></td>
              <td>{row.wins}</td>
              <td>{row.draws}</td>
              <td>{row.losses}</td>
              <td>{row.goalsFor}</td>
              <td>{row.goalsAgainst}</td>
              <td>{signed(row.goalDifference)}</td>
              <td>{row.pointsPerGame.toFixed(2)}</td>
              <td>{row.homePlayed ? `${row.homePoints}/${row.homePlayed}` : "—"}</td>
              <td>{row.awayPlayed ? `${row.awayPoints}/${row.awayPlayed}` : "—"}</td>
              {props.showSourceCount && <td>{row.sourceCount ?? 0}</td>}
              <td>{row.form || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompetitionInsightsPanel(props: {
  insights: CompetitionInsights;
}) {
  const { insights } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P27 Results History + Standings View</h3>
      <p className="section-help">
        Review the imported competition before trusting predictions. The results-derived table is calculated from final fixture scores in the workspace; the imported evidence table shows the latest team-stat snapshot supplied by your Teams sheet or fixture evidence.
      </p>
      <div className="result-grid compact" style={{ marginTop: 12 }}>
        <div className="metric"><div className="label">Fixtures</div><div className="value">{insights.fixtureCount}</div></div>
        <div className="metric"><div className="label">Final results</div><div className="value">{insights.finalResultCount}</div></div>
        <div className="metric"><div className="label">Pending</div><div className="value">{insights.pendingFixtureCount}</div></div>
        <div className="metric"><div className="label">Teams</div><div className="value">{insights.teamCount}</div></div>
      </div>
      {insights.warnings.length > 0 && (
        <div className="warning-list">
          {insights.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
      <h4>Results-derived standings</h4>
      <StandingsTable rows={insights.resultStandings} emptyLabel="No final scores have been imported for this competition yet." />
      <h4>Imported team evidence snapshot</h4>
      <StandingsTable rows={insights.evidenceStandings} emptyLabel="No team evidence stats are available yet. Import a Teams + Fixtures workbook or prediction-ready file with team stats." showSourceCount />
      <h4>Recent final results</h4>
      {insights.recentResults.length === 0 ? (
        <div className="note-box">No final result rows found yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead><tr><th>Date</th><th>Round</th><th>Match</th><th>Score</th></tr></thead>
            <tbody>
              {insights.recentResults.map((result) => (
                <tr key={result.fixtureId}>
                  <td>{result.date}</td>
                  <td>{result.round}</td>
                  <td>{result.homeTeam} vs {result.awayTeam}</td>
                  <td><strong>{result.homeGoals}–{result.awayGoals}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


function dataQualityStatusBadge(status: CompetitionDataQualitySummary["status"]) {
  if (status === "healthy") return <span className="badge good">Healthy</span>;
  if (status === "review") return <span className="badge warn">Review</span>;
  return <span className="badge bad">Needs work</span>;
}

function dataQualitySeverityBadge(severity: CompetitionDataQualitySeverity) {
  if (severity === "blocker") return <span className="badge bad">Blocker</span>;
  if (severity === "warning") return <span className="badge warn">Warning</span>;
  return <span className="badge">Info</span>;
}

export function CompetitionDataQualityPanel(props: { summary: CompetitionDataQualitySummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P37 Competition Data Quality Dashboard</h3>
      <p className="section-help">
        Checks the selected competition for data-quality problems before you trust the predictions or run weekly updates. This panel is read-only and does not change fixtures, aliases, tennis, probabilities, or model weights.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Competition</div><div className="value small-value">{summary.competition || "—"}</div></div>
        <div className="metric"><div className="label">Quality score</div><div className="value">{summary.dataQualityScore}%</div></div>
        <div className="metric"><div className="label">Status</div><div className="value small-value">{dataQualityStatusBadge(summary.status)}</div></div>
        <div className="metric"><div className="label">Evidence avg.</div><div className="value">{summary.averageEvidenceCompleteness}%</div></div>
      </div>
      <div className="result-grid compact" style={{ marginTop: 12 }}>
        <div className="metric"><div className="label">Fixtures</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">Final</div><div className="value">{summary.finalResults}</div></div>
        <div className="metric"><div className="label">Scheduled/pending</div><div className="value">{summary.scheduledOrPending}</div></div>
        <div className="metric"><div className="label">Teams</div><div className="value">{summary.uniqueTeams}</div></div>
        <div className="metric"><div className="label">Duplicates</div><div className="value">{summary.duplicateFixtureRows}</div></div>
        <div className="metric"><div className="label">Name variants</div><div className="value">{summary.possibleTeamNameVariants}</div></div>
      </div>
      <div className="note-box">
        Evidence readiness: {summary.readyFixtures} ready, {summary.reviewFixtures} review, {summary.incompleteFixtures} incomplete. Postponed/cancelled fixtures: {summary.postponedOrCancelled}.
      </div>
      <h4>Data-quality issues</h4>
      {summary.issues.length === 0 ? (
        <div className="note-box">No major data-quality issues found for this competition.</div>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead><tr><th>Severity</th><th>Area</th><th>Count</th><th>What to check</th></tr></thead>
            <tbody>
              {summary.issues.map((issue) => (
                <tr key={`${issue.severity}-${issue.category}-${issue.message}`}>
                  <td>{dataQualitySeverityBadge(issue.severity)}</td>
                  <td>{issue.category}</td>
                  <td>{issue.count}</td>
                  <td>{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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


function calibrationGradeBadge(grade: ProbabilityCalibrationSummary["calibrationGrade"]) {
  if (grade === "good") return <span className="badge good">Good</span>;
  if (grade === "watch") return <span className="badge warn">Watch</span>;
  if (grade === "poor") return <span className="badge bad">Poor</span>;
  return <span className="badge warn">Needs data</span>;
}

export function ProbabilityCalibrationPanel(props: { summary: ProbabilityCalibrationSummary; selectedRoundLabel: string }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P29 Probability Calibration Review</h3>
      <p className="section-help">
        Checks whether the P28 Home/Draw/Away percentages are behaving sensibly against final results. This is a review dashboard only; it does not auto-change model weights.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Settled</div><div className="value">{summary.settledFixtures}</div></div>
        <div className="metric"><div className="label">Favourite hit rate</div><div className="value">{summary.favouriteHitRate}%</div></div>
        <div className="metric"><div className="label">Actual-result prob.</div><div className="value">{summary.averageActualOutcomeProbability}%</div></div>
        <div className="metric"><div className="label">Brier score</div><div className="value">{summary.averageBrierScore.toFixed(2)}</div></div>
        <div className="metric"><div className="label">Calibration</div><div className="value small-value">{calibrationGradeBadge(summary.calibrationGrade)}</div></div>
      </div>
      <div className="note-box">Selected view: {props.selectedRoundLabel}. A lower Brier score is better. Scores are only meaningful once you have enough final results.</div>
      {summary.warnings.length > 0 && (
        <div className="warning-list">
          {summary.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
      <h4>Probability bucket check</h4>
      <div className="table-wrap">
        <table className="mini-table">
          <thead><tr><th>Favourite probability bucket</th><th>Fixtures</th><th>Avg predicted</th><th>Actual hit rate</th><th>Avg Brier</th></tr></thead>
          <tbody>
            {summary.buckets.map((bucket) => (
              <tr key={bucket.label}>
                <td>{bucket.label}</td>
                <td>{bucket.fixtures}</td>
                <td>{bucket.fixtures > 0 ? `${bucket.averagePredictedProbability}%` : "—"}</td>
                <td>{bucket.fixtures > 0 ? `${bucket.actualHitRate}%` : "—"}</td>
                <td>{bucket.fixtures > 0 ? bucket.averageBrierScore.toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>High-confidence misses to review</h4>
      {summary.fixturesToReview.length === 0 ? (
        <div className="note-box">No high-probability favourite misses found in the selected data.</div>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead><tr><th>Fixture</th><th>Favourite</th><th>Favourite %</th><th>Actual</th><th>Brier</th></tr></thead>
            <tbody>
              {summary.fixturesToReview.map((item) => (
                <tr key={item.fixtureId}>
                  <td>{item.fixtureLabel}</td>
                  <td>{item.favourite}</td>
                  <td>{item.favouriteProbability}%</td>
                  <td>{item.actualOutcome}</td>
                  <td>{item.brierScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="evidence-list">{summary.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
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


function tuningPriorityBadge(priority: TuningRecommendationPriority) {
  if (priority === "high") return <span className="badge bad">High</span>;
  if (priority === "medium") return <span className="badge warn">Medium</span>;
  return <span className="badge good">Low</span>;
}

export function ModelTuningRecommendationsPanel(props: { summary: ModelTuningSummary; selectedRoundLabel: string }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P30 Model Tuning Recommendations</h3>
      <p className="section-help">
        Turns calibration and rule-learning signals into practical tuning suggestions. This is advisory only: it does not auto-change weights, thresholds or probabilities.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Settled</div><div className="value">{summary.settledFixtures}</div></div>
        <div className="metric"><div className="label">Published</div><div className="value">{summary.publishedTips}</div></div>
        <div className="metric"><div className="label">High-conf. misses</div><div className="value">{summary.highConfidenceMisses}</div></div>
        <div className="metric"><div className="label">Draw results</div><div className="value">{summary.drawResults}</div></div>
        <div className="metric"><div className="label">Recommendations</div><div className="value">{summary.recommendationCount}</div></div>
        <div className="metric"><div className="label">High priority</div><div className="value">{summary.highPriorityCount}</div></div>
      </div>
      <div className="note-box">Selected view: {props.selectedRoundLabel}. Average draw probability on actual draws: {summary.drawResults > 0 ? `${summary.averageDrawProbabilityOnDraws}%` : "not enough draw results yet"}.</div>
      {summary.warnings.length > 0 && (
        <div className="warning-list">
          {summary.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
      {summary.recommendations.length === 0 ? (
        <div className="note-box">No tuning recommendation yet. Add final results and re-check this panel after the next round settles.</div>
      ) : (
        <div className="learning-table">
          <div className="learning-row header-row"><span>Priority</span><span>Recommendation</span><span>Setting</span><span>Action</span></div>
          {summary.recommendations.map((recommendation) => (
            <div className="learning-row" key={recommendation.id}>
              <span>{tuningPriorityBadge(recommendation.priority)}</span>
              <span><strong>{recommendation.title}</strong><br /><small>{recommendation.reason}</small></span>
              <span>{recommendation.affectedSetting}</span>
              <span>{recommendation.suggestedAction}</span>
            </div>
          ))}
        </div>
      )}
      {summary.recommendations.slice(0, 3).map((recommendation) => (
        <div className="note-box" key={`${recommendation.id}-evidence`}>
          <strong>{recommendation.title} evidence:</strong>
          <ul className="evidence-list">{recommendation.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      ))}
      <ul className="evidence-list">{summary.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
    </section>
  );
}


function signedPercent(value: number): string {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return "0%";
}


function formatChangeReason(reason: ModelChangeLogEntry["reason"]): string {
  if (reason === "sandbox-apply") return "Sandbox apply";
  if (reason === "live-reset") return "Live reset";
  if (reason === "manual-snapshot") return "Snapshot";
  return "Imported";
}

function ModelChangeLogPanel(props: {
  summary: ModelChangeLogSummary;
  onAddManualSnapshot: () => void;
  onClearChangeLog: () => void;
}) {
  const { summary } = props;
  return (
    <div className="note-box" style={{ marginTop: 12 }}>
      <div className="section-heading-row">
        <div>
          <strong>P33 Model Change Log</strong>
          <p className="section-help">Records live-weight changes so tuning decisions are reviewable before Claude handoff or deployment. It does not change predictions by itself.</p>
        </div>
        <div className="button-row compact-buttons">
          <button type="button" className="secondary" onClick={props.onAddManualSnapshot}>Add snapshot</button>
          <button type="button" className="danger" onClick={props.onClearChangeLog} disabled={summary.totalEntries === 0}>Clear log</button>
        </div>
      </div>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Entries</div><div className="value">{summary.totalEntries}</div></div>
        <div className="metric"><div className="label">Sandbox applies</div><div className="value">{summary.sandboxApplications}</div></div>
        <div className="metric"><div className="label">Resets</div><div className="value">{summary.resets}</div></div>
        <div className="metric"><div className="label">Snapshots</div><div className="value">{summary.manualSnapshots}</div></div>
      </div>
      {summary.latestEntry ? (
        <p className="section-help">Latest: {summary.latestEntry.label} · {new Date(summary.latestEntry.createdAt).toLocaleString()}</p>
      ) : (
        <p className="section-help">No model changes recorded yet. Applying sandbox weights or resetting live weights will create entries automatically.</p>
      )}
      {summary.changedKeyCounts.length > 0 && (
        <p className="section-help">Most changed weights: {summary.changedKeyCounts.slice(0, 4).map((item) => `${String(item.key)} (${item.count})`).join(", ")}</p>
      )}
      {summary.recentEntries.length > 0 && (
        <div className="table-wrap">
          <table className="mini-table">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Label</th><th>Changed weights</th><th>Note</th></tr>
            </thead>
            <tbody>
              {summary.recentEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{formatChangeReason(entry.reason)}</td>
                  <td><strong>{entry.label}</strong></td>
                  <td>{entry.changedKeys.length ? entry.changedKeys.map(String).join(", ") : "Snapshot only"}</td>
                  <td>{entry.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TuningSandboxPanel(props: {
  summary: TuningSandboxComparison;
  selectedRoundLabel: string;
  ruleWeights: RuleWeights;
  sandboxWeights: RuleWeights;
  onUpdateSandboxWeight: (key: keyof RuleWeights, value: number) => void;
  onCopyLiveWeights: () => void;
  onResetSandboxWeights: () => void;
  onApplySandboxWeightsToLive: () => void;
  presets: TuningPreset[];
  newPresetName: string;
  newPresetDescription: string;
  onNewPresetNameChange: (value: string) => void;
  onNewPresetDescriptionChange: (value: string) => void;
  onSaveSandboxAsPreset: () => void;
  onLoadPresetIntoSandbox: (presetId: string) => void;
  onOverwritePresetFromSandbox: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPresets: () => void;
  changeLogSummary: ModelChangeLogSummary;
  onAddManualSnapshot: () => void;
  onClearChangeLog: () => void;
}) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P33 Tuning Sandbox + Model History</h3>
      <p className="section-help">
        Test recommended model changes without applying them to the live prediction engine. P33 keeps the safe sandbox/preset workflow and adds an auditable model-change history when live weights are applied or reset.
      </p>
      <div className="button-row">
        <button type="button" className="secondary" onClick={props.onCopyLiveWeights}>Copy live weights into sandbox</button>
        <button type="button" className="secondary" onClick={props.onResetSandboxWeights}>Reset sandbox to defaults</button>
        <button type="button" className="primary" onClick={props.onApplySandboxWeightsToLive}>Apply sandbox to live weights</button>
      </div>
      <div className="result-grid compact" style={{ marginTop: 12 }}>
        <div className="metric"><div className="label">Fixtures compared</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">Settled</div><div className="value">{summary.settledFixtures}</div></div>
        <div className="metric"><div className="label">Prediction changes</div><div className="value">{summary.predictionChanges}</div></div>
        <div className="metric"><div className="label">Publish changes</div><div className="value">{summary.publishStatusChanges}</div></div>
        <div className="metric"><div className="label">Hit-rate delta</div><div className="value">{signedPercent(summary.hitRateDelta)}</div></div>
        <div className="metric"><div className="label">Confidence delta</div><div className="value">{summary.confidenceDelta > 0 ? `+${summary.confidenceDelta}` : summary.confidenceDelta}</div></div>
      </div>
      {summary.warnings.length > 0 && (
        <div className="warning-list">
          {summary.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
      <div className="table-wrap">
        <table className="mini-table">
          <thead>
            <tr><th>Metric</th><th>Live model</th><th>Sandbox</th><th>Change</th></tr>
          </thead>
          <tbody>
            <tr><td>Published settled tips</td><td>{summary.baseline.publishedTips}</td><td>{summary.sandbox.publishedTips}</td><td>{summary.sandbox.publishedTips - summary.baseline.publishedTips}</td></tr>
            <tr><td>Correct tips</td><td>{summary.baseline.correctTips}</td><td>{summary.sandbox.correctTips}</td><td>{summary.sandbox.correctTips - summary.baseline.correctTips}</td></tr>
            <tr><td>Hit rate</td><td>{summary.baseline.hitRate}%</td><td>{summary.sandbox.hitRate}%</td><td>{signedPercent(summary.hitRateDelta)}</td></tr>
            <tr><td>Held for review</td><td>{summary.baseline.reviewHeldFixtures}</td><td>{summary.sandbox.reviewHeldFixtures}</td><td>{summary.sandbox.reviewHeldFixtures - summary.baseline.reviewHeldFixtures}</td></tr>
            <tr><td>Avg confidence</td><td>{summary.baseline.averageConfidence}</td><td>{summary.sandbox.averageConfidence}</td><td>{summary.confidenceDelta > 0 ? `+${summary.confidenceDelta}` : summary.confidenceDelta}</td></tr>
            <tr><td>High-conf. misses</td><td>{summary.baseline.highConfidenceMisses}</td><td>{summary.sandbox.highConfidenceMisses}</td><td>{summary.sandbox.highConfidenceMisses - summary.baseline.highConfidenceMisses}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="two-column" style={{ marginTop: 12 }}>
        <div className="note-box">
          <strong>Save current sandbox as preset</strong>
          <label className="field-label">Preset name</label>
          <input type="text" value={props.newPresetName} onChange={(event) => props.onNewPresetNameChange(event.target.value)} />
          <label className="field-label">Description</label>
          <textarea rows={2} value={props.newPresetDescription} onChange={(event) => props.onNewPresetDescriptionChange(event.target.value)} />
          <div className="button-row">
            <button type="button" className="secondary" onClick={props.onSaveSandboxAsPreset}>Save preset</button>
            <button type="button" className="secondary" onClick={props.onExportPresets} disabled={props.presets.length === 0}>Export presets JSON</button>
          </div>
        </div>
        <div className="note-box">
          <strong>Saved presets</strong>
          {props.presets.length === 0 ? (
            <p className="section-help">No saved tuning presets yet. Adjust sandbox weights, then save a named preset before applying live.</p>
          ) : (
            <div className="preset-list">
              {props.presets.map((preset) => (
                <div className="preset-row" key={preset.id}>
                  <div>
                    <strong>{preset.name}</strong>
                    <span>{preset.description || "No description"}</span>
                    <small>{getPresetWeightChangeCount(preset, props.ruleWeights)} live-weight difference(s) · updated {new Date(preset.updatedAt).toLocaleDateString()}</small>
                  </div>
                  <div className="button-row compact-buttons">
                    <button type="button" className="secondary" onClick={() => props.onLoadPresetIntoSandbox(preset.id)}>Load</button>
                    <button type="button" className="secondary" onClick={() => props.onOverwritePresetFromSandbox(preset.id)}>Overwrite</button>
                    <button type="button" className="danger" onClick={() => props.onDeletePreset(preset.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModelChangeLogPanel
        summary={props.changeLogSummary}
        onAddManualSnapshot={props.onAddManualSnapshot}
        onClearChangeLog={props.onClearChangeLog}
      />
      <div className="weight-grid" style={{ marginTop: 12 }}>
        {ruleWeightDefinitions.map((definition) => (
          <div className="weight-row" key={definition.key}>
            <div><strong>{definition.label}</strong><span>Live: {props.ruleWeights[definition.key]} · Sandbox: {props.sandboxWeights[definition.key]}</span></div>
            <input type="range" min={definition.min} max={definition.max} step={definition.step} value={props.sandboxWeights[definition.key]} onChange={(event) => props.onUpdateSandboxWeight(definition.key, Number(event.target.value))} />
            <input type="number" min={definition.min} max={definition.max} step={definition.step} value={props.sandboxWeights[definition.key]} onChange={(event) => props.onUpdateSandboxWeight(definition.key, Number(event.target.value))} />
          </div>
        ))}
      </div>
      <div className="note-box">Selected view: {props.selectedRoundLabel}. Sandbox changes do not affect Quick Prediction until you click Apply sandbox to live weights. Presets let you reuse tested settings without changing the live model automatically.</div>
      <ul className="evidence-list">{summary.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
    </section>
  );
}


function comparisonDirectionLabel(direction: "increased" | "decreased" | "unchanged") {
  if (direction === "increased") return <span className="badge warn">Increased</span>;
  if (direction === "decreased") return <span className="badge good">Decreased</span>;
  return <span className="badge">Unchanged</span>;
}

export function ModelVersionComparisonPanel(props: {
  summary: ModelVersionComparisonSummary;
  targets: ModelVersionComparisonTarget[];
  selectedTargetId: string;
  selectedRoundLabel: string;
  onSelectedTargetChange: (targetId: string) => void;
}) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P34 Model Version Comparison</h3>
      <p className="section-help">
        Compare current live weights against a previous change-log snapshot, saved preset, or defaults. This is read-only and does not change the live model.
      </p>
      <label>
        Comparison target
        <select value={props.selectedTargetId} onChange={(event) => props.onSelectedTargetChange(event.target.value)}>
          {props.targets.map((target) => (
            <option key={target.id} value={target.id}>{target.label}</option>
          ))}
        </select>
      </label>
      <div className="note-box" style={{ marginTop: 12 }}>
        <strong>{summary.target.label}</strong><br />
        {summary.target.sourceDescription}<br />
        Selected view: {props.selectedRoundLabel}
      </div>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Changed weights</div><div className="value">{summary.changedWeightCount}</div></div>
        <div className="metric"><div className="label">Prediction changes</div><div className="value">{summary.performance.predictionChanges}</div></div>
        <div className="metric"><div className="label">Publish changes</div><div className="value">{summary.performance.publishStatusChanges}</div></div>
        <div className="metric"><div className="label">Hit-rate delta</div><div className="value">{signedPercent(summary.performance.hitRateDelta)}</div></div>
        <div className="metric"><div className="label">Confidence delta</div><div className="value">{summary.performance.confidenceDelta > 0 ? `+${summary.performance.confidenceDelta}` : summary.performance.confidenceDelta}</div></div>
        <div className="metric"><div className="label">Largest change</div><div className="value small-value">{summary.largestChange ? summary.largestChange.label : "None"}</div></div>
      </div>
      {summary.warnings.length > 0 && (
        <div className="warning-list">
          {summary.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
      <h4>Weight differences</h4>
      {summary.changedWeights.length === 0 ? (
        <div className="note-box">No weight differences found between the current live model and this comparison target.</div>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead><tr><th>Weight</th><th>Target</th><th>Current</th><th>Change</th><th>Direction</th><th>Affected area</th></tr></thead>
            <tbody>
              {summary.changedWeights.map((item) => (
                <tr key={String(item.key)}>
                  <td><strong>{item.label}</strong></td>
                  <td>{item.comparisonValue}</td>
                  <td>{item.currentValue}</td>
                  <td>{item.delta > 0 ? `+${item.delta}` : item.delta}</td>
                  <td>{comparisonDirectionLabel(item.direction)}</td>
                  <td>{item.affectedGate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4>Historical performance comparison</h4>
      <div className="table-wrap">
        <table className="mini-table">
          <thead><tr><th>Metric</th><th>Comparison target</th><th>Current live</th><th>Change</th></tr></thead>
          <tbody>
            <tr><td>Published settled tips</td><td>{summary.performance.baseline.publishedTips}</td><td>{summary.performance.sandbox.publishedTips}</td><td>{summary.performance.sandbox.publishedTips - summary.performance.baseline.publishedTips}</td></tr>
            <tr><td>Correct tips</td><td>{summary.performance.baseline.correctTips}</td><td>{summary.performance.sandbox.correctTips}</td><td>{summary.performance.sandbox.correctTips - summary.performance.baseline.correctTips}</td></tr>
            <tr><td>Hit rate</td><td>{summary.performance.baseline.hitRate}%</td><td>{summary.performance.sandbox.hitRate}%</td><td>{signedPercent(summary.performance.hitRateDelta)}</td></tr>
            <tr><td>Held for review</td><td>{summary.performance.baseline.reviewHeldFixtures}</td><td>{summary.performance.sandbox.reviewHeldFixtures}</td><td>{summary.performance.sandbox.reviewHeldFixtures - summary.performance.baseline.reviewHeldFixtures}</td></tr>
            <tr><td>High-conf. misses</td><td>{summary.performance.baseline.highConfidenceMisses}</td><td>{summary.performance.sandbox.highConfidenceMisses}</td><td>{summary.performance.sandbox.highConfidenceMisses - summary.performance.baseline.highConfidenceMisses}</td></tr>
          </tbody>
        </table>
      </div>
      <ul className="evidence-list">{summary.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
    </section>
  );
}


function releaseStatusBadge(status: ReleaseCheckStatus) {
  if (status === "pass") return <span className="badge good">Pass</span>;
  if (status === "warn") return <span className="badge warn">Check</span>;
  return <span className="badge">Info</span>;
}

export function ReleaseChecklistPanel(props: { summary: ReleaseChecklistSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>{summary.patch} Release Notes + Upgrade Checklist</h3>
      <p className="section-help">
        Tracks the current P36–P40 Claude handoff cycle with an in-app release checklist. This panel is read-only and does not change predictions, imports, tennis, aliases, probabilities, or model weights.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Patch</div><div className="value">{summary.patch}</div></div>
        <div className="metric"><div className="label">Version</div><div className="value">{summary.version}</div></div>
        <div className="metric"><div className="label">Verify</div><div className="value small-value">{summary.verificationCommand}</div></div>
        <div className="metric"><div className="label">Standing Items</div><div className="value">{summary.standingItems.length}</div></div>
      </div>

      <h4>Deployment checklist</h4>
      <div className="table-wrap">
        <table className="mini-table">
          <thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead>
          <tbody>
            {summary.deploymentItems.map((item) => (
              <tr key={item.id}><td>{releaseStatusBadge(item.status)}</td><td><strong>{item.label}</strong></td><td>{item.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Workspace checklist</h4>
      <div className="table-wrap">
        <table className="mini-table">
          <thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead>
          <tbody>
            {summary.workspaceItems.map((item) => (
              <tr key={item.id}><td>{releaseStatusBadge(item.status)}</td><td><strong>{item.label}</strong></td><td>{item.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Standing items</h4>
      <div className="table-wrap">
        <table className="mini-table">
          <thead><tr><th>Item</th><th>P36 status</th><th>Detail</th></tr></thead>
          <tbody>
            {summary.standingItems.map((item) => (
              <tr key={item.label}>
                <td><strong>{item.label}</strong></td>
                <td>{item.state === "left-alone" ? <span className="badge good">Left alone</span> : <span className="badge warn">Touched</span>}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="evidence-list">{summary.handoffNotes.map((note) => <li key={note}>{note}</li>)}</ul>
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

import type { AdvancedEvidenceSummary } from "../lib/advancedEvidence";
import type { AdvancedImpactSeverity, AdvancedImpactSummary } from "../lib/advancedEvidenceImpact";
import type { AdvancedDataGateSeverity, AdvancedDataGateSummary, AdvancedDataGateVerdict } from "../lib/advancedDataGate";


function advancedDataGateSeverityBadge(severity: AdvancedDataGateSeverity) {
  if (severity === "high") return <span className="badge bad">High</span>;
  if (severity === "medium") return <span className="badge warn">Medium</span>;
  return <span className="badge">Low</span>;
}

function advancedDataGateVerdictBadge(verdict: AdvancedDataGateVerdict) {
  if (verdict === "supports") return <span className="badge good">Supports</span>;
  if (verdict === "weakens") return <span className="badge warn">Weakens</span>;
  if (verdict === "review") return <span className="badge bad">Review</span>;
  return <span className="badge">Needs data</span>;
}

export function AdvancedDataGatePanel(props: { summary: AdvancedDataGateSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P44 Advanced Data Gate</h3>
      <p className="section-help">
        Converts advanced evidence into a conservative gate. P44 is advisory: it can support, weaken, or flag a prediction, but it does not replace the existing model or auto-apply tuning changes.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Fixtures</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">With gate data</div><div className="value">{summary.fixturesWithGateData}</div></div>
        <div className="metric"><div className="label">Supports</div><div className="value">{summary.supportsCount}</div></div>
        <div className="metric"><div className="label">Review</div><div className="value">{summary.reviewCount}</div></div>
      </div>
      <div className="note-box" style={{ marginTop: 12 }}>
        Weakens: {summary.weakensCount} · Needs data: {summary.insufficientDataCount} · Average advanced score: {summary.averageScore}
      </div>
      {summary.topGateResults.length === 0 ? (
        <div className="note-box" style={{ marginTop: 12 }}>
          No advanced gate signals are available yet. Import advanced evidence through the P42 templates, then check xG, schedule strength, fatigue, player-impact, market movement, set pieces, discipline and context flags here.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Verdict</th><th>Fixture</th><th>Score</th><th>Signals</th><th>Top signal</th><th>Guidance</th></tr></thead>
            <tbody>
              {summary.topGateResults.map((result) => {
                const topSignal = result.signals[0];
                return (
                  <tr key={result.fixtureId}>
                    <td>{advancedDataGateVerdictBadge(result.verdict)}</td>
                    <td><strong>{result.fixtureLabel}</strong><br /><span className="muted">Prediction: {result.predictionLabel}</span></td>
                    <td>{result.score}<br /><span className="muted">Adj {result.confidenceAdjustment > 0 ? "+" : ""}{result.confidenceAdjustment}</span></td>
                    <td>{result.signalCount}<br /><span className="muted">Support {result.supportCount} · Warn {result.warningCount} · Review {result.reviewCount}</span></td>
                    <td>{topSignal ? <><strong>{topSignal.label}</strong> {advancedDataGateSeverityBadge(topSignal.severity)}<br /><span className="muted">{topSignal.detail}</span></> : "—"}</td>
                    <td>{result.recommendations.map((recommendation) => <div key={recommendation}>• {recommendation}</div>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="note-list" style={{ marginTop: 12 }}>
        {summary.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}

function advancedImpactSeverityBadge(severity: AdvancedImpactSeverity) {
  if (severity === "strong") return <span className="badge bad">Strong</span>;
  if (severity === "caution") return <span className="badge warn">Caution</span>;
  return <span className="badge">Watch</span>;
}

export function AdvancedEvidenceImpactPanel(props: { summary: AdvancedImpactSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P43 Advanced Evidence Impact Signals</h3>
      <p className="section-help">
        Converts imported advanced evidence into read-only review signals. P43 does not change the live prediction engine, weights, probability rounding, tennis gates, aliases, or published tips.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Fixtures</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">Advanced coverage</div><div className="value">{summary.coveragePct}%</div></div>
        <div className="metric"><div className="label">Signals</div><div className="value">{summary.signalCount}</div></div>
        <div className="metric"><div className="label">Strong</div><div className="value">{summary.strongSignalCount}</div></div>
      </div>
      <div className="note-box" style={{ marginTop: 12 }}>
        Strong: {summary.strongSignalCount} · Caution: {summary.cautionSignalCount} · Watch: {summary.watchSignalCount}
      </div>
      {summary.categoryCounts.length > 0 && (
        <div className="tag-row" style={{ marginTop: 12 }}>
          {summary.categoryCounts.map((item) => (
            <span className="tag" key={item.category}>{item.category}: {item.count}</span>
          ))}
        </div>
      )}
      {summary.topSignals.length === 0 ? (
        <div className="note-box" style={{ marginTop: 12 }}>
          No advanced-impact signals detected yet. Import advanced evidence through the P42 templates to populate xG, schedule strength, fatigue, player-impact, market movement, set pieces, discipline and stability fields.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Severity</th><th>Fixture</th><th>Category</th><th>Signal</th><th>Direction</th><th>Current prediction</th></tr></thead>
            <tbody>
              {summary.topSignals.map((signal) => (
                <tr key={signal.id}>
                  <td>{advancedImpactSeverityBadge(signal.severity)}</td>
                  <td><strong>{signal.fixtureLabel}</strong></td>
                  <td>{signal.category}</td>
                  <td><strong>{signal.title}</strong><br /><span className="muted">{signal.detail}</span></td>
                  <td>{signal.direction}</td>
                  <td>{signal.currentPrediction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="note-list" style={{ marginTop: 12 }}>
        {summary.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}

export function AdvancedEvidencePanel(props: { summary: AdvancedEvidenceSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P41 Advanced Evidence Schema</h3>
      <p className="section-help">
        Stores richer accuracy inputs such as xG, schedule strength, fatigue, market movement, player-impact availability, set pieces, discipline, and stability. This panel is read-only in P41 and does not change live predictions.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Fixtures</div><div className="value">{summary.fixtureCount}</div></div>
        <div className="metric"><div className="label">With advanced evidence</div><div className="value">{summary.fixturesWithAdvancedEvidence}</div></div>
        <div className="metric"><div className="label">Overall coverage</div><div className="value">{summary.coveragePct}%</div></div>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="mini-table">
          <thead><tr><th>Category</th><th>Coverage</th><th>Available</th><th>Detail</th></tr></thead>
          <tbody>
            {summary.categories.map((category) => (
              <tr key={category.id}>
                <td><strong>{category.label}</strong></td>
                <td>{category.coveragePct}%</td>
                <td>{category.available}/{category.possible}</td>
                <td>{category.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note-list" style={{ marginTop: 12 }}>
        {summary.notes.map((note) => <div key={note}>• {note}</div>)}
      </div>
    </section>
  );
}


import type { AdvancedDataWeightSandboxSummary } from "../lib/advancedDataWeightSandbox";

function advancedSandboxStatusBadge(status: AdvancedDataWeightSandboxSummary["status"]) {
  if (status === "favourable") return <span className="badge good">Favourable</span>;
  if (status === "mixed") return <span className="badge warn">Mixed</span>;
  if (status === "unfavourable") return <span className="badge bad">Unfavourable</span>;
  return <span className="badge">Needs data</span>;
}

function yesNo(value: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

export function AdvancedDataWeightSandboxPanel(props: { summary: AdvancedDataWeightSandboxSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P47 Advanced Data Weight Sandbox / Calibration Integration</h3>
      <p className="section-help">
        Compare review-only baseline behaviour against the current P46 confidence-only settings before relying on advanced data live. This panel is read-only and does not apply tuning changes.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Sandbox status</div><div className="value">{advancedSandboxStatusBadge(summary.status)}</div></div>
        <div className="metric"><div className="label">Settled fixtures</div><div className="value">{summary.settledFixtureCount}</div></div>
        <div className="metric"><div className="label">Confidence moves</div><div className="value">{summary.confidenceMovedCount}</div></div>
        <div className="metric"><div className="label">Review escalations</div><div className="value">{summary.reviewEscalationCount}</div></div>
      </div>
      <div className="result-grid compact" style={{ marginTop: 12 }}>
        <div className="metric"><div className="label">Review-only hit rate</div><div className="value">{summary.baselineHitRatePct}%</div><div className="small">{summary.baselineCorrectCount}/{summary.baselinePublishedCount}</div></div>
        <div className="metric"><div className="label">Advanced sandbox hit rate</div><div className="value">{summary.proposedHitRatePct}%</div><div className="small">{summary.proposedCorrectCount}/{summary.proposedPublishedCount}</div></div>
        <div className="metric"><div className="label">Net correct delta</div><div className="value">{summary.netCorrectDelta > 0 ? "+" : ""}{summary.netCorrectDelta}</div></div>
        <div className="metric"><div className="label">Avg confidence delta</div><div className="value">{summary.averageConfidenceDelta > 0 ? "+" : ""}{summary.averageConfidenceDelta}</div></div>
      </div>
      <div className="note-box" style={{ marginTop: 12 }}>
        {summary.recommendation} Current test settings: max ±{summary.maxConfidenceAdjustment} confidence points and minimum {summary.minimumSignalsRequired} signal(s).
      </div>
      {summary.outcomes.length === 0 ? (
        <div className="note-box" style={{ marginTop: 12 }}>
          No sandbox differences yet. Add settled results and advanced evidence before using the P46 live toggle.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Fixture</th><th>Gate</th><th>Confidence</th><th>Baseline correct</th><th>Sandbox correct</th><th>Note</th></tr></thead>
            <tbody>
              {summary.outcomes.map((item) => (
                <tr key={item.fixtureId}>
                  <td><strong>{item.fixtureLabel}</strong><br /><span className="muted">Actual: {item.actualOutcome}</span></td>
                  <td>{advancedDataGateVerdictBadge(item.gateVerdict)}<br /><span className="muted">{item.signalCount} signal(s)</span></td>
                  <td>{item.confidenceDelta > 0 ? "+" : ""}{item.confidenceDelta}<br /><span className="muted">Applied {item.appliedAdjustment > 0 ? "+" : ""}{item.appliedAdjustment}</span></td>
                  <td>{yesNo(item.baselineCorrect)}</td>
                  <td>{yesNo(item.proposedCorrect)}</td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="evidence-list">{summary.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
  );
}

import type { AdvancedDataCalibrationGrade, AdvancedDataCalibrationSummary } from "../lib/advancedDataCalibration";

function advancedCalibrationGradeBadge(grade: AdvancedDataCalibrationGrade) {
  if (grade === "promising") return <span className="badge good">Promising</span>;
  if (grade === "mixed") return <span className="badge warn">Mixed</span>;
  if (grade === "weak") return <span className="badge bad">Weak</span>;
  return <span className="badge">Needs data</span>;
}

function advancedCalibrationResultBadge(result: string) {
  if (result === "helped" || result === "warned-correctly") return <span className="badge good">{result}</span>;
  if (result === "missed" || result === "false-warning") return <span className="badge warn">{result}</span>;
  return <span className="badge">{result}</span>;
}

export function AdvancedDataCalibrationPanel(props: { summary: AdvancedDataCalibrationSummary }) {
  const { summary } = props;
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P45 Advanced Data Calibration Review</h3>
      <p className="section-help">
        Measures whether P43/P44 advanced evidence signals are actually helping on settled fixtures. P45 is review-only and does not auto-retune weights.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Settled fixtures</div><div className="value">{summary.settledFixtureCount}</div></div>
        <div className="metric"><div className="label">With advanced gate data</div><div className="value">{summary.fixturesWithAdvancedGateData}</div></div>
        <div className="metric"><div className="label">Support hit rate</div><div className="value">{summary.supportiveSignalHitRatePct}%</div></div>
        <div className="metric"><div className="label">Warning miss rate</div><div className="value">{summary.warningSignalMissRatePct}%</div></div>
      </div>
      <div className="note-box" style={{ marginTop: 12 }}>
        Calibration grade: {advancedCalibrationGradeBadge(summary.grade)} · {summary.recommendation}
      </div>
      {summary.categoryBreakdown.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Category</th><th>Sample</th><th>Correct</th><th>Missed</th><th>Hit rate</th><th>Note</th></tr></thead>
            <tbody>
              {summary.categoryBreakdown.map((category) => (
                <tr key={category.category}>
                  <td><strong>{category.category}</strong></td>
                  <td>{category.sampleSize}</td>
                  <td>{category.correctCount}</td>
                  <td>{category.missedCount}</td>
                  <td>{category.hitRatePct}%</td>
                  <td>{category.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {summary.examples.length === 0 ? (
        <div className="note-box" style={{ marginTop: 12 }}>
          No settled advanced-data examples yet. Enter final results and import P42 advanced evidence to populate this calibration review.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Result</th><th>Fixture</th><th>Category</th><th>Signal</th><th>Gate</th><th>Actual</th></tr></thead>
            <tbody>
              {summary.examples.map((example) => (
                <tr key={`${example.fixtureId}-${example.category}-${example.signal}`}>
                  <td>{advancedCalibrationResultBadge(example.result)}</td>
                  <td><strong>{example.fixtureLabel}</strong><br /><span className="muted">{example.prediction}</span></td>
                  <td>{example.category}</td>
                  <td>{example.signal}</td>
                  <td>{example.gateVerdict}</td>
                  <td>{example.actualOutcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="evidence-list">{summary.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
  );
}

import type { AdvancedDataIntegrationSummary, AdvancedDataWeightControls } from "../lib/advancedDataWeightControls";

export function AdvancedDataWeightControlsPanel(props: {
  summary: AdvancedDataIntegrationSummary;
  controls: AdvancedDataWeightControls;
  onChange: (controls: AdvancedDataWeightControls) => void;
}) {
  const { summary, controls, onChange } = props;
  const update = (patch: Partial<AdvancedDataWeightControls>) => onChange({ ...controls, ...patch });
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P46 Advanced Data Weight Controls</h3>
      <p className="section-help">
        Advanced data is review-only by default. When enabled, it can only move confidence within the configured cap; it never changes the home/draw/away edge, tennis gates, aliases, or core prediction side.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Mode</div><div className="value">{summary.enabled ? "Confidence" : "Review"}</div></div>
        <div className="metric"><div className="label">Adjusted fixtures</div><div className="value">{summary.adjustedFixtureCount}</div></div>
        <div className="metric"><div className="label">Review escalations</div><div className="value">{summary.reviewEscalationCount}</div></div>
        <div className="metric"><div className="label">Avg adjustment</div><div className="value">{summary.averageAppliedAdjustment > 0 ? "+" : ""}{summary.averageAppliedAdjustment}</div></div>
      </div>
      <div className="input-grid" style={{ marginTop: 12 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={controls.enabled}
            onChange={(event) => update({ enabled: event.target.checked, mode: event.target.checked ? "confidence-only" : "review-only" })}
          />
          Enable confidence-only advanced-data influence
        </label>
        <label>
          Max confidence adjustment
          <input
            type="number"
            min={0}
            max={8}
            step={1}
            value={controls.maxConfidenceAdjustment}
            onChange={(event) => update({ maxConfidenceAdjustment: Number(event.target.value) })}
          />
        </label>
        <label>
          Minimum signals required
          <input
            type="number"
            min={1}
            max={6}
            step={1}
            value={controls.minimumSignalsRequired}
            onChange={(event) => update({ minimumSignalsRequired: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={controls.allowReviewEscalation}
            onChange={(event) => update({ allowReviewEscalation: event.target.checked })}
          />
          Allow advanced data to escalate weak fixtures to review
        </label>
      </div>
      <div className="note-box" style={{ marginTop: 12 }}>
        Current guardrails: max ±{summary.maxConfidenceAdjustment} confidence points · minimum {summary.minimumSignalsRequired} signal(s) · mode {summary.mode}.
      </div>
      {summary.topResults.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="mini-table">
            <thead><tr><th>Fixture</th><th>Gate verdict</th><th>Adjustment</th><th>Confidence</th><th>Notes</th></tr></thead>
            <tbody>
              {summary.topResults.map((item) => (
                <tr key={item.fixtureId}>
                  <td><strong>{item.gateResult.fixtureLabel}</strong><br /><span className="muted">{item.gateResult.predictionLabel}</span></td>
                  <td>{advancedDataGateVerdictBadge(item.gateResult.verdict)}</td>
                  <td>{item.appliedAdjustment > 0 ? "+" : ""}{item.appliedAdjustment}</td>
                  <td>{item.originalConfidence}% → {item.adjustedConfidence}%</td>
                  <td>{item.reviewEscalated ? "Escalated to review. " : ""}{item.notes[0] ?? "Confidence-only guardrails applied."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="evidence-list">{summary.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
  );
}
