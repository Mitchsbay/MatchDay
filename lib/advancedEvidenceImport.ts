import type { FixtureAdvancedEvidence, MarketMovementDirection, StabilityFlag, TeamAdvancedEvidence, TravelBurden } from "./advancedEvidence";

export type AdvancedEvidenceRecord = Record<string, string | undefined>;

export const ADVANCED_TEAM_EVIDENCE_HEADERS = [
  "xg_for",
  "xg_against",
  "recent_xg_for",
  "recent_xg_against",
  "recent_opponent_ppg",
  "recent_opponent_avg_position",
  "days_since_last_match",
  "days_until_next_match",
  "matches_last_7_days",
  "matches_last_14_days",
  "travel_burden",
  "missing_starters",
  "missing_key_attackers",
  "missing_key_defenders",
  "missing_goalkeepers",
  "returning_key_players",
  "set_piece_goals_for",
  "set_piece_goals_against",
  "corners_for_per_match",
  "corners_against_per_match",
  "yellow_cards_per_match",
  "red_cards_per_match",
  "team_stability",
  "advanced_notes",
] as const;

export const ADVANCED_FIXTURE_TEAM_PREFIXES = ["home", "away"] as const;

export const ADVANCED_MATCH_EVIDENCE_HEADERS = [
  "opening_home_probability",
  "opening_draw_probability",
  "opening_away_probability",
  "current_home_probability",
  "current_draw_probability",
  "current_away_probability",
  "market_movement_direction",
  "market_movement_strength",
  "neutral_venue",
  "weather_disruption_risk",
  "advanced_data_source",
  "advanced_match_notes",
] as const;

export const ADVANCED_FIXTURE_EVIDENCE_HEADERS = [
  ...ADVANCED_FIXTURE_TEAM_PREFIXES.flatMap((prefix) => ADVANCED_TEAM_EVIDENCE_HEADERS.map((header) => `${prefix}_${header}`)),
  ...ADVANCED_MATCH_EVIDENCE_HEADERS,
] as const;

function firstText(record: AdvancedEvidenceRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) return value;
  }
  return "";
}

function numberField(record: AdvancedEvidenceRecord, keys: string[]): number | undefined {
  const raw = firstText(record, keys);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolField(record: AdvancedEvidenceRecord, keys: string[]): boolean | undefined {
  const raw = firstText(record, keys).toLowerCase();
  if (!raw) return undefined;
  if (["true", "yes", "y", "1"].includes(raw)) return true;
  if (["false", "no", "n", "0"].includes(raw)) return false;
  return undefined;
}

function travelBurdenField(record: AdvancedEvidenceRecord, keys: string[]): TravelBurden | undefined {
  const raw = firstText(record, keys).toLowerCase();
  if (["none", "low", "moderate", "high"].includes(raw)) return raw as TravelBurden;
  return undefined;
}

function stabilityField(record: AdvancedEvidenceRecord, keys: string[]): StabilityFlag | undefined {
  const raw = firstText(record, keys).toLowerCase();
  if (["stable", "watch", "volatile", "unknown"].includes(raw)) return raw as StabilityFlag;
  return undefined;
}

function marketMovementField(record: AdvancedEvidenceRecord, keys: string[]): MarketMovementDirection | undefined {
  const raw = firstText(record, keys).toLowerCase().replace(/_/g, "-");
  if (["home-shortening", "draw-shortening", "away-shortening", "stable", "unknown"].includes(raw)) return raw as MarketMovementDirection;
  return undefined;
}

function compactTeamEvidence(evidence: TeamAdvancedEvidence): TeamAdvancedEvidence | undefined {
  return Object.values(evidence).some((value) => value !== undefined && value !== "") ? evidence : undefined;
}

export function parseTeamAdvancedEvidence(record: AdvancedEvidenceRecord, prefix = ""): TeamAdvancedEvidence | undefined {
  const p = prefix ? `${prefix}_` : "";
  return compactTeamEvidence({
    expectedGoalsFor: numberField(record, [`${p}xg_for`, `${p}expected_goals_for`]),
    expectedGoalsAgainst: numberField(record, [`${p}xg_against`, `${p}expected_goals_against`]),
    recentExpectedGoalsFor: numberField(record, [`${p}recent_xg_for`, `${p}recent_expected_goals_for`]),
    recentExpectedGoalsAgainst: numberField(record, [`${p}recent_xg_against`, `${p}recent_expected_goals_against`]),
    recentOpponentAveragePointsPerGame: numberField(record, [`${p}recent_opponent_ppg`, `${p}recent_opponent_average_points_per_game`]),
    recentOpponentAveragePosition: numberField(record, [`${p}recent_opponent_avg_position`, `${p}recent_opponent_average_position`]),
    daysSinceLastMatch: numberField(record, [`${p}days_since_last_match`]),
    daysUntilNextMatch: numberField(record, [`${p}days_until_next_match`]),
    matchesLast7Days: numberField(record, [`${p}matches_last_7_days`]),
    matchesLast14Days: numberField(record, [`${p}matches_last_14_days`]),
    travelBurden: travelBurdenField(record, [`${p}travel_burden`]),
    missingStarters: numberField(record, [`${p}missing_starters`]),
    missingKeyAttackers: numberField(record, [`${p}missing_key_attackers`]),
    missingKeyDefenders: numberField(record, [`${p}missing_key_defenders`]),
    missingGoalkeepers: numberField(record, [`${p}missing_goalkeepers`]),
    returningKeyPlayers: numberField(record, [`${p}returning_key_players`]),
    setPieceGoalsFor: numberField(record, [`${p}set_piece_goals_for`]),
    setPieceGoalsAgainst: numberField(record, [`${p}set_piece_goals_against`]),
    cornersForPerMatch: numberField(record, [`${p}corners_for_per_match`]),
    cornersAgainstPerMatch: numberField(record, [`${p}corners_against_per_match`]),
    yellowCardsPerMatch: numberField(record, [`${p}yellow_cards_per_match`]),
    redCardsPerMatch: numberField(record, [`${p}red_cards_per_match`]),
    stability: stabilityField(record, [`${p}team_stability`, `${p}stability`]),
    notes: firstText(record, [`${p}advanced_notes`, `${p}advanced_note`]) || undefined,
  });
}

export function parseFixtureAdvancedEvidence(record: AdvancedEvidenceRecord): FixtureAdvancedEvidence | undefined {
  const evidence: FixtureAdvancedEvidence = {
    home: parseTeamAdvancedEvidence(record, "home"),
    away: parseTeamAdvancedEvidence(record, "away"),
    match: {
      openingHomeProbability: numberField(record, ["opening_home_probability", "opening_home_pct"]),
      openingDrawProbability: numberField(record, ["opening_draw_probability", "opening_draw_pct"]),
      openingAwayProbability: numberField(record, ["opening_away_probability", "opening_away_pct"]),
      currentHomeProbability: numberField(record, ["current_home_probability", "current_home_pct"]),
      currentDrawProbability: numberField(record, ["current_draw_probability", "current_draw_pct"]),
      currentAwayProbability: numberField(record, ["current_away_probability", "current_away_pct"]),
      marketMovementDirection: marketMovementField(record, ["market_movement_direction"]),
      marketMovementStrength: numberField(record, ["market_movement_strength"]),
      neutralVenue: boolField(record, ["neutral_venue"]),
      weatherDisruptionRisk: boolField(record, ["weather_disruption_risk", "weather_risk"]),
      dataSourceLabel: firstText(record, ["advanced_data_source", "advanced_source"]),
      notes: firstText(record, ["advanced_match_notes", "advanced_notes"]),
    },
  };

  if (evidence.match && !Object.values(evidence.match).some((value) => value !== undefined && value !== "")) {
    evidence.match = undefined;
  }

  return evidence.home || evidence.away || evidence.match ? evidence : undefined;
}

export function advancedEvidenceToFixtureRow(evidence: FixtureAdvancedEvidence | undefined): Record<string, string | number | boolean> {
  const home = evidence?.home;
  const away = evidence?.away;
  const match = evidence?.match;
  return {
    home_xg_for: home?.expectedGoalsFor ?? "",
    home_xg_against: home?.expectedGoalsAgainst ?? "",
    home_recent_xg_for: home?.recentExpectedGoalsFor ?? "",
    home_recent_xg_against: home?.recentExpectedGoalsAgainst ?? "",
    home_recent_opponent_ppg: home?.recentOpponentAveragePointsPerGame ?? "",
    home_recent_opponent_avg_position: home?.recentOpponentAveragePosition ?? "",
    home_days_since_last_match: home?.daysSinceLastMatch ?? "",
    home_days_until_next_match: home?.daysUntilNextMatch ?? "",
    home_matches_last_7_days: home?.matchesLast7Days ?? "",
    home_matches_last_14_days: home?.matchesLast14Days ?? "",
    home_travel_burden: home?.travelBurden ?? "",
    home_missing_starters: home?.missingStarters ?? "",
    home_missing_key_attackers: home?.missingKeyAttackers ?? "",
    home_missing_key_defenders: home?.missingKeyDefenders ?? "",
    home_missing_goalkeepers: home?.missingGoalkeepers ?? "",
    home_returning_key_players: home?.returningKeyPlayers ?? "",
    home_set_piece_goals_for: home?.setPieceGoalsFor ?? "",
    home_set_piece_goals_against: home?.setPieceGoalsAgainst ?? "",
    home_corners_for_per_match: home?.cornersForPerMatch ?? "",
    home_corners_against_per_match: home?.cornersAgainstPerMatch ?? "",
    home_yellow_cards_per_match: home?.yellowCardsPerMatch ?? "",
    home_red_cards_per_match: home?.redCardsPerMatch ?? "",
    home_team_stability: home?.stability ?? "",
    home_advanced_notes: home?.notes ?? "",
    away_xg_for: away?.expectedGoalsFor ?? "",
    away_xg_against: away?.expectedGoalsAgainst ?? "",
    away_recent_xg_for: away?.recentExpectedGoalsFor ?? "",
    away_recent_xg_against: away?.recentExpectedGoalsAgainst ?? "",
    away_recent_opponent_ppg: away?.recentOpponentAveragePointsPerGame ?? "",
    away_recent_opponent_avg_position: away?.recentOpponentAveragePosition ?? "",
    away_days_since_last_match: away?.daysSinceLastMatch ?? "",
    away_days_until_next_match: away?.daysUntilNextMatch ?? "",
    away_matches_last_7_days: away?.matchesLast7Days ?? "",
    away_matches_last_14_days: away?.matchesLast14Days ?? "",
    away_travel_burden: away?.travelBurden ?? "",
    away_missing_starters: away?.missingStarters ?? "",
    away_missing_key_attackers: away?.missingKeyAttackers ?? "",
    away_missing_key_defenders: away?.missingKeyDefenders ?? "",
    away_missing_goalkeepers: away?.missingGoalkeepers ?? "",
    away_returning_key_players: away?.returningKeyPlayers ?? "",
    away_set_piece_goals_for: away?.setPieceGoalsFor ?? "",
    away_set_piece_goals_against: away?.setPieceGoalsAgainst ?? "",
    away_corners_for_per_match: away?.cornersForPerMatch ?? "",
    away_corners_against_per_match: away?.cornersAgainstPerMatch ?? "",
    away_yellow_cards_per_match: away?.yellowCardsPerMatch ?? "",
    away_red_cards_per_match: away?.redCardsPerMatch ?? "",
    away_team_stability: away?.stability ?? "",
    away_advanced_notes: away?.notes ?? "",
    opening_home_probability: match?.openingHomeProbability ?? "",
    opening_draw_probability: match?.openingDrawProbability ?? "",
    opening_away_probability: match?.openingAwayProbability ?? "",
    current_home_probability: match?.currentHomeProbability ?? "",
    current_draw_probability: match?.currentDrawProbability ?? "",
    current_away_probability: match?.currentAwayProbability ?? "",
    market_movement_direction: match?.marketMovementDirection ?? "",
    market_movement_strength: match?.marketMovementStrength ?? "",
    neutral_venue: match?.neutralVenue ?? "",
    weather_disruption_risk: match?.weatherDisruptionRisk ?? "",
    advanced_data_source: match?.dataSourceLabel ?? "",
    advanced_match_notes: match?.notes ?? "",
  };
}
