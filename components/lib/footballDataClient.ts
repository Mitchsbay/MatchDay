// Server-only. Never imported from a "use client" component — this holds the
// FOOTBALL_DATA_API_KEY server secret and is only ever called from
// app/api/cron/fetch-fixtures/route.ts.

const BASE_URL = "https://api.football-data.org/v4";

type TeamStatsLike = {
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  homePlayed: number;
  homePoints: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayPlayed: number;
  awayPoints: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
};

type RecentFormGameLike = { result: "W" | "D" | "L"; goalsFor: number; goalsAgainst: number };

function authHeaders(): HeadersInit {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY environment variable.");
  }
  return { "X-Auth-Token": token };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Standings (team stats) -------------------------------------------------

type StandingsTeam = {
  team: { id: number; name: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
};

type StandingsResponse = {
  // group-stage tournaments (World Cup, Euros, etc.) return one entry per
  // group, each still typed "TOTAL"/"HOME"/"AWAY" — group is what actually
  // distinguishes them. A flat domestic league returns just one of each type
  // with group: null.
  standings: Array<{ type: "TOTAL" | "HOME" | "AWAY"; group: string | null; table: StandingsTeam[] }>;
};

export type TeamStatsById = Map<number, TeamStatsLike>;

export async function fetchTeamStatsForCompetition(competitionCode: string): Promise<TeamStatsById> {
  const data = await getJson<StandingsResponse>(`/competitions/${competitionCode}/standings`);

  // .filter + flatMap rather than .find: a group-stage tournament has one
  // "TOTAL" entry per group, and .find() would silently grab only the first
  // group, leaving every team from every other group with blank stats.
  const total = data.standings.filter((s) => s.type === "TOTAL").flatMap((s) => s.table);
  const home = data.standings.filter((s) => s.type === "HOME").flatMap((s) => s.table);
  const away = data.standings.filter((s) => s.type === "AWAY").flatMap((s) => s.table);

  const homeById = new Map(home.map((row) => [row.team.id, row]));
  const awayById = new Map(away.map((row) => [row.team.id, row]));

  const result: TeamStatsById = new Map();
  for (const row of total) {
    const homeRow = homeById.get(row.team.id);
    const awayRow = awayById.get(row.team.id);
    result.set(row.team.id, {
      played: row.playedGames,
      points: row.points,
      wins: row.won,
      draws: row.draw,
      losses: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      homePlayed: homeRow?.playedGames ?? 0,
      homePoints: homeRow?.points ?? 0,
      homeGoalsFor: homeRow?.goalsFor ?? 0,
      homeGoalsAgainst: homeRow?.goalsAgainst ?? 0,
      awayPlayed: awayRow?.playedGames ?? 0,
      awayPoints: awayRow?.points ?? 0,
      awayGoalsFor: awayRow?.goalsFor ?? 0,
      awayGoalsAgainst: awayRow?.goalsAgainst ?? 0,
    });
  }
  return result;
}

// --- Upcoming fixtures -------------------------------------------------------

export type UpcomingMatch = {
  id: number;
  utcDate: string;
  matchday: number | null;
  competitionName: string;
  // Both id and name are null for a knockout-stage placeholder team (e.g. a
  // semifinal slot not yet filled) whose identity isn't decided yet.
  homeTeam: { id: number | null; name: string | null };
  awayTeam: { id: number | null; name: string | null };
};

type MatchesResponse = {
  matches: Array<{
    id: number;
    utcDate: string;
    matchday: number | null;
    status: string;
    competition: { name: string };
    homeTeam: { id: number | null; name: string | null };
    awayTeam: { id: number | null; name: string | null };
  }>;
};

export async function fetchUpcomingMatches(
  competitionCode: string,
  daysAhead: number
): Promise<UpcomingMatch[]> {
  const dateFrom = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const data = await getJson<MatchesResponse>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED&dateFrom=${dateFrom}&dateTo=${dateTo}`
  );

  return data.matches.map((m) => ({
    id: m.id,
    utcDate: m.utcDate,
    matchday: m.matchday,
    competitionName: m.competition.name,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
  }));
}

// --- Recent form (per team, from actual finished matches) -------------------

type TeamMatchesResponse = {
  matches: Array<{
    status: string;
    homeTeam: { id: number };
    awayTeam: { id: number };
    score: { fullTime: { home: number | null; away: number | null } };
  }>;
};

// One call per team, sequential with a short delay to stay under
// football-data.org's free-tier rate limit (10 req/min). The default 8s delay leaves room for the two competition-level calls made by the cron route before this loop starts.
export async function fetchRecentFormForTeams(
  teamIds: number[],
  gamesPerTeam = 5,
  delayMs = 8000
): Promise<Map<number, RecentFormGameLike[]>> {
  const result = new Map<number, RecentFormGameLike[]>();

  for (const teamId of teamIds) {
    const data = await getJson<TeamMatchesResponse>(
      `/teams/${teamId}/matches?status=FINISHED&limit=${gamesPerTeam}`
    );

    const form: RecentFormGameLike[] = data.matches.slice(-gamesPerTeam).map((match) => {
      const isHome = match.homeTeam.id === teamId;
      const goalsFor = isHome ? match.score.fullTime.home ?? 0 : match.score.fullTime.away ?? 0;
      const goalsAgainst = isHome ? match.score.fullTime.away ?? 0 : match.score.fullTime.home ?? 0;
      const result: RecentFormGameLike["result"] =
        goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";
      return { result, goalsFor, goalsAgainst };
    });

    result.set(teamId, form);
    await sleep(delayMs);
  }

  return result;
}
