// Server-only. Never imported from a "use client" component — this holds the
// MATCHSTAT_API_KEY server secret and is only ever called from
// app/api/tennis/*/route.ts.
//
// Every shape and path in this file was verified against real responses from
// the live API, not assumed from documentation — the docs turned out to
// disagree with reality on more than one endpoint (response wrapper shape
// differs per endpoint: bare array, {data: [...]}, and {data, hasNextPage}
// all appear across three different endpoints in the same API).

import type { TennisFormResult, TennisPlayerSummary, TennisTour } from "./tennisScoringEngine";

const BASE_URL = "https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2";
const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";

function authHeaders(): HeadersInit {
  const key = process.env.MATCHSTAT_API_KEY;
  if (!key) {
    throw new Error("Missing MATCHSTAT_API_KEY environment variable.");
  }
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Matchstat Tennis API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function mostRecentMonday(from: Date): Date {
  const date = new Date(from);
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? 6 : day - 1; // days since the most recent Monday
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

// --- Rankings (also serves as the player list — getPlayers turned out to be
// a flat name database with every rank/points field null, not usable) ------

type RankingEntry = {
  pts: number;
  position: number;
  player: { id: number; name: string; countryAcr: string | null };
};

const RANKING_LOOKBACK_ATTEMPTS = 5; // try this Monday, then up to 4 weeks back

export async function fetchTennisRankings(
  tour: TennisTour,
  page = 0,
): Promise<TennisPlayerSummary[]> {
  let candidate = mostRecentMonday(new Date());

  for (let attempt = 0; attempt < RANKING_LOOKBACK_ATTEMPTS; attempt += 1) {
    const dateParam = formatDateDDMMYYYY(candidate);
    const data = await getJson<RankingEntry[]>(
      `/ms-api/ranking/${tour}?date=${dateParam}&page=${page}&group=singles`,
    );

    if (data.length > 0) {
      return data.map((entry) => ({
        id: entry.player.id,
        name: entry.player.name,
        countryAcr: entry.player.countryAcr,
        currentRank: entry.position,
        points: entry.pts,
      }));
    }

    // Rankings publish weekly (usually Mondays) — step back a week and retry
    // rather than assume today/this-Monday always has a snapshot available.
    candidate = new Date(candidate);
    candidate.setUTCDate(candidate.getUTCDate() - 7);
  }

  return [];
}

// --- Past matches: win/loss comes straight from match_winner, no need to --
// parse score strings like "7-6(10) 3-6 6-3 6-7(4) 7-6(4)" at all. ----------

type PastMatchEntry = {
  date: string;
  match_winner: number;
  result_type: string;
  player1Id: number;
  player2Id: number;
};

type PastMatchesResponse = {
  data: PastMatchEntry[];
  hasNextPage: boolean;
};

export async function fetchTennisRecentForm(
  tour: TennisTour,
  playerId: number,
  limit = 5,
): Promise<TennisFormResult[]> {
  const data = await getJson<PastMatchesResponse>(`/${tour}/player/past-matches/${playerId}`);

  // Already sorted most-recent-first in the real response — no re-sort needed.
  return data.data
    .filter((match) => match.result_type === "completed")
    .slice(0, limit)
    .map((match): TennisFormResult => (match.match_winner === playerId ? "W" : "L"));
}
