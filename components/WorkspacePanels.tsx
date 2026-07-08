"use client";

import { ChangeEvent, useState } from "react";
import { FREE_TIER_COMPETITIONS } from "../lib/competitions";

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
  authEmail: string;
  authMessage: string;
  activeUserEmail: string;
  cloudWorkspaceId: string;
  cloudMessage: string;
  isCloudBusy: boolean;
  isSignedIn: boolean;
  onAuthEmailChange: (value: string) => void;
  onSendMagicLink: () => void;
  onSignOut: () => void;
  onCloudWorkspaceIdChange: (value: string) => void;
  onSaveCloud: () => void;
  onLoadCloud: () => void;
  onNewCloudId: () => void;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P13 Supabase Auth + User-Owned Cloud Persistence</h3>
      <p className="section-help">
        Optional cloud sync with Supabase Auth. Add your Supabase URL and anon key as Vercel environment variables, run the SQL in <code>supabase/schema.sql</code>, then sign in and save or load this workspace by ID. Browser autosave still works even when Supabase is not configured.
      </p>
      <div className="field-row">
        <label>Email for Supabase sign-in<input value={props.authEmail} onChange={(event) => props.onAuthEmailChange(event.target.value)} placeholder="you@example.com" /></label>
      </div>
      <div className="actions">
        <button className="secondary" onClick={props.onSendMagicLink} disabled={props.isCloudBusy || props.isSignedIn}>Send magic link</button>
        <button className="secondary" onClick={props.onSignOut} disabled={props.isCloudBusy || !props.isSignedIn}>Sign out</button>
      </div>
      <div className="note-box">{props.authMessage}{props.activeUserEmail ? ` Cloud saves are owned by ${props.activeUserEmail}.` : ""}</div>
      <div className="field-row">
        <label>Cloud workspace ID<input value={props.cloudWorkspaceId} onChange={(event) => props.onCloudWorkspaceIdChange(event.target.value)} /></label>
      </div>
      <div className="actions">
        <button className="secondary" onClick={props.onSaveCloud} disabled={props.isCloudBusy}>Save to Supabase</button>
        <button className="secondary" onClick={props.onLoadCloud} disabled={props.isCloudBusy}>Load from Supabase</button>
        <button className="secondary" onClick={props.onNewCloudId} disabled={props.isCloudBusy}>New cloud ID</button>
      </div>
      <div className="note-box">{props.cloudMessage}</div>
    </section>
  );
}


export function CustomCompetitionImportPanel(props: {
  message: string;
  onExportTemplate: () => void;
  onImportRawCompetition: (csv: string, mode: "append" | "replace") => void;
}) {
  const [isReading, setIsReading] = useState(false);

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>, mode: "append" | "replace") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (mode === "replace") {
      const confirmed = window.confirm(
        "Replace mode deletes every fixture currently in this workspace and swaps in the custom competition import instead. " +
          "Any tips submitted against removed fixtures will no longer count toward the leaderboard. Export a JSON backup first if this is a real competition. Continue?",
      );
      if (!confirmed) {
        event.target.value = "";
        return;
      }
    }

    setIsReading(true);
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Workbook does not contain any sheets.");
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        props.onImportRawCompetition(csv, mode);
      } else {
        const csv = await file.text();
        props.onImportRawCompetition(csv, mode);
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
      <h3>P24 Custom Competition Builder</h3>
      <p className="section-help">
        Import an unsupported league or competition from raw results and upcoming fixtures. The app calculates standings, home/away splits and recent form automatically, then turns the rows into normal prediction fixtures for Quick Prediction.
      </p>
      <div className="actions">
        <button className="secondary" onClick={props.onExportTemplate}>Export raw results template</button>
        <label className="secondary file-action">
          Import raw CSV/XLSX and append
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "append")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Import raw CSV/XLSX and replace fixtures
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replace")} disabled={isReading} />
        </label>
      </div>
      <div className="note-box">{isReading ? "Reading file…" : props.message || "No custom competition import has run yet."}</div>
      <p className="section-help small-help">
        Required raw columns: competition, round, date, home_team, away_team, home_goals, away_goals, status. Final rows build the table/form history; scheduled rows become upcoming prediction fixtures.
      </p>
    </section>
  );
}

export function FixtureCsvPanel(props: {
  csvMessage: string;
  onExportCsv: () => void;
  onImportCsv: (csv: string, mode: "append" | "replace") => void;
}) {
  const [isReading, setIsReading] = useState(false);

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>, mode: "append" | "replace") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (mode === "replace") {
      const confirmed = window.confirm(
        "Replace mode deletes every fixture currently in this workspace and swaps in the CSV/XLSX rows instead. " +
          "Any tips submitted against fixtures that get removed will no longer count toward the leaderboard. " +
          "This can't be undone. Continue?"
      );
      if (!confirmed) {
        event.target.value = "";
        return;
      }
    }

    setIsReading(true);
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Workbook does not contain any sheets.");
        props.onImportCsv(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]), mode);
      } else {
        props.onImportCsv(await file.text(), mode);
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
      <h3>P24 Prediction-Ready CSV/XLSX Import / Export</h3>
      <p className="section-help">
        Bulk manage rounds, fixtures, team-stat evidence, recent form, market probabilities and final scores from a spreadsheet. Export first to get the supported column template, or upload an XLSX file using those same headers.
      </p>
      <div className="actions">
        <button className="secondary" onClick={props.onExportCsv}>Export fixtures CSV</button>
        <label className="secondary file-action">
          Import CSV/XLSX and append
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "append")} disabled={isReading} />
        </label>
        <label className="secondary file-action">
          Import CSV/XLSX and replace fixtures
          <input type="file" accept="text/csv,.csv,.xlsx,.xls" onChange={(event) => handleFileImport(event, "replace")} disabled={isReading} />
        </label>
      </div>
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
