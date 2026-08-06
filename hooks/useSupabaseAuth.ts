"use client";

import { useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";

// Single-admin model, MS-AES-style: exactly one user exists, created
// manually in the Supabase dashboard (Authentication -> Users -> Add user).
// There's no self-service sign-up in this app at all — the login form only
// ever checks a given email+password against whatever account already
// exists in Supabase Auth. The ADMIN_EMAIL check below is a cheap second
// layer on top of that, in case public sign-ups ever get left enabled in
// the Supabase project by mistake.
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();

export function useSupabaseAuth(supabase: SupabaseClient | null) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMessage, setAuthMessage] = useState(
    "Supabase Auth is optional until env vars are added.",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  function describeSession(nextSession: Session | null): string {
    if (!nextSession?.user.email) return "Not signed in.";
    if (!ADMIN_EMAIL) return `Signed in as ${nextSession.user.email}, but NEXT_PUBLIC_ADMIN_EMAIL is not set — nobody is authorized yet.`;
    if (nextSession.user.email.trim().toLowerCase() !== ADMIN_EMAIL) {
      return `Signed in as ${nextSession.user.email}, which is not the authorized admin account.`;
    }
    return `Signed in as ${nextSession.user.email}.`;
  }

  useEffect(() => {
    if (!supabase) {
      setAuthMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthMessage("Could not read Supabase session.");
        return;
      }
      setSession(data.session);
      setAuthMessage(describeSession(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage(describeSession(nextSession));
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithPassword() {
    if (!supabase) {
      setAuthMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    const email = loginEmail.trim();
    if (!email || !loginPassword) {
      setAuthMessage("Enter both email and password.");
      return;
    }

    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: loginPassword });
      if (error) throw error;
      setLoginPassword("");
      // onAuthStateChange picks up the new session and updates authMessage.
    } catch {
      setAuthMessage("Sign-in failed. Check the email and password, and that this user exists in Supabase Auth.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function signOutOfSupabase() {
    if (!supabase) return;
    setIsAuthBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setAuthMessage("Signed out.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  const isAdmin = Boolean(
    ADMIN_EMAIL && session?.user.email && session.user.email.trim().toLowerCase() === ADMIN_EMAIL,
  );

  return {
    activeUserEmail: session?.user.email ?? "",
    authMessage,
    isAdmin,
    isAuthBusy,
    loginEmail,
    loginPassword,
    session,
    setLoginEmail,
    setLoginPassword,
    signInWithPassword,
    signOutOfSupabase,
  };
}
