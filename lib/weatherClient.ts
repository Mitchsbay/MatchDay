// Server-only. Open-Meteo needs no API key, but this still belongs on the
// server (cron / admin routes) alongside footballDataClient.ts rather than
// in a "use client" component, to keep fixture-refresh logic in one place
// and avoid firing a geocode+forecast round trip per client render.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// Open-Meteo's free forecast endpoint only covers roughly the next 16 days.
// Fixtures further out than that can't get a real forecast yet — callers
// should re-check closer to kickoff rather than treating "unavailable" as
// "no risk".
const FORECAST_HORIZON_DAYS = 16;

export type VenueCoordinates = {
  latitude: number;
  longitude: number;
  resolvedName: string;
};

export type MatchWeatherSnapshot = {
  temperatureC: number;
  windSpeedKph: number;
  precipitationMm: number;
};

export type WeatherRiskClassification = {
  risk: boolean;
  reasons: string[];
};

export type WeatherAssessment = {
  source: "open-meteo" | "unavailable";
  risk: boolean;
  reasons: string[];
  snapshot: MatchWeatherSnapshot | null;
  venue: VenueCoordinates | null;
  note: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo request failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

type GeocodeResponse = {
  results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
};

/**
 * Resolves a venue city (optionally qualified by country) to coordinates.
 * Returns null rather than throwing on a no-match — an unrecognised city
 * name is common enough (typos, smaller towns) that it shouldn't take the
 * whole weather assessment down with it.
 */
export async function geocodeCity(city: string, country?: string): Promise<VenueCoordinates | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({ name: trimmed, count: "5", format: "json" });
  const data = await getJson<GeocodeResponse>(`${GEOCODE_URL}?${params.toString()}`);
  const results = data.results ?? [];
  if (results.length === 0) return null;

  const match = country
    ? results.find((r) => r.country?.toLowerCase() === country.toLowerCase()) ?? results[0]
    : results[0];

  return {
    latitude: match.latitude,
    longitude: match.longitude,
    resolvedName: match.country ? `${match.name}, ${match.country}` : match.name,
  };
}

type ForecastResponse = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
  };
};

/**
 * Fetches the hourly forecast covering kickoffIso and returns the snapshot
 * for the hour closest to kickoff. Returns null if kickoff falls outside
 * Open-Meteo's forecast horizon, or the API has no hourly data for it.
 */
export async function fetchKickoffWeather(
  venue: VenueCoordinates,
  kickoffIso: string,
): Promise<MatchWeatherSnapshot | null> {
  const kickoff = new Date(kickoffIso);
  if (Number.isNaN(kickoff.getTime())) {
    throw new Error(`Invalid kickoff datetime: ${kickoffIso}`);
  }

  const daysUntilKickoff = (kickoff.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntilKickoff < -1 || daysUntilKickoff > FORECAST_HORIZON_DAYS) {
    // More than a day in the past, or further out than Open-Meteo's forecast
    // window — neither is a case this function can answer.
    return null;
  }

  const params = new URLSearchParams({
    latitude: String(venue.latitude),
    longitude: String(venue.longitude),
    hourly: "temperature_2m,precipitation,wind_speed_10m",
    timezone: "UTC",
    forecast_days: String(Math.max(1, Math.ceil(daysUntilKickoff) + 1)),
  });

  const data = await getJson<ForecastResponse>(`${FORECAST_URL}?${params.toString()}`);
  const hourly = data.hourly;
  if (!hourly || hourly.time.length === 0) return null;

  const kickoffMs = kickoff.getTime();
  let closestIndex = 0;
  let closestDiff = Infinity;
  hourly.time.forEach((t, i) => {
    const diff = Math.abs(new Date(`${t}Z`).getTime() - kickoffMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  });

  // More than 90 minutes from any returned hourly slot means the forecast
  // window didn't actually cover kickoff — treat as unavailable rather than
  // silently returning a mistimed reading.
  if (closestDiff > 90 * 60 * 1000) return null;

  return {
    temperatureC: hourly.temperature_2m[closestIndex],
    windSpeedKph: hourly.wind_speed_10m[closestIndex],
    precipitationMm: hourly.precipitation[closestIndex],
  };
}

/**
 * Pure classification, no network — same thresholds the spec doc proposed:
 * heavy precipitation, wind above 30 km/h, or extreme temperature.
 * Kept separate and pure so it's directly unit-testable.
 */
export function classifyWeatherRisk(snapshot: MatchWeatherSnapshot): WeatherRiskClassification {
  const reasons: string[] = [];

  if (snapshot.precipitationMm >= 4) {
    reasons.push(`Heavy precipitation forecast (${snapshot.precipitationMm}mm in the kickoff hour).`);
  }
  if (snapshot.windSpeedKph > 30) {
    reasons.push(`High wind forecast (${snapshot.windSpeedKph}km/h).`);
  }
  if (snapshot.temperatureC <= 0) {
    reasons.push(`Sub-zero temperature forecast (${snapshot.temperatureC}\u00b0C).`);
  }
  if (snapshot.temperatureC >= 35) {
    reasons.push(`Extreme heat forecast (${snapshot.temperatureC}\u00b0C).`);
  }

  return { risk: reasons.length > 0, reasons };
}

/**
 * Orchestrates geocode -> forecast -> classify for a fixture. Never throws
 * on missing/unresolvable data — returns source: "unavailable" instead, so
 * callers can leave any existing manually-entered weatherDisruptionRisk
 * flag untouched rather than overwriting it with a false negative.
 */
export async function assessFixtureWeather(args: {
  venueCity: string;
  venueCountry?: string;
  kickoffUtc: string;
}): Promise<WeatherAssessment> {
  try {
    const venue = await geocodeCity(args.venueCity, args.venueCountry);
    if (!venue) {
      return {
        source: "unavailable",
        risk: false,
        reasons: [],
        snapshot: null,
        venue: null,
        note: `Could not resolve venue city "${args.venueCity}" to coordinates.`,
      };
    }

    const snapshot = await fetchKickoffWeather(venue, args.kickoffUtc);
    if (!snapshot) {
      return {
        source: "unavailable",
        risk: false,
        reasons: [],
        snapshot: null,
        venue,
        note: "Kickoff is outside Open-Meteo's forecast window (or too far in the past).",
      };
    }

    const classification = classifyWeatherRisk(snapshot);
    return {
      source: "open-meteo",
      risk: classification.risk,
      reasons: classification.reasons,
      snapshot,
      venue,
      note:
        classification.reasons.length > 0
          ? classification.reasons.join(" ")
          : `No weather disruption expected in ${venue.resolvedName} at kickoff.`,
    };
  } catch (err) {
    return {
      source: "unavailable",
      risk: false,
      reasons: [],
      snapshot: null,
      venue: null,
      note: `Weather lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Merges an automatic assessment into an existing weatherDisruptionRisk
 * flag. Only overrides when Open-Meteo actually returned data — an
 * "unavailable" assessment leaves whatever was already there (manual entry
 * or a prior automatic run) alone instead of resetting it to false.
 */
export function resolveWeatherDisruptionRisk(
  existing: boolean | undefined,
  assessment: WeatherAssessment,
): boolean | undefined {
  if (assessment.source === "unavailable") return existing;
  return assessment.risk;
}
