import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_LIVE_FIXTURE_RETENTION_DAYS = 14;

export type LiveFixtureMaintenanceSummary = {
  totalRows: number;
  futureRows: number;
  staleRows: number;
  oldestMatchDate: string | null;
  newestMatchDate: string | null;
  latestUpdatedAt: string | null;
  retentionDays: number;
  staleBeforeIso: string;
};

export type LiveFixtureCleanupResult = {
  deletedRows: number;
  staleBeforeIso: string;
  retentionDays: number;
};

export type LiveFixtureMaintenanceRow = {
  match_date: string;
  updated_at: string | null;
};

export function getLiveFixtureStaleCutoffIso(
  now: Date = new Date(),
  retentionDays = DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
): string {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

export function summariseLiveFixtureRows(
  rows: LiveFixtureMaintenanceRow[],
  now: Date = new Date(),
  retentionDays = DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
): LiveFixtureMaintenanceSummary {
  const nowMs = now.getTime();
  const staleBeforeIso = getLiveFixtureStaleCutoffIso(now, retentionDays);
  const staleBeforeMs = new Date(staleBeforeIso).getTime();

  const sortedMatchDates = rows
    .map((row) => row.match_date)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const sortedUpdated = rows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    totalRows: rows.length,
    futureRows: rows.filter((row) => new Date(row.match_date).getTime() >= nowMs).length,
    staleRows: rows.filter((row) => new Date(row.match_date).getTime() < staleBeforeMs).length,
    oldestMatchDate: sortedMatchDates[0] ?? null,
    newestMatchDate: sortedMatchDates[sortedMatchDates.length - 1] ?? null,
    latestUpdatedAt: sortedUpdated[sortedUpdated.length - 1] ?? null,
    retentionDays,
    staleBeforeIso,
  };
}

export async function getLiveFixtureMaintenanceSummary(
  supabase: SupabaseClient,
  retentionDays = DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
): Promise<LiveFixtureMaintenanceSummary> {
  const { data, error } = await supabase
    .from("live_fixtures")
    .select("match_date, updated_at")
    .order("match_date", { ascending: true });

  if (error) throw new Error(`Could not read live fixture status: ${error.message}`);

  return summariseLiveFixtureRows((data ?? []) as LiveFixtureMaintenanceRow[], new Date(), retentionDays);
}

export async function cleanupOldLiveFixtures(
  supabase: SupabaseClient,
  retentionDays = DEFAULT_LIVE_FIXTURE_RETENTION_DAYS,
): Promise<LiveFixtureCleanupResult> {
  const staleBeforeIso = getLiveFixtureStaleCutoffIso(new Date(), retentionDays);
  const { count, error } = await supabase
    .from("live_fixtures")
    .delete({ count: "exact" })
    .lt("match_date", staleBeforeIso);

  if (error) throw new Error(`Could not clean live fixtures: ${error.message}`);

  return {
    deletedRows: count ?? 0,
    staleBeforeIso,
    retentionDays,
  };
}
