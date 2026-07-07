"use client";

import { useEffect, useState } from "react";
import { Session, SupabaseClient } from "@supabase/supabase-js";

export function useSupabaseAuth(supabase: SupabaseClient | null) {
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState(
    "Supabase Auth is optional until env vars are added.",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

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
      setAuthMessage(
        data.session?.user.email
          ? `Signed in as ${data.session.user.email}.`
          : "Not signed in. Use email magic link to enable cloud save/load.",
      );
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage(
        nextSession?.user.email
          ? `Signed in as ${nextSession.user.email}.`
          : "Signed out. Browser autosave still works locally.",
      );
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function sendMagicLink() {
    if (!supabase) {
      setAuthMessage(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    const email = authEmail.trim();
    if (!email) {
      setAuthMessage("Enter your email address first.");
      return;
    }

    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setAuthMessage("Magic link sent. Open the email on this device/browser to sign in.");
    } catch {
      setAuthMessage("Magic link failed. Check Supabase Auth settings and email configuration.");
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
      setAuthMessage("Signed out. Browser autosave still works locally.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  return {
    activeUserEmail: session?.user.email ?? "",
    authEmail,
    authMessage,
    isAuthBusy,
    session,
    sendMagicLink,
    setAuthEmail,
    signOutOfSupabase,
  };
}
