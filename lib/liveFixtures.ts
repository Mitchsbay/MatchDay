import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fixture } from "./sampleData";
import type { RecentFormGame, TeamStats } from "./scoringEngine";
import { createBlankFixture } from "./workspace";

// Row shape of public.live_fixtures (see supabase/schema.sql), read with the
// public anon key under a public-read RLS policy. No secrets involved here —
// the service-role key used to *write* this table lives only in
// lib/supabaseServerClient.ts, which this file never imports.
export type LiveFixtureRow = {
  id: string;
  competition: string;
  round: string | null;
  match_date: string;
  home_team: string;
  away_team: string;
  home_stats: TeamStats;
  away_stats: TeamStats;
  home_recent_form: RecentFormGame[];
  away_recent_form: RecentFormGame[];
};

export type LiveFixturesFetchResult = {
  fixtures: Fixture[];
  warnings: string[];
};

function formatMatchDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Pure and exported separately so it can be smoke-tested without touching
// Supabase: everything the fetch fixtures cron job supplies maps onto the
// original P3-era Fixture fields. Anything added since (odds market, match
// result, missing players, team/match context, manual scores) has no source
// from football-data.org, so it comes from createBlankFixture's defaults and
// stays fully user-editable, exactly like a CSV-imported or generated fixture.
export function mapLiveFixtureRow(row: LiveFixtureRow): Fixture {
  const blank = createBlankFixture(row.round ?? "Imported Round", row.competition);
  return {
    ...blank,
    id: row.id,
    competition: row.competition,
    round: row.round ?? blank.round,
    date: formatMatchDate(row.match_date),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeStats: row.home_stats,
    awayStats: row.away_stats,
    homeRecentForm: row.home_recent_form,
    awayRecentForm: row.away_recent_form,
  };
}

export async function fetchLiveFixtures(
  supabase: SupabaseClient | null,
  competition?: string
): Promise<LiveFixturesFetchResult> {
  if (!supabase) {
    return {
      fixtures: [],
      warnings: ["Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."],
    };
  }

  let query = supabase.from("live_fixtures").select("*").order("match_date", { ascending: true });
  if (competition) query = query.eq("competition", competition);

  const { data, error } = await query;
  if (error) {
    return { fixtures: [], warnings: [`Could not load live fixtures: ${error.message}`] };
  }

  const rows = (data ?? []) as LiveFixtureRow[];
  if (rows.length === 0) {
    return { fixtures: [], warnings: ["No live fixtures yet — the cron job may not have run."] };
  }

  return { fixtures: rows.map(mapLiveFixtureRow), warnings: [] };
}
