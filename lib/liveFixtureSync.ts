import {
  fetchTeamStatsForCompetition,
  fetchUpcomingMatches,
  fetchRecentFormForTeams,
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
  const [teamStatsById, upcomingMatches] = await Promise.all([
    fetchTeamStatsForCompetition(competitionCode),
    fetchUpcomingMatches(competitionCode, daysAhead),
  ]);

  const uniqueTeamIds = Array.from(
    new Set(upcomingMatches.flatMap((match) => [match.homeTeam.id, match.awayTeam.id])),
  );
  const recentFormById = await fetchRecentFormForTeams(uniqueTeamIds);
  const fetchedAt = new Date().toISOString();

  const rows = upcomingMatches.map((match) => ({
    id: String(match.id),
    competition: match.competitionName,
    round: match.matchday ? `Matchday ${match.matchday}` : null,
    match_date: match.utcDate,
    home_team: match.homeTeam.name,
    away_team: match.awayTeam.name,
    home_stats: teamStatsById.get(match.homeTeam.id) ?? emptyStats,
    away_stats: teamStatsById.get(match.awayTeam.id) ?? emptyStats,
    home_recent_form: recentFormById.get(match.homeTeam.id) ?? [],
    away_recent_form: recentFormById.get(match.awayTeam.id) ?? [],
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
