import { MatchContext, TeamContext, TeamStats } from "./scoringEngine";

export const statFields: Array<{
  key: keyof TeamStats;
  label: string;
  helper: string;
}> = [
  { key: "played", label: "Played", helper: "Total league games" },
  { key: "points", label: "Points", helper: "Total points" },
  { key: "wins", label: "Wins", helper: "Total wins" },
  { key: "draws", label: "Draws", helper: "Total draws" },
  { key: "losses", label: "Losses", helper: "Total losses" },
  { key: "goalsFor", label: "GF", helper: "Goals for" },
  { key: "goalsAgainst", label: "GA", helper: "Goals against" },
  { key: "homePlayed", label: "Home P", helper: "Home games" },
  { key: "homePoints", label: "Home Pts", helper: "Home points" },
  { key: "homeGoalsFor", label: "Home GF", helper: "Home goals for" },
  { key: "homeGoalsAgainst", label: "Home GA", helper: "Home goals against" },
  { key: "awayPlayed", label: "Away P", helper: "Away games" },
  { key: "awayPoints", label: "Away Pts", helper: "Away points" },
  { key: "awayGoalsFor", label: "Away GF", helper: "Away goals for" },
  { key: "awayGoalsAgainst", label: "Away GA", helper: "Away goals against" },
];

export const teamContextFields: Array<{
  key: keyof TeamContext;
  label: string;
  helper: string;
}> = [
  { key: "mustWin", label: "Must win", helper: "Result matters more than normal" },
  { key: "titleRace", label: "Title race", helper: "Pressure to stay near the top" },
  { key: "relegationBattle", label: "Relegation battle", helper: "Survival pressure / six-pointer" },
  { key: "chasingFinalsOrEurope", label: "Chasing finals/Europe", helper: "Needs points for qualification places" },
  { key: "newManagerBounce", label: "New manager bounce", helper: "Short-term lift from new coach/manager" },
  { key: "homecomingOrStatement", label: "Statement game", helper: "Opening/homecoming/revenge response angle" },
  { key: "rotationRisk", label: "Rotation risk", helper: "Likely to rest players" },
  { key: "alreadyQualifiedOrSafe", label: "Already safe", helper: "Lower urgency or nothing to play for" },
  { key: "cupOrFixtureDistraction", label: "Distraction", helper: "Cup, travel, short turnaround or future priority" },
  { key: "travelFatigue", label: "Travel fatigue", helper: "Heavy travel or awkward schedule" },
];

export const matchContextFields: Array<{
  key: keyof MatchContext;
  label: string;
  helper: string;
}> = [
  { key: "derbyOrRivalry", label: "Derby/rivalry", helper: "Raises volatility; not an automatic edge" },
  { key: "openingRound", label: "Opening round", helper: "Early-season uncertainty / statement angle" },
  { key: "knockoutOrElimination", label: "Knockout/elimination", helper: "High pressure fixture" },
  { key: "weatherRisk", label: "Weather risk", helper: "Conditions may distort normal performance" },
  { key: "unusualVenue", label: "Unusual venue", helper: "Neutral ground or venue disruption" },
];
