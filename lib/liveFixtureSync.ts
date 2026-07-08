import {
  fetchTeamStatsForCompetition,
  fetchUpcomingMatches,
  fetchRecentFormForTeams,
  type TeamStatsById,
} from "./footballDataClient";
import { getSupabaseServiceRoleClient } from "./supabaseServerClient";

export const DEFAULT_LIVE_FIXTURE_COMPETITION = "PL";
export const DEFAULT_LIVE_FIXTURE_DAYS_AHEAD = 14;

const emptyStats = {
  played: 0,
  points: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  homePlayed: 0,
  homePoints: 0,
  homeGoalsFor: 0,
  homeGoalsAgainst: 0,
  awayPlayed: 0,
  awayPoints: 0,
  awayGoalsFor: 0,
  awayGoalsAgainst: 0,
};

export type LiveFixtureSyncResult = {
  ok: true;
  competition: string;
  fixturesUpserted: number;
  teamsProcessed: number;
  fetchedAt: string;
};

export async function syncLiveFixtures(
  competitionCode = DEFAULT_LIVE_FIXTURE_COMPETITION,
  daysAhead = DEFAULT_LIVE_FIXTURE_DAYS_AHEAD,
): Promise<LiveFixtureSyncResult> {
  // Team stats come from a standings table, which some competitions don't
  // have at all (e.g. a knockout-stage World Cup has no single league table).
  // A failure here shouldn't block fixtures/form, which are independent —
  // fall back to an empty map so every team just gets the emptyStats default.
  const [teamStatsById, upcomingMatches] = await Promise.all([
    fetchTeamStatsForCompetition(competitionCode).catch((err): TeamStatsById => {
      console.warn(
        `[live-fixtures] Could not fetch team stats for ${competitionCode}, continuing with blank stats:`,
        err instanceof Error ? err.message : err,
      );
      return new Map();
    }),
    fetchUpcomingMatches(competitionCode, daysAhead),
  ]);

  // Knockout-stage tournaments (World Cup semifinals not yet determined, etc.)
  // can return a placeholder team like "Winner Match 73" with id: null until
  // the previous round is decided. Filter those out — there's nothing to
  // look up recent form for yet, and the API rejects a null/non-integer id.
  const uniqueTeamIds = Array.from(
    new Set(
      upcomingMatches
        .flatMap((match) => [match.homeTeam.id, match.awayTeam.id])
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const recentFormById = await fetchRecentFormForTeams(uniqueTeamIds);
  const fetchedAt = new Date().toISOString();

  // Placeholder teams (id: null) simply have no stats/form to look up yet —
  // Map.get(null) would be a type error even though it's safe at runtime, so
  // this makes the "no id yet" case explicit instead of relying on that.
  function statsFor(id: number | null) {
    return (id !== null ? teamStatsById.get(id) : undefined) ?? emptyStats;
  }
  function recentFormFor(id: number | null) {
    return (id !== null ? recentFormById.get(id) : undefined) ?? [];
  }

  const rows = upcomingMatches.map((match) => ({
    id: String(match.id),
    competition: match.competitionName,
    round: match.matchday ? `Matchday ${match.matchday}` : null,
    match_date: match.utcDate,
    home_team: match.homeTeam.name,
    away_team: match.awayTeam.name,
    home_stats: statsFor(match.homeTeam.id),
    away_stats: statsFor(match.awayTeam.id),
    home_recent_form: recentFormFor(match.homeTeam.id),
    away_recent_form: recentFormFor(match.awayTeam.id),
    status: "SCHEDULED",
    updated_at: fetchedAt,
  }));

  if (rows.length > 0) {
    const supabase = getSupabaseServiceRoleClient();
    const { error } = await supabase.from("live_fixtures").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return {
    ok: true,
    competition: competitionCode,
    fixturesUpserted: rows.length,
    teamsProcessed: uniqueTeamIds.length,
    fetchedAt,
  };
}
