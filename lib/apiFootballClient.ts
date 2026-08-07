// Server-only. Never imported from a "use client" component — holds the
// API_FOOTBALL_KEY secret. This is a *different* provider from
// football-data.org (lib/footballDataClient.ts): API-Football (api-sports.io)
// is used here specifically because football-data.org's free tier has no
// injury/suspension data at all. Separate API key, separate team-ID space —
// there is no shared identifier between the two providers, so teams are
// matched by name.

const BASE_URL = "https://v3.football.api-sports.io";

function authHeaders(): HeadersInit {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("Missing API_FOOTBALL_KEY environment variable.");
  }
  return { "x-apisports-key": key };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API-Football ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

type ApiFootballTeamSearchResponse = {
  response: Array<{ team: { id: number; name: string } }>;
};

/**
 * Resolves a team name to API-Football's own team ID. There is no shared ID
 * with football-data.org, so this is a best-effort name match: exact
 * case-insensitive match wins if present, otherwise the API's own top
 * search result. Returns null rather than throwing on no match — a team
 * API-Football doesn't recognise (naming difference, lower-tier league it
 * doesn't cover) is an expected outcome, not a hard failure.
 */
export async function searchTeamId(teamName: string): Promise<{ id: number; name: string } | null> {
  const trimmed = teamName.trim();
  if (!trimmed) return null;

  const data = await getJson<ApiFootballTeamSearchResponse>(`/teams?name=${encodeURIComponent(trimmed)}`);
  const results = data.response ?? [];
  if (results.length === 0) return null;

  const exact = results.find((r) => r.team.name.toLowerCase() === trimmed.toLowerCase());
  const match = exact ?? results[0];
  return { id: match.team.id, name: match.team.name };
}

type ApiFootballInjuryResponse = {
  response: Array<{
    player: { id: number; name: string; type?: string; reason?: string };
    team: { id: number; name: string };
  }>;
};

export type RawInjury = {
  playerName: string;
  type: string;
  reason: string;
};

/**
 * Current injuries/suspensions for a team, for the given season. API-Football
 * indexes by season-start year (e.g. 2025 covers the 2025-26 season) —
 * callers should pass whichever start-year is currently in progress.
 */
export async function fetchInjuries(teamId: number, season: number): Promise<RawInjury[]> {
  const data = await getJson<ApiFootballInjuryResponse>(`/injuries?team=${teamId}&season=${season}`);
  const rows = data.response ?? [];
  return rows.map((row) => ({
    playerName: row.player.name,
    type: row.player.type || "Unknown",
    reason: row.player.reason || "Not specified",
  }));
}

export type MissingPlayerSuggestion = {
  name: string;
  role: string;
  importance: "backup" | "rotation" | "starter" | "key" | "critical";
  reason: "injury" | "suspension" | "unavailable" | "doubtful";
  expectedStarter: boolean;
};

export function classifyReason(type: string): MissingPlayerSuggestion["reason"] {
  const lower = type.toLowerCase();
  if (lower.includes("suspen")) return "suspension";
  if (lower.includes("doubt")) return "doubtful";
  if (lower.includes("injur")) return "injury";
  return "unavailable";
}

/**
 * End-to-end: resolve the team name, pull its current injury/suspension
 * list, and map into our MissingPlayer shape. API-Football's injury feed
 * doesn't indicate squad importance or starter status, so those are left as
 * conservative defaults ("rotation" / not expected starter) rather than
 * guessed — this is meant to save typing the name/reason, not to assert
 * how much the absence matters. That judgment call stays with whoever
 * reviews the suggestion.
 */
export async function suggestMissingPlayersForTeam(
  teamName: string,
  season: number,
): Promise<{ suggestions: MissingPlayerSuggestion[]; warning: string | null }> {
  const team = await searchTeamId(teamName);
  if (!team) {
    return { suggestions: [], warning: `Could not find "${teamName}" in API-Football.` };
  }

  const injuries = await fetchInjuries(team.id, season);
  if (injuries.length === 0) {
    return { suggestions: [], warning: `No current injuries/suspensions found for ${team.name}.` };
  }

  const suggestions = injuries.map((injury) => ({
    name: injury.playerName,
    role: injury.reason,
    importance: "rotation" as const,
    reason: classifyReason(injury.type),
    expectedStarter: false,
  }));

  return { suggestions, warning: null };
}
