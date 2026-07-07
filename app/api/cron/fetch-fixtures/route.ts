import { NextRequest, NextResponse } from "next/server";
import {
  fetchTeamStatsForCompetition,
  fetchUpcomingMatches,
  fetchRecentFormForTeams,
} from "../../../../lib/footballDataClient";
import { getSupabaseServiceRoleClient } from "../../../../lib/supabaseServerClient";

// Sequential per-team recent-form calls can take a couple of minutes on a
// busy matchday, so give this route plenty of runway.
export const maxDuration = 300;

const DEFAULT_COMPETITION = "PL"; // Premier League on football-data.org's free tier
const DAYS_AHEAD = 14;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitionCode = req.nextUrl.searchParams.get("competition") ?? DEFAULT_COMPETITION;

  try {
    const [teamStatsById, upcomingMatches] = await Promise.all([
      fetchTeamStatsForCompetition(competitionCode),
      fetchUpcomingMatches(competitionCode, DAYS_AHEAD),
    ]);

    const uniqueTeamIds = Array.from(
      new Set(upcomingMatches.flatMap((m) => [m.homeTeam.id, m.awayTeam.id]))
    );
    const recentFormById = await fetchRecentFormForTeams(uniqueTeamIds);

    const emptyStats = {
      played: 0, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
      homePlayed: 0, homePoints: 0, homeGoalsFor: 0, homeGoalsAgainst: 0,
      awayPlayed: 0, awayPoints: 0, awayGoalsFor: 0, awayGoalsAgainst: 0,
    };

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
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const supabase = getSupabaseServiceRoleClient();
      const { error } = await supabase.from("live_fixtures").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      competition: competitionCode,
      fixturesUpserted: rows.length,
      teamsProcessed: uniqueTeamIds.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
