"use client";

import type { ChangeEvent } from "react";

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

export function FixtureCsvPanel(props: {
  csvMessage: string;
  onExportCsv: () => void;
  onImportCsv: (csv: string, mode: "append" | "replace") => void;
}) {
  const handleFileImport = (event: ChangeEvent<HTMLInputElement>, mode: "append" | "replace") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      props.onImportCsv(String(reader.result ?? ""), mode);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h3>P19 Fixture CSV Import / Export</h3>
      <p className="section-help">
        Bulk manage rounds, fixtures, team-stat evidence, recent form, market probabilities and final scores from a spreadsheet. Export first to get the supported column template.
      </p>
      <div className="actions">
        <button className="secondary" onClick={props.onExportCsv}>Export fixtures CSV</button>
        <label className="secondary file-action">
          Import CSV and append
          <input type="file" accept="text/csv,.csv" onChange={(event) => handleFileImport(event, "append")} />
        </label>
        <label className="secondary file-action">
          Import CSV and replace fixtures
          <input type="file" accept="text/csv,.csv" onChange={(event) => handleFileImport(event, "replace")} />
        </label>
      </div>
      <div className="note-box">{props.csvMessage || "No CSV import/export action yet."}</div>
    </section>
  );
}
