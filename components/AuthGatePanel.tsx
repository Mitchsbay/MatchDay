"use client";

import type { Session } from "@supabase/supabase-js";

export function AuthGatePanel(props: {
  session: Session | null;
  loginEmail: string;
  loginPassword: string;
  authMessage: string;
  isAuthBusy: boolean;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const isSignedInButNotAdmin = Boolean(props.session);

  return (
    <main className="container" style={{ display: "flex", minHeight: "70vh", alignItems: "center", justifyContent: "center" }}>
      <section className="card" style={{ maxWidth: 380, width: "100%" }}>
        {isSignedInButNotAdmin ? (
          <>
            <h1 style={{ marginTop: 0 }}>Not authorized</h1>
            <p className="section-help">
              This account isn&apos;t authorized to access this workspace. Check that{" "}
              <code>NEXT_PUBLIC_ADMIN_EMAIL</code> is set correctly, or sign in with the correct
              account.
            </p>
            <div className="actions">
              <button className="secondary" onClick={props.onSignOut} disabled={props.isAuthBusy}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ marginTop: 0 }}>Sign in</h1>
            <p className="section-help">
              This workspace is private. Sign in with the admin account.
            </p>
            <div className="field-row">
              <label>Email
                <input
                  className="text-input"
                  type="email"
                  value={props.loginEmail}
                  onChange={(event) => props.onLoginEmailChange(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </label>
            </div>
            <div className="field-row">
              <label>Password
                <input
                  className="text-input"
                  type="password"
                  value={props.loginPassword}
                  onChange={(event) => props.onLoginPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") props.onSignIn();
                  }}
                />
              </label>
            </div>
            <div className="actions">
              <button className="primary" onClick={props.onSignIn} disabled={props.isAuthBusy}>
                {props.isAuthBusy ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </>
        )}
        <div className="note-box">{props.authMessage}</div>
      </section>
    </main>
  );
}
