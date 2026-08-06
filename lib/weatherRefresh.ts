import type { Fixture } from "./sampleData";
import { resolveWeatherDisruptionRisk, type WeatherAssessment } from "./weatherClient";

export type FixtureWeatherRequestItem = {
  fixtureId: string;
  venueCity: string;
  venueCountry?: string;
  kickoffUtc: string;
};

export type FixtureWeatherResult = {
  fixtureId: string;
  assessment: WeatherAssessment;
};

const BATCH_SIZE = 50;

/**
 * Fixtures with venueCity+kickoffUtc set (typically via the CSV advanced
 * evidence import) are candidates for an automatic weather check. Re-running
 * this on an already-assessed fixture is intentional and safe — the
 * forecast sharpens as kickoff approaches, so refreshing closer to matchday
 * is expected, not a bug.
 */
export function selectFixturesNeedingWeather(fixtures: Fixture[]): FixtureWeatherRequestItem[] {
  return fixtures
    .filter((f) => f.advancedEvidence?.match?.venueCity && f.advancedEvidence?.match?.kickoffUtc)
    .map((f) => ({
      fixtureId: f.id,
      venueCity: f.advancedEvidence!.match!.venueCity!,
      venueCountry: f.advancedEvidence!.match!.venueCountry,
      kickoffUtc: f.advancedEvidence!.match!.kickoffUtc!,
    }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Calls the /api/weather/assess route (which requires the same signed-in
 * admin session as every other app API route) in batches, and returns a
 * fixtureId -> assessment map. A failed batch doesn't abort the others —
 * partial results are better than losing an entire refresh over one
 * transient error.
 */
export async function fetchWeatherAssessments(
  items: FixtureWeatherRequestItem[],
  authHeader: string,
): Promise<{ results: FixtureWeatherResult[]; errors: string[] }> {
  const results: FixtureWeatherResult[] = [];
  const errors: string[] = [];

  for (const batch of chunk(items, BATCH_SIZE)) {
    try {
      const res = await fetch("/api/weather/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: authHeader },
        body: JSON.stringify({ fixtures: batch }),
      });
      const data = (await res.json()) as { ok: boolean; results?: FixtureWeatherResult[]; error?: string };
      if (!res.ok || !data.ok || !data.results) {
        errors.push(data.error || `Weather batch request failed (${res.status}).`);
        continue;
      }
      results.push(...data.results);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { results, errors };
}

/**
 * Pure merge: applies fetched assessments into fixture advancedEvidence,
 * only touching weatherDisruptionRisk and weatherDetail. Everything else on
 * the fixture (and on match evidence) is left exactly as it was. Fixtures
 * with no corresponding assessment pass through unchanged.
 */
export function applyWeatherAssessmentsToFixtures(
  fixtures: Fixture[],
  assessmentResults: FixtureWeatherResult[],
): Fixture[] {
  const byId = new Map(assessmentResults.map((r) => [r.fixtureId, r.assessment]));

  return fixtures.map((fixture) => {
    const assessment = byId.get(fixture.id);
    if (!assessment) return fixture;

    const existingMatch = fixture.advancedEvidence?.match;
    const nextRisk = resolveWeatherDisruptionRisk(existingMatch?.weatherDisruptionRisk, assessment);

    return {
      ...fixture,
      advancedEvidence: {
        ...fixture.advancedEvidence,
        match: {
          ...existingMatch,
          weatherDisruptionRisk: nextRisk,
          weatherDetail: assessment.source === "open-meteo" ? assessment.note : existingMatch?.weatherDetail,
        },
      },
    };
  });
}
