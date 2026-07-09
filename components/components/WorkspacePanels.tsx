"use client";

import { ChangeEvent, useState } from "react";
import { FREE_TIER_COMPETITIONS } from "../lib/competitions";
import type { FixtureBatchMode, FixtureBatchPreview } from "../lib/workspace";
import type { TeamAliasRule, TeamNameIssue } from "../lib/teamAliases";
import type { WorkspaceRestoreResolverSummary } from "../lib/workspaceRestoreResolver";


type ImportPreviewState = {
  title: string;
  mode: FixtureBatchMode;
  preview: FixtureBatchPreview;
  warnings: string[];
  apply: () => void;
};

function ImportPreviewBox(props: {
  pending: ImportPreviewState | null;
  onClear: () => void;
}) {
  if (!props.pending) return null;
  const warnings = [...props.pending.warnings, ...props.pending.preview.warnings];
  return (
    <div className="note-box import-preview-box">
      <strong>{props.pending.title}</strong>
      <ul>
        {props.pending.preview.summaryLines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {props.pending.preview.importedCompetitions.length > 0 && (
        <div className="note-box">
          <p><strong>Competition scope:</strong> {props.pending.preview.importedCompetitions.join(", ")}</p>
          {props.pending.preview.newCompetitions.length > 0 && (
            <p><strong>Will add as new:</strong> {props.pending.preview.newCompetitions.join(", ")}</p>
          )}
          {props.pending.preview.existingCompetitions.length > 0 && (
            <p><strong>Already exists:</strong> {props.pending.preview.existingCompetitions.join(", ")}</p>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <strong>Warnings / checks:</strong>
          <ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </div>
      )}
      <div className="actions compact-actions">
        <button className="primary" onClick={props.pending.apply}>
          {props.pending.mode === "append" ? "Add/import without replacing" : props.pending.mode === "update" ? "Update matching fixtures" : props.pending.mode === "replaceCompetition" ? "Replace imported competition only" : "Replace entire workspace"}
        </button>
        <button className="secondary" onClick={props.onClear}>Cancel preview</button>
      </div>
    </div>
  );
}

export function WorkspacePersistencePanel(props: {
  storageMessage: string;
  lastSavedAt: string | null;
  fixtureCount: number;
  onExportBackup: () => void;
  onImportBackup: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetSamples: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P11/P12 Workspace Persistence</h3>
      <p className="section-help">
        Fixtures, raw evidence, final results and tuning weights are now autosaved to this browser. Use backups before replacing the repo, changing devices or clearing browser storage.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Autosave Status</div><div className="value small-value">{props.storageMessage}</div></div>
        <div className="metric"><div className="label">Last Saved</div><div className="value small-value">{props.lastSavedAt ? new Date(props.lastSavedAt).toLocaleString() : "Not saved yet"}</div></div>
        <div className="metric"><div className="label">Saved Fixtures</div><div className="value">{props.fixtureCount}</div></div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={props.onExportBackup}>Export backup JSON</button>
        <label className="secondary file-action">Import backup JSON<input type="file" accept="application/json,.json" onChange={props.onImportBackup} /></label>
        <button className="secondary danger" onClick={props.onResetSamples}>Reset to sample data</button>
      </div>
    </section>
  );
}

export function CloudSyncPanel(props: {
  authMessage: string;
  activeUserEmail: string;
  cloudWorkspaceId: string;
  cloudMessage: string;
  cloudMirrorStatus: string;
  isCloudBusy: boolean;
  lastCloudSavedAt: string | null;
  isSignedIn: boolean;
  onCloudWorkspaceIdChange: (value: string) => void;
  onSaveCloud: () => void;
  onLoadCloud: () => void;
  onNewCloudId: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P13 Supabase Auth + Admin-Owned Cloud Persistence</h3>
      <p className="section-help">
        Cloud-first workspace protection. Sign-in happens once for the whole app (see the top of the
        page) — this panel is just for managing which cloud workspace ID your data mirrors to.
        P38 mirrors the full workspace to Supabase and localStorage, and blocks obvious overwrites of
        richer saved workspaces.
      </p>
      <div className="note-box">{props.authMessage}{props.activeUserEmail ? ` Cloud saves are owned by ${props.activeUserEmail}.` : ""}</div>
      <div className="field-row">
        <label>Cloud workspace ID<input value={props.cloudWorkspaceId} onChange={(event) => props.onCloudWorkspaceIdChange(event.target.value)} /></label>
      </div>
      <div className="actions">
        <button className="secondary" onClick={props.onSaveCloud} disabled={props.isCloudBusy}>Save to Supabase now</button>
        <button className="secondary" onClick={props.onLoadCloud} disabled={props.isCloudBusy}>Restore from Supabase</button>
        <button className="secondary" onClick={props.onNewCloudId} disabled={props.isCloudBusy}>New cloud ID</button>
      </div>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Cloud Mirror</div><div className="value small-value">{props.cloudMirrorStatus}</div></div>
        <div className="metric"><div className="label">Last Cloud Save</div><div className="value small-value">{props.lastCloudSavedAt ? new Date(props.lastCloudSavedAt).toLocaleString() : "Not saved to cloud yet"}</div></div>
      </div>
      <div className="note-box">{props.cloudMessage}</div>
    </section>
  );
}



export function TeamAliasManagerPanel(props: {
  aliases: TeamAliasRule[];
  detectedIssues: TeamNameIssue[];
  onAddAlias: (rule: Omit<TeamAliasRule, "id">) => void;
  onRemoveAlias: (id: string) => void;
  onResetDefaults: () => void;
  onApplyToWorkspace: () => void;
}) {
  const [alias, setAlias] = useState("");
  const [canonical, setCanonical] = useState("");
  const [competition, setCompetition] = useState("");

  function addRule() {
    props.onAddAlias({ alias, canonical, competition });
    setAlias("");
    setCanonical("");
    setCompetition("");
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P26 Team Alias / Name Normalisation</h3>
      <p className="section-help">
        Weekly spreadsheets often use different spellings for the same team, such as Sao Paulo vs São Paulo or Gremio vs Grêmio. Alias rules are applied to custom competition imports before preview/update matching runs.
      </p>
      <div className="input-grid">
        <label>
          Alias from import
          <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Sao Paulo" />
        </label>
        <label>
          Canonical team name
          <input value={canonical} onChange={(event) => setCanonical(event.target.value)} placeholder="São Paulo" />
        </label>
        <label>
          Competition scope optional
          <input value={competition} onChange={(event) => setCompetition(event.target.value)} placeholder="Brasileirão Série A" />
        </label>
      </div>
      <div className="actions compact-actions">
        <button className="primary" onClick={addRule} disabled={!alias.trim() || !canonical.trim()}>Add alias</button>
        <button className="secondary" onClick={props.onApplyToWorkspace}>Apply aliases to current workspace</button>
        <button className="secondary" onClick={props.onResetDefaults}>Reset default Brazil aliases</button>
      </div>
      <div className="learning-table">
        <div className="learning-row header-row"><span>Alias</span><span>Canonical</span><span>Scope</span><span>Action</span></div>
        {props.aliases.map((rule) => (
          <div className="learning-row" key={rule.id}>
            <span>{rule.alias}</span>
            <span>{rule.canonical}</span>
            <span>{rule.competition || "All competitions"}</span>
            <span><button className="secondary compact-button" onClick={() => props.onRemoveAlias(rule.id)}>Remove</button></span>
          </div>
        ))}
      </div>
      {props.detectedIssues.length > 0 ? (
        <div className="note-box">
          <strong>Possible naming variants detected in the workspace:</strong>
          <ul>
            {props.detectedIssues.slice(0, 6).map((issue) => (
              <li key={issue.normalisedName}>
                {issue.variants.join(" / ")} — seen in {issue.competitions.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="note-box">No obvious same-team spelling variants detected in the current workspace.</div>
      )}
    </section>
  );
}

export function CustomCompetitionImportPanel(props: {
  message: string;
  onExportTemplate: () => void;
  onExportWorkbookTemplate: () => void;
  onPreviewRawCompetition: (csv: string, mode: FixtureBatchMode) => ImportPreviewState;
  onImportRawCompetition: (csv: string, mode: FixtureBatchMode) => void;
  onPreviewTeamsFixturesWorkbook: (teamsCsv: string, fixturesCsv: string, mode: FixtureBatchMode) => ImportPreviewState;
  onImportTeamsFixturesWorkbook: (teamsCsv: string, fixturesCsv: string, mode: FixtureBatchMode) => void;
}) {
  const [isReading, setIsReading] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportPreviewState | null>(null);

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>, mode: FixtureBatchMode) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReading(true);
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        const teamsSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "teams");
        const fixturesSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "fixtures");
        if (teamsSheetName && fixturesSheetName) {
          const teamsCsv = XLSX.utils.sheet_to_csv(workbook.Sheets[teamsSheetName]);
          const fixturesCsv = XLSX.utils.sheet_to_csv(workbook.Sheets[fixturesSheetName]);
          setPendingImport(props.onPreviewTeamsFixturesWorkbook(teamsCsv, fixturesCsv, mode));
        } else {
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) throw new Error("Workbook does not contain any sheets.");
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          setPendingImport(props.onPreviewRawCompetition(csv, mode));
        }
      } else {
        const csv = await file.text();
        setPendingImport(props.onPreviewRawCompetition(csv, mode));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown file read error.";
      window.alert(`Custom competition import failed: ${message}`);
    } finally {
      event.target.value = "";
      setIsReading(false);
    }
  };

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P24/P25 Custom Competition Builder</h3>
      <p className="section-help">
        Import an unsupported league or competition from either a two-sheet Teams + Fixtures workbook or a raw results/upcoming fixtures file. A Teams + Fixtures workbook uses the Teams sheet for table evidence and the Fixtures sheet for the actual matches to create.
      </p>
      <div className="actions">
        <button className="secondary" onClick={props.onExportWorkbookTemplate}>Export Teams + Fixtures + Advanced Evidence XLSX template</button>
        <button className="secondary" onClick={props.onExportTemplate}>Export raw results CSV template</button>
        <label className="secondary file-action">
          Add as new competition / append safely
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "append")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Update matching fixtures
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "update")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Replace imported competition only
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replaceCompetition")} disabled={isReading} />
        </label>
        <label className="secondary file-action danger">
          Replace entire workspace
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replace")} disabled={isReading} />
        </label>
      </div>
      <ImportPreviewBox pending={pendingImport} onClear={() => setPendingImport(null)} />
      <div className="note-box">{isReading ? "Reading file…" : props.message || "No custom competition import has run yet."}</div>
      <p className="section-help small-help">
Teams + Fixtures XLSX files must have sheets named exactly “Teams” and “Fixtures”. Use “Add as new competition / append safely” for a new league such as USL Championship. Use “Update matching fixtures” or “Replace imported competition only” only when refreshing a league that already exists. Never use “Replace entire workspace” unless you intentionally want to remove all competitions from this browser workspace.
      </p>
    </section>
  );
}

export function FixtureCsvPanel(props: {
  csvMessage: string;
  onExportCsv: () => void;
  onPreviewCsv: (csv: string, mode: FixtureBatchMode) => ImportPreviewState;
  onImportCsv: (csv: string, mode: FixtureBatchMode) => void;
}) {
  const [isReading, setIsReading] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportPreviewState | null>(null);

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>, mode: FixtureBatchMode) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReading(true);
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Workbook does not contain any sheets.");
        setPendingImport(props.onPreviewCsv(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]), mode));
      } else {
        setPendingImport(props.onPreviewCsv(await file.text(), mode));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown file read error.";
      window.alert(`Fixture import failed: ${message}`);
    } finally {
      event.target.value = "";
      setIsReading(false);
    }
  };

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P25 Prediction-Ready CSV/XLSX Import / Export</h3>
      <p className="section-help">
        Bulk manage rounds, fixtures, team-stat evidence, recent form, market probabilities, final scores, and P41 advanced evidence fields from a spreadsheet. Export first to get the supported column template, or upload an XLSX file using those same headers.
      </p>
      <div className="actions">
        <button className="secondary" onClick={props.onExportCsv}>Export fixtures CSV</button>
        <label className="secondary file-action">
          Add/import without replacing
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "append")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Update matching fixtures
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "update")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Replace imported competition only
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replaceCompetition")} disabled={isReading} />
        </label>
        <label className="secondary file-action danger">
          Replace entire workspace
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replace")} disabled={isReading} />
        </label>
      </div>
      <ImportPreviewBox pending={pendingImport} onClear={() => setPendingImport(null)} />
      <div className="note-box">{isReading ? "Reading file…" : props.csvMessage || "No CSV/XLSX import/export action yet."}</div>
    </section>
  );
}

export function FixtureAutomationPanel(props: {
  automationMessage: string;
  onGenerateFixtures: (request: {
    competition: string;
    teamsText: string;
    startRound: number;
    format: "single" | "double";
    dateLabel: string;
  }, mode: "append" | "replace") => void;
}) {
  const defaultTeams = "Arsenal\nChelsea\nLiverpool\nManchester City";
  const [competition, setCompetition] = useState("Generated Competition");
  const [teamsText, setTeamsText] = useState(defaultTeams);
  const [startRound, setStartRound] = useState("1");
  const [format, setFormat] = useState<"single" | "double">("single");
  const [dateLabel, setDateLabel] = useState("TBC");

  const handleGenerate = (mode: "append" | "replace") => {
    if (mode === "replace") {
      const confirmed = window.confirm(
        "Replace mode deletes every fixture currently in this workspace and swaps in the generated fixture list instead. " +
          "Any tips submitted against fixtures that get removed will no longer count toward the leaderboard. " +
          "Export a JSON backup first if this is a real competition. Continue?",
      );
      if (!confirmed) return;
    }

    props.onGenerateFixtures(
      {
        competition,
        teamsText,
        startRound: Number(startRound),
        format,
        dateLabel,
      },
      mode,
    );
  };

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P20 Fixture Automation</h3>
      <p className="section-help">
        Generate a round-robin fixture list from a team list. This creates blank evidence-ready fixtures, then you can use CSV import or manual inputs to fill team stats, form, results and market data.
      </p>
      <div className="field-row">
        <label>Competition<input value={competition} onChange={(event) => setCompetition(event.target.value)} /></label>
        <label>Start round<input type="number" min="1" value={startRound} onChange={(event) => setStartRound(event.target.value)} /></label>
      </div>
      <div className="field-row">
        <label>Fixture format
          <select value={format} onChange={(event) => setFormat(event.target.value as "single" | "double")}>
            <option value="single">Single round robin</option>
            <option value="double">Double round robin</option>
          </select>
        </label>
        <label>Date label<input value={dateLabel} onChange={(event) => setDateLabel(event.target.value)} placeholder="TBC, Weekend 1, 2026-08-14" /></label>
      </div>
      <label>Teams, one per line<textarea rows={6} value={teamsText} onChange={(event) => setTeamsText(event.target.value)} /></label>
      <div className="actions">
        <button className="secondary" onClick={() => handleGenerate("append")}>Generate and append fixtures</button>
        <button className="secondary danger" onClick={() => handleGenerate("replace")}>Generate and replace fixtures</button>
      </div>
      <div className="note-box">{props.automationMessage || "Fixture automation has not run yet."}</div>
    </section>
  );
}

export function LiveFixturesPanel(props: {
  liveFixturesMessage: string;
  isLoadingLiveFixtures: boolean;
  competition: string;
  onCompetitionChange: (value: string) => void;
  onFetchLiveFixtures: (mode: "append" | "replace") => void;
}) {
  const handleFetch = (mode: "append" | "replace") => {
    if (mode === "replace") {
      const confirmed = window.confirm(
        "Replace mode deletes every fixture currently in this workspace and swaps in the live fixture list instead. " +
          "Any tips submitted against fixtures that get removed will no longer count toward the leaderboard. " +
          "Export a JSON backup first if this is a real competition. Continue?"
      );
      if (!confirmed) return;
    }
    props.onFetchLiveFixtures(mode);
  };

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P21 Live Fixtures (football-data.org)</h3>
      <p className="section-help">
        Pull real upcoming fixtures, season stats and recent form for the selected competition from
        the shared cache (populated by a scheduled cron job). Odds, match results, missing players
        and manual gate scores aren&apos;t available from this source, so those stay blank and
        editable, same as a CSV-imported or generated fixture. Note: tournaments without a normal
        league table (e.g. World Cup knockout rounds) may return fixtures and recent form but little
        or no season-stats data.
      </p>
      <div className="field-row">
        <label>
          Competition (filters which cached rows to pull in)
          <select value={props.competition} onChange={(event) => props.onCompetitionChange(event.target.value)}>
            {FREE_TIER_COMPETITIONS.map((option) => (
              <option key={option.code} value={option.code}>{option.name} ({option.code})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => handleFetch("append")} disabled={props.isLoadingLiveFixtures}>
          {props.isLoadingLiveFixtures ? "Loading…" : "Fetch live fixtures and append"}
        </button>
        <button className="secondary danger" onClick={() => handleFetch("replace")} disabled={props.isLoadingLiveFixtures}>
          Fetch live fixtures and replace
        </button>
      </div>
      <div className="note-box">{props.liveFixturesMessage || "Live fixtures have not been fetched yet."}</div>
    </section>
  );
}

export type LiveFixtureAdminStatus = {
  totalRows: number;
  futureRows: number;
  staleRows: number;
  oldestMatchDate: string | null;
  newestMatchDate: string | null;
  latestUpdatedAt: string | null;
  retentionDays: number;
  staleBeforeIso: string;
};

function formatAdminDate(value: string | null): string {
  if (!value) return "None";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function LiveFixtureMaintenancePanel(props: {
  adminSecret: string;
  adminMessage: string;
  adminStatus: LiveFixtureAdminStatus | null;
  isAdminBusy: boolean;
  competition: string;
  rememberAdminSecret: boolean;
  onAdminSecretChange: (value: string) => void;
  onRememberAdminSecretChange: (remember: boolean) => void;
  onCompetitionChange: (value: string) => void;
  onCheckStatus: () => void;
  onRefreshNow: () => void;
  onCleanupOldFixtures: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P22 Live Fixture Maintenance</h3>
      <p className="section-help">
        Admin-only controls for the shared live-fixture cache. Enter the same secret used for <code>CRON_SECRET</code> to check cache status, refresh fixtures immediately or delete stale rows. The service-role key stays server-side only.
      </p>
      <div className="field-row">
        <label>Admin / cron secret
          <input
            type="password"
            value={props.adminSecret}
            onChange={(event) => props.onAdminSecretChange(event.target.value)}
            placeholder="CRON_SECRET"
          />
        </label>
        <label>Competition to refresh
          <select value={props.competition} onChange={(event) => props.onCompetitionChange(event.target.value)}>
            {FREE_TIER_COMPETITIONS.map((option) => (
              <option key={option.code} value={option.code}>{option.name} ({option.code})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="check-label">
          <input
            type="checkbox"
            checked={props.rememberAdminSecret}
            onChange={(event) => props.onRememberAdminSecretChange(event.target.checked)}
          />{" "}
          Remember this secret on this device
        </label>
        {props.rememberAdminSecret && (
          <button
            type="button"
            className="link-button"
            onClick={() => props.onRememberAdminSecretChange(false)}
          >
            Forget saved secret
          </button>
        )}
      </div>
      {props.rememberAdminSecret && (
        <p className="section-help" style={{ marginTop: -6 }}>
          Stored only in this browser&apos;s local storage — never synced to the cloud, never included
          in JSON backups. Anyone else who uses this browser profile could see it, so only enable this
          on a device you don&apos;t share.
        </p>
      )}
      <div className="actions">
        <button className="secondary" onClick={props.onCheckStatus} disabled={props.isAdminBusy || !props.adminSecret.trim()}>
          {props.isAdminBusy ? "Working…" : "Check cache status"}
        </button>
        <button className="secondary" onClick={props.onRefreshNow} disabled={props.isAdminBusy || !props.adminSecret.trim()}>
          Refresh live fixtures now
        </button>
        <button className="secondary danger" onClick={props.onCleanupOldFixtures} disabled={props.isAdminBusy || !props.adminSecret.trim()}>
          Clean old live fixtures
        </button>
      </div>
      {props.adminStatus ? (
        <div className="result-grid compact">
          <div className="metric"><div className="label">Cache Rows</div><div className="value">{props.adminStatus.totalRows}</div></div>
          <div className="metric"><div className="label">Future Fixtures</div><div className="value">{props.adminStatus.futureRows}</div></div>
          <div className="metric"><div className="label">Stale Rows</div><div className="value">{props.adminStatus.staleRows}</div></div>
          <div className="metric"><div className="label">Latest Update</div><div className="value small-value">{formatAdminDate(props.adminStatus.latestUpdatedAt)}</div></div>
          <div className="metric"><div className="label">Oldest Match</div><div className="value small-value">{formatAdminDate(props.adminStatus.oldestMatchDate)}</div></div>
          <div className="metric"><div className="label">Newest Match</div><div className="value small-value">{formatAdminDate(props.adminStatus.newestMatchDate)}</div></div>
        </div>
      ) : null}
      <div className="note-box">{props.adminMessage || "No live fixture maintenance action yet."}</div>
    </section>
  );
}


export function WorkspaceRestoreResolverPanel(props: {
  summary: WorkspaceRestoreResolverSummary;
  cloudPreviewMessage: string;
  isCloudBusy: boolean;
  onRefreshCloudPreview: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P40 Workspace Restore Conflict Resolver</h3>
      <p className="section-help">
        Compare current browser data, Supabase preview, localStorage rescue copies and P39 recovery snapshots before restoring or saving over anything. This panel is read-only: use the existing cloud/vault controls to restore once you know which copy is safest.
      </p>
      <div className="note-box">
        <strong>Recommendation:</strong> {props.summary.recommendedLabel}
      </div>
      {props.summary.warnings.length > 0 && (
        <div className="note-box warning">
          {props.summary.warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      )}
      <div className="actions">
        <button className="secondary" onClick={props.onRefreshCloudPreview} disabled={props.isCloudBusy}>
          {props.isCloudBusy ? "Checking cloud…" : "Refresh Supabase preview"}
        </button>
      </div>
      <div className="note-box">{props.cloudPreviewMessage}</div>
      <div className="table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Workspace</th>
              <th>Saved</th>
              <th>Status</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {props.summary.candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td><strong>{candidate.label}</strong><br /><span className="muted-text">{candidate.sourceType}</span></td>
                <td>
                  {candidate.metrics.fixtureCount} fixtures / {candidate.metrics.competitionCount} competitions / {candidate.metrics.userTipCount} tips
                  <br />
                  <span className="muted-text">Aliases {candidate.metrics.aliasCount} · Presets {candidate.metrics.tuningPresetCount} · Logs {candidate.metrics.modelChangeLogCount}</span>
                </td>
                <td>{candidate.lastUpdatedMs ? new Date(candidate.lastUpdatedMs).toLocaleString() : "Unknown"}</td>
                <td>{candidate.recommendation}</td>
                <td>{candidate.warnings.length ? candidate.warnings.join(" ") : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function WorkspaceRecoveryVaultPanel(props: {
  message: string;
  snapshots: import("../lib/workspaceBackupVault").WorkspaceRecoverySnapshot[];
  summary: import("../lib/workspaceBackupVault").WorkspaceRecoveryVaultSummary;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onExportVault: () => void;
  onClearVault: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P39 Workspace Recovery Vault</h3>
      <p className="section-help">
        Local recovery checkpoints for accidental resets, imports, browser-key migrations or cloud/local conflicts. This is separate from Supabase mirroring and is meant to make manual competitions easier to recover.
      </p>
      <div className="result-grid compact">
        <div className="metric"><div className="label">Snapshots</div><div className="value">{props.summary.snapshotCount}</div></div>
        <div className="metric"><div className="label">Automatic</div><div className="value">{props.summary.automaticCount}</div></div>
        <div className="metric"><div className="label">Protected</div><div className="value">{props.summary.manualCount}</div></div>
        <div className="metric"><div className="label">Latest</div><div className="value small-value">{props.summary.latestSnapshotAt ? new Date(props.summary.latestSnapshotAt).toLocaleString() : "None yet"}</div></div>
      </div>
      <div className="note-box">
        <strong>Richest saved snapshot:</strong> {props.summary.richestSnapshotLabel || "None yet"} — {props.summary.richestSnapshotDescription}
      </div>
      <div className="actions">
        <button className="secondary" onClick={props.onCreateSnapshot}>Create recovery snapshot now</button>
        <button className="secondary" onClick={props.onExportVault} disabled={props.snapshots.length === 0}>Export recovery vault</button>
        <button className="secondary danger" onClick={props.onClearVault} disabled={props.snapshots.length === 0}>Clear vault</button>
      </div>
      <div className="note-box">{props.message}</div>
      {props.snapshots.length === 0 ? (
        <div className="note-box">No recovery snapshots yet. The app will create automatic snapshots when the workspace shape changes, and protected snapshots before reset/import/restore actions.</div>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead>
              <tr><th>Created</th><th>Type</th><th>Label</th><th>Workspace</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {props.snapshots.slice(0, 12).map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{new Date(snapshot.createdAt).toLocaleString()}</td>
                  <td>{snapshot.reason}</td>
                  <td><strong>{snapshot.label}</strong></td>
                  <td>{snapshot.metrics.fixtureCount} fixtures / {snapshot.metrics.competitionCount} competitions / {snapshot.metrics.userTipCount} tips</td>
                  <td>
                    <button className="secondary compact-button" onClick={() => props.onRestoreSnapshot(snapshot.id)}>Restore</button>{" "}
                    <button className="secondary compact-button danger" onClick={() => props.onDeleteSnapshot(snapshot.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
