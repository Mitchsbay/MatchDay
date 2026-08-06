export type PredictionLabel =
  | "Very Strong Home Win"
  | "Strong Home Win"
  | "Lean Home Win"
  | "Draw / Low Confidence"
  | "Lean Away Win"
  | "Strong Away Win"
  | "Very Strong Away Win"
  | "Review Required";

export type GateStatus = "pass" | "fail";
export type RecentResult = "W" | "D" | "L";

export type RecentFormGame = {
  result: RecentResult;
  goalsFor: number;
  goalsAgainst: number;
};

export type PlayerImportance =
  "backup" | "rotation" | "starter" | "key" | "critical";
export type AbsenceReason =
  "injury" | "suspension" | "unavailable" | "doubtful";

export type MissingPlayer = {
  name: string;
  role: string;
  importance: PlayerImportance;
  reason: AbsenceReason;
  expectedStarter: boolean;
};

export type TeamStats = {
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

export type TeamStrengthBreakdown = {
  overallStrength: number;
  homeStrength: number;
  awayStrength: number;
  pointsPerGame: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  goalDifferencePerGame: number;
  winRate: number;
};

export type QualityCalculation = {
  homeOverallStrength: number;
  awayOverallStrength: number;
  homeVenueStrength: number;
  awayVenueStrength: number;
  homeMatchStrength: number;
  awayMatchStrength: number;
  rawStrengthGap: number;
  qualityGap: number;
  evidence: string[];
};

export type RecentFormBreakdown = {
  gamesUsed: number;
  points: number;
  pointsPerGame: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  goalDifferencePerGame: number;
  score: number;
};

export type FormCalculation = {
  homeFormScore: number;
  awayFormScore: number;
  rawFormGap: number;
  recentFormGap: number;
  homeBreakdown: RecentFormBreakdown;
  awayBreakdown: RecentFormBreakdown;
  evidence: string[];
};

export type AvailabilityBreakdown = {
  totalImpact: number;
  listedAbsences: number;
  keyAbsences: number;
  expectedStarterAbsences: number;
};

export type AvailabilityCalculation = {
  homeImpact: number;
  awayImpact: number;
  rawAvailabilityGap: number;
  injuryRisk: number;
  homeBreakdown: AvailabilityBreakdown;
  awayBreakdown: AvailabilityBreakdown;
  evidence: string[];
};

export type TeamContext = {
  mustWin: boolean;
  titleRace: boolean;
  relegationBattle: boolean;
  chasingFinalsOrEurope: boolean;
  newManagerBounce: boolean;
  homecomingOrStatement: boolean;
  rotationRisk: boolean;
  alreadyQualifiedOrSafe: boolean;
  cupOrFixtureDistraction: boolean;
  travelFatigue: boolean;
};

export type MatchContext = {
  derbyOrRivalry: boolean;
  openingRound: boolean;
  knockoutOrElimination: boolean;
  weatherRisk: boolean;
  unusualVenue: boolean;
};

export type ContextBreakdown = {
  positiveScore: number;
  negativeScore: number;
  netScore: number;
  positiveFlags: number;
  negativeFlags: number;
};

export type ContextCalculation = {
  homeContextScore: number;
  awayContextScore: number;
  rawContextGap: number;
  motivationEdge: number;
  volatilityScore: number;
  homeBreakdown: ContextBreakdown;
  awayBreakdown: ContextBreakdown;
  evidence: string[];
  warnings: string[];
};

export type OddsMarket = {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  sourceLabel: string;
};

export type OddsCalculation = {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  externalFavourite: "home" | "draw" | "away" | "none";
  favouriteMargin: number;
  oddsSupport: number;
  evidence: string[];
  warnings: string[];
};

export type ConflictLevel = "clean" | "caution" | "review" | "block";

export type ConflictCalculation = {
  conflictScore: number;
  rawConflictPoints: number;
  conflictLevel: ConflictLevel;
  failedSignals: number;
  cautionSignals: number;
  evidence: string[];
  warnings: string[];
  blockers: string[];
};

export type RuleWeights = {
  qualityGap: number;
  homeAdvantage: number;
  recentFormGap: number;
  headToHeadEdge: number;
  injuryRisk: number;
  motivationEdge: number;
  otherStatsEdge: number;
  oddsSupport: number;
  conflictScore: number;
  confidenceEdgeMultiplier: number;
  confidenceConflictPenalty: number;
  reviewConflictThreshold: number;
  reviewFailedGateThreshold: number;
  minimumPublishConfidence: number;
};

export const defaultRuleWeights: RuleWeights = {
  qualityGap: 1,
  homeAdvantage: 1,
  recentFormGap: 1,
  headToHeadEdge: 1,
  injuryRisk: 1,
  motivationEdge: 1,
  otherStatsEdge: 1,
  oddsSupport: 1,
  conflictScore: 1,
  confidenceEdgeMultiplier: 7,
  confidenceConflictPenalty: 6,
  reviewConflictThreshold: 3,
  reviewFailedGateThreshold: 2,
  minimumPublishConfidence: 50,
};

export const ruleWeightDefinitions: Array<{
  key: keyof RuleWeights;
  label: string;
  helper: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    key: "qualityGap",
    label: "Quality Weight",
    helper: "How much calculated team strength affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "homeAdvantage",
    label: "Home Advantage Weight",
    helper: "How much venue advantage affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "recentFormGap",
    label: "Form Weight",
    helper: "How much recent form affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "headToHeadEdge",
    label: "Head-to-Head Weight",
    helper: "How much historical match-up evidence affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "injuryRisk",
    label: "Availability Penalty Weight",
    helper: "How strongly missing players reduce the affected side.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "motivationEdge",
    label: "Context Weight",
    helper: "How much motivation/context affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "otherStatsEdge",
    label: "Other Stats Weight",
    helper: "How much optional stats affect Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "oddsSupport",
    label: "Odds Support Weight",
    helper: "How much external sanity-check signal affects Home Edge.",
    min: 0,
    max: 2,
    step: 0.25,
  },
  {
    key: "conflictScore",
    label: "Conflict Penalty Weight",
    helper: "How strongly contradictions reduce Home Edge.",
    min: 0,
    max: 2.5,
    step: 0.25,
  },
  {
    key: "confidenceEdgeMultiplier",
    label: "Confidence Edge Multiplier",
    helper: "How quickly confidence rises as the final edge grows.",
    min: 3,
    max: 12,
    step: 1,
  },
  {
    key: "confidenceConflictPenalty",
    label: "Confidence Conflict Penalty",
    helper: "How much conflict/failures reduce confidence.",
    min: 2,
    max: 12,
    step: 1,
  },
  {
    key: "reviewConflictThreshold",
    label: "Review Conflict Threshold",
    helper: "Conflict score at/above this forces review.",
    min: 1,
    max: 5,
    step: 1,
  },
  {
    key: "reviewFailedGateThreshold",
    label: "Review Failed Gate Threshold",
    helper: "Failed gates at/above this forces review.",
    min: 1,
    max: 7,
    step: 1,
  },
  {
    key: "minimumPublishConfidence",
    label: "Minimum Publish Confidence",
    helper: "Confidence below this forces review/no-tip.",
    min: 30,
    max: 80,
    step: 5,
  },
];

function mergeWeights(weights?: Partial<RuleWeights>): RuleWeights {
  return { ...defaultRuleWeights, ...(weights ?? {}) };
}

export type MatchScores = {
  qualityGap: number;
  homeAdvantage: number;
  recentFormGap: number;
  headToHeadEdge: number;
  injuryRisk: number;
  motivationEdge: number;
  otherStatsEdge: number;
  oddsSupport: number;
  conflictScore: number;
};

export type GateResult = {
  id: string;
  name: string;
  status: GateStatus;
  note: string;
};

export type PredictionResult = {
  homeEdge: number;
  awayEdge: number;
  confidence: number;
  prediction: PredictionLabel;
  gateStatus: "passed" | "blocked" | "review";
  reviewRequired: boolean;
  gates: GateResult[];
  warnings: string[];
};

export type ActualOutcome = "pending" | "home" | "draw" | "away";

export type MatchResultInput = {
  status: "pending" | "final";
  homeGoals: number;
  awayGoals: number;
};

export type PredictionOutcome = "home" | "draw" | "away" | "review";

export type ResultAccuracy = {
  actualOutcome: ActualOutcome;
  predictedOutcome: PredictionOutcome;
  isSettled: boolean;
  isTipPublished: boolean;
  isCorrect: boolean | null;
  pointsAwarded: number;
  evidence: string[];
};

export type AccuracySummary = {
  totalFixtures: number;
  finalFixtures: number;
  pendingFixtures: number;
  publishedTips: number;
  correctTips: number;
  reviewOrNoTips: number;
  hitRate: number;
  totalPoints: number;
  averageConfidence: number;
};

export const scoreDefinitions: Array<{
  key: keyof MatchScores;
  label: string;
  helper: string;
  min: number;
  max: number;
}> = [
  {
    key: "qualityGap",
    label: "Calculated Team Quality Gap",
    helper:
      "Calculated from GF, GA, points, wins and venue split. Edit team stats instead of this value.",
    min: -5,
    max: 5,
  },
  {
    key: "homeAdvantage",
    label: "Home Advantage",
    helper:
      "Venue benefit for the home team. Tough away venue can be strongly positive.",
    min: -1,
    max: 2,
  },
  {
    key: "recentFormGap",
    label: "Calculated Recent Form Gap",
    helper:
      "Calculated from recent W/D/L results plus recent goal difference. Edit recent form instead of this value.",
    min: -4,
    max: 4,
  },
  {
    key: "headToHeadEdge",
    label: "Head-to-Head Edge",
    helper: "Historical match-up dominance. Use carefully, not blindly.",
    min: -2,
    max: 2,
  },
  {
    key: "injuryRisk",
    label: "Calculated Availability Risk",
    helper:
      "Calculated from missing-player importance. Positive means home has more availability problems; negative means away is worse affected.",
    min: -3,
    max: 3,
  },
  {
    key: "motivationEdge",
    label: "Calculated Motivation / Context Edge",
    helper:
      "Calculated from structured context flags such as must-win, derby/rivalry, title/relegation pressure, rotation risk and fixture distraction.",
    min: -2,
    max: 2,
  },
  {
    key: "otherStatsEdge",
    label: "Other Stats Edge",
    helper: "Attack/defence averages, xG, set pieces, weather/style fit.",
    min: -3,
    max: 3,
  },
  {
    key: "oddsSupport",
    label: "Calculated Odds / External Support",
    helper:
      "Calculated from external 1X2 probabilities. Positive supports home, negative supports away, zero means draw/tight market.",
    min: -2,
    max: 2,
  },
  {
    key: "conflictScore",
    label: "Calculated Conflict Score",
    helper:
      "Calculated from contradictory gates, volatility, draw risk and market disagreement. Higher means more review risk.",
    min: 0,
    max: 5,
  },
];

export const manualScoreDefinitions = scoreDefinitions.filter(
  (definition) =>
    definition.key !== "qualityGap" &&
    definition.key !== "recentFormGap" &&
    definition.key !== "injuryRisk" &&
    definition.key !== "motivationEdge" &&
    definition.key !== "oddsSupport" &&
    definition.key !== "conflictScore",
);

export const emptyScores: MatchScores = {
  qualityGap: 0,
  homeAdvantage: 2,
  recentFormGap: 0,
  headToHeadEdge: 0,
  injuryRisk: 0,
  motivationEdge: 0,
  otherStatsEdge: 0,
  oddsSupport: 0,
  conflictScore: 0,
};

export const emptyTeamStats: TeamStats = {
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

export const emptyRecentForm: RecentFormGame[] = Array.from(
  { length: 5 },
  () => ({
    result: "D" as RecentResult,
    goalsFor: 0,
    goalsAgainst: 0,
  }),
);

export const emptyMissingPlayers: MissingPlayer[] = Array.from(
  { length: 3 },
  (_, index) => ({
    name: "",
    role: index === 0 ? "Starter / key player" : "",
    importance: index === 0 ? "starter" : "backup",
    reason: "injury",
    expectedStarter: index === 0,
  }),
);

export const emptyTeamContext: TeamContext = {
  mustWin: false,
  titleRace: false,
  relegationBattle: false,
  chasingFinalsOrEurope: false,
  newManagerBounce: false,
  homecomingOrStatement: false,
  rotationRisk: false,
  alreadyQualifiedOrSafe: false,
  cupOrFixtureDistraction: false,
  travelFatigue: false,
};

export const emptyMatchContext: MatchContext = {
  derbyOrRivalry: false,
  openingRound: false,
  knockoutOrElimination: false,
  weatherRisk: false,
  unusualVenue: false,
};

export const emptyOddsMarket: OddsMarket = {
  homeWinProbability: 0,
  drawProbability: 0,
  awayWinProbability: 0,
  sourceLabel: "Manual external check",
};

export const emptyMatchResult: MatchResultInput = {
  status: "pending",
  homeGoals: 0,
  awayGoals: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeDiv(value: number, divisor: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0)
    return 0;
  return value / divisor;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function resultToPoints(result: RecentResult): number {
  if (result === "W") return 3;
  if (result === "D") return 1;
  return 0;
}

function calculateStrengthFromParts(args: {
  played: number;
  points: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
}): number {
  const pointsPerGame = safeDiv(args.points, args.played);
  const goalsForPerGame = safeDiv(args.goalsFor, args.played);
  const goalsAgainstPerGame = safeDiv(args.goalsAgainst, args.played);
  const goalDifferencePerGame = safeDiv(
    args.goalsFor - args.goalsAgainst,
    args.played,
  );
  const winRate = safeDiv(args.wins, args.played);

  const pointsScore = clamp((pointsPerGame / 3) * 35, 0, 35);
  const attackScore = clamp((goalsForPerGame / 3) * 15, 0, 15);
  const defenceScore = clamp(15 - (goalsAgainstPerGame / 3) * 15, 0, 15);
  const goalDifferenceScore = clamp(
    ((goalDifferencePerGame + 2) / 4) * 25,
    0,
    25,
  );
  const winRateScore = clamp(winRate * 10, 0, 10);

  return Math.round(
    pointsScore +
      attackScore +
      defenceScore +
      goalDifferenceScore +
      winRateScore,
  );
}

export function calculateTeamStrength(stats: TeamStats): TeamStrengthBreakdown {
  const overallStrength = calculateStrengthFromParts({
    played: stats.played,
    points: stats.points,
    wins: stats.wins,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
  });

  const homeStrength = calculateStrengthFromParts({
    played: stats.homePlayed,
    points: stats.homePoints,
    wins: 0,
    goalsFor: stats.homeGoalsFor,
    goalsAgainst: stats.homeGoalsAgainst,
  });

  const awayStrength = calculateStrengthFromParts({
    played: stats.awayPlayed,
    points: stats.points - stats.homePoints,
    wins: 0,
    goalsFor: stats.awayGoalsFor,
    goalsAgainst: stats.awayGoalsAgainst,
  });

  return {
    overallStrength,
    homeStrength,
    awayStrength,
    pointsPerGame: roundOne(safeDiv(stats.points, stats.played)),
    goalsForPerGame: roundOne(safeDiv(stats.goalsFor, stats.played)),
    goalsAgainstPerGame: roundOne(safeDiv(stats.goalsAgainst, stats.played)),
    goalDifferencePerGame: roundOne(
      safeDiv(stats.goalsFor - stats.goalsAgainst, stats.played),
    ),
    winRate: Math.round(safeDiv(stats.wins, stats.played) * 100),
  };
}

export function convertStrengthGapToQualityGap(rawGap: number): number {
  if (rawGap >= 20) return 5;
  if (rawGap >= 13) return 4;
  if (rawGap >= 8) return 3;
  if (rawGap >= 4) return 2;
  if (rawGap >= 2) return 1;
  if (rawGap <= -20) return -5;
  if (rawGap <= -13) return -4;
  if (rawGap <= -8) return -3;
  if (rawGap <= -4) return -2;
  if (rawGap <= -2) return -1;
  return 0;
}

export function calculateQualityFromTeamStats(
  homeStats: TeamStats,
  awayStats: TeamStats,
): QualityCalculation {
  const homeStrength = calculateTeamStrength(homeStats);
  const awayStrength = calculateTeamStrength(awayStats);

  const homeMatchStrength = Math.round(
    homeStrength.overallStrength * 0.7 + homeStrength.homeStrength * 0.3,
  );
  const awayMatchStrength = Math.round(
    awayStrength.overallStrength * 0.7 + awayStrength.awayStrength * 0.3,
  );
  const rawStrengthGap = homeMatchStrength - awayMatchStrength;
  const qualityGap = convertStrengthGapToQualityGap(rawStrengthGap);

  const evidence = [
    `Home match strength ${homeMatchStrength}/100 = 70% overall (${homeStrength.overallStrength}) + 30% home split (${homeStrength.homeStrength}).`,
    `Away match strength ${awayMatchStrength}/100 = 70% overall (${awayStrength.overallStrength}) + 30% away split (${awayStrength.awayStrength}).`,
    `Raw strength gap is ${rawStrengthGap >= 0 ? "+" : ""}${rawStrengthGap}, converted to Quality Gap ${qualityGap >= 0 ? "+" : ""}${qualityGap}.`,
    `Home PPG ${homeStrength.pointsPerGame}, GF/G ${homeStrength.goalsForPerGame}, GA/G ${homeStrength.goalsAgainstPerGame}, win rate ${homeStrength.winRate}%.`,
    `Away PPG ${awayStrength.pointsPerGame}, GF/G ${awayStrength.goalsForPerGame}, GA/G ${awayStrength.goalsAgainstPerGame}, win rate ${awayStrength.winRate}%.`,
  ];

  return {
    homeOverallStrength: homeStrength.overallStrength,
    awayOverallStrength: awayStrength.overallStrength,
    homeVenueStrength: homeStrength.homeStrength,
    awayVenueStrength: awayStrength.awayStrength,
    homeMatchStrength,
    awayMatchStrength,
    rawStrengthGap,
    qualityGap,
    evidence,
  };
}

function normaliseRecentForm(form: RecentFormGame[]): RecentFormGame[] {
  return form.length > 0 ? form : emptyRecentForm;
}

export function calculateRecentFormStrength(
  form: RecentFormGame[],
): RecentFormBreakdown {
  const games = normaliseRecentForm(form);
  const gamesUsed = games.length;
  const points = games.reduce(
    (total, game) => total + resultToPoints(game.result),
    0,
  );
  const goalsFor = games.reduce(
    (total, game) => total + Math.max(0, game.goalsFor),
    0,
  );
  const goalsAgainst = games.reduce(
    (total, game) => total + Math.max(0, game.goalsAgainst),
    0,
  );
  const pointsPerGame = safeDiv(points, gamesUsed);
  const goalsForPerGame = safeDiv(goalsFor, gamesUsed);
  const goalsAgainstPerGame = safeDiv(goalsAgainst, gamesUsed);
  const goalDifferencePerGame = safeDiv(goalsFor - goalsAgainst, gamesUsed);

  const pointsScore = clamp((pointsPerGame / 3) * 60, 0, 60);
  const attackScore = clamp((goalsForPerGame / 3) * 15, 0, 15);
  const defenceScore = clamp(15 - (goalsAgainstPerGame / 3) * 15, 0, 15);
  const goalDifferenceScore = clamp(
    ((goalDifferencePerGame + 2) / 4) * 10,
    0,
    10,
  );
  const score = Math.round(
    pointsScore + attackScore + defenceScore + goalDifferenceScore,
  );

  return {
    gamesUsed,
    points,
    pointsPerGame: roundOne(pointsPerGame),
    goalsFor,
    goalsAgainst,
    goalsForPerGame: roundOne(goalsForPerGame),
    goalsAgainstPerGame: roundOne(goalsAgainstPerGame),
    goalDifferencePerGame: roundOne(goalDifferencePerGame),
    score,
  };
}

export function convertFormGapToRecentFormGap(rawGap: number): number {
  if (rawGap >= 24) return 4;
  if (rawGap >= 16) return 3;
  if (rawGap >= 9) return 2;
  if (rawGap >= 4) return 1;
  if (rawGap <= -24) return -4;
  if (rawGap <= -16) return -3;
  if (rawGap <= -9) return -2;
  if (rawGap <= -4) return -1;
  return 0;
}

export function calculateFormFromRecentResults(
  homeForm: RecentFormGame[],
  awayForm: RecentFormGame[],
): FormCalculation {
  const homeBreakdown = calculateRecentFormStrength(homeForm);
  const awayBreakdown = calculateRecentFormStrength(awayForm);
  const rawFormGap = homeBreakdown.score - awayBreakdown.score;
  const recentFormGap = convertFormGapToRecentFormGap(rawFormGap);

  const evidence = [
    `Home recent form score ${homeBreakdown.score}/100 from ${homeBreakdown.points} points in ${homeBreakdown.gamesUsed} games, GF/G ${homeBreakdown.goalsForPerGame}, GA/G ${homeBreakdown.goalsAgainstPerGame}.`,
    `Away recent form score ${awayBreakdown.score}/100 from ${awayBreakdown.points} points in ${awayBreakdown.gamesUsed} games, GF/G ${awayBreakdown.goalsForPerGame}, GA/G ${awayBreakdown.goalsAgainstPerGame}.`,
    `Raw form gap is ${rawFormGap >= 0 ? "+" : ""}${rawFormGap}, converted to Recent Form Gap ${recentFormGap >= 0 ? "+" : ""}${recentFormGap}.`,
  ];

  return {
    homeFormScore: homeBreakdown.score,
    awayFormScore: awayBreakdown.score,
    rawFormGap,
    recentFormGap,
    homeBreakdown,
    awayBreakdown,
    evidence,
  };
}

function importanceImpact(importance: PlayerImportance): number {
  if (importance === "critical") return 3;
  if (importance === "key") return 2.25;
  if (importance === "starter") return 1.5;
  if (importance === "rotation") return 0.75;
  return 0.35;
}

function reasonMultiplier(reason: AbsenceReason): number {
  if (reason === "doubtful") return 0.5;
  if (reason === "suspension") return 1.1;
  return 1;
}

function activeAbsences(players: MissingPlayer[]): MissingPlayer[] {
  return players.filter(
    (player) => player.name.trim().length > 0 || player.role.trim().length > 0,
  );
}

export function calculateAvailabilityImpact(
  players: MissingPlayer[],
): AvailabilityBreakdown {
  const active = activeAbsences(players);
  const totalImpact = active.reduce((total, player) => {
    const starterBoost = player.expectedStarter ? 0.35 : 0;
    return (
      total +
      (importanceImpact(player.importance) + starterBoost) *
        reasonMultiplier(player.reason)
    );
  }, 0);

  return {
    totalImpact: roundOne(totalImpact),
    listedAbsences: active.length,
    keyAbsences: active.filter(
      (player) =>
        player.importance === "key" || player.importance === "critical",
    ).length,
    expectedStarterAbsences: active.filter((player) => player.expectedStarter)
      .length,
  };
}

export function convertAvailabilityGapToInjuryRisk(rawGap: number): number {
  if (rawGap >= 6) return 3;
  if (rawGap >= 3.5) return 2;
  if (rawGap >= 1.5) return 1;
  if (rawGap <= -6) return -3;
  if (rawGap <= -3.5) return -2;
  if (rawGap <= -1.5) return -1;
  return 0;
}

export function calculateAvailabilityFromMissingPlayers(
  homeMissingPlayers: MissingPlayer[],
  awayMissingPlayers: MissingPlayer[],
): AvailabilityCalculation {
  const homeBreakdown = calculateAvailabilityImpact(homeMissingPlayers);
  const awayBreakdown = calculateAvailabilityImpact(awayMissingPlayers);
  const rawAvailabilityGap = roundOne(
    homeBreakdown.totalImpact - awayBreakdown.totalImpact,
  );
  const injuryRisk = convertAvailabilityGapToInjuryRisk(rawAvailabilityGap);

  const evidence = [
    `Home availability impact ${homeBreakdown.totalImpact}: ${homeBreakdown.listedAbsences} listed absence(s), ${homeBreakdown.keyAbsences} key/critical, ${homeBreakdown.expectedStarterAbsences} expected starter(s).`,
    `Away availability impact ${awayBreakdown.totalImpact}: ${awayBreakdown.listedAbsences} listed absence(s), ${awayBreakdown.keyAbsences} key/critical, ${awayBreakdown.expectedStarterAbsences} expected starter(s).`,
    `Raw availability gap is ${rawAvailabilityGap >= 0 ? "+" : ""}${rawAvailabilityGap}. Positive hurts the home team; negative hurts the away team. Converted Availability Risk ${injuryRisk >= 0 ? "+" : ""}${injuryRisk}.`,
  ];

  return {
    homeImpact: homeBreakdown.totalImpact,
    awayImpact: awayBreakdown.totalImpact,
    rawAvailabilityGap,
    injuryRisk,
    homeBreakdown,
    awayBreakdown,
    evidence,
  };
}

function calculateTeamContextBreakdown(context: TeamContext): ContextBreakdown {
  const positiveScore =
    (context.mustWin ? 1.5 : 0) +
    (context.titleRace ? 1.25 : 0) +
    (context.relegationBattle ? 1.25 : 0) +
    (context.chasingFinalsOrEurope ? 1 : 0) +
    (context.newManagerBounce ? 0.75 : 0) +
    (context.homecomingOrStatement ? 0.75 : 0);

  const negativeScore =
    (context.rotationRisk ? 1.25 : 0) +
    (context.alreadyQualifiedOrSafe ? 1 : 0) +
    (context.cupOrFixtureDistraction ? 0.75 : 0) +
    (context.travelFatigue ? 0.75 : 0);

  return {
    positiveScore: roundOne(positiveScore),
    negativeScore: roundOne(negativeScore),
    netScore: roundOne(positiveScore - negativeScore),
    positiveFlags: [
      context.mustWin,
      context.titleRace,
      context.relegationBattle,
      context.chasingFinalsOrEurope,
      context.newManagerBounce,
      context.homecomingOrStatement,
    ].filter(Boolean).length,
    negativeFlags: [
      context.rotationRisk,
      context.alreadyQualifiedOrSafe,
      context.cupOrFixtureDistraction,
      context.travelFatigue,
    ].filter(Boolean).length,
  };
}

export function convertContextGapToMotivationEdge(rawGap: number): number {
  if (rawGap >= 3) return 2;
  if (rawGap >= 1.25) return 1;
  if (rawGap <= -3) return -2;
  if (rawGap <= -1.25) return -1;
  return 0;
}

export function calculateContextFromFlags(
  homeContext: TeamContext,
  awayContext: TeamContext,
  matchContext: MatchContext,
): ContextCalculation {
  const homeBreakdown = calculateTeamContextBreakdown(homeContext);
  const awayBreakdown = calculateTeamContextBreakdown(awayContext);
  const rawContextGap = roundOne(
    homeBreakdown.netScore - awayBreakdown.netScore,
  );
  const motivationEdge = convertContextGapToMotivationEdge(rawContextGap);
  const volatilityScore = [
    matchContext.derbyOrRivalry,
    matchContext.openingRound,
    matchContext.knockoutOrElimination,
    matchContext.weatherRisk,
    matchContext.unusualVenue,
  ].filter(Boolean).length;

  const evidence = [
    `Home context score ${homeBreakdown.netScore}: positives ${homeBreakdown.positiveScore} from ${homeBreakdown.positiveFlags} flag(s), negatives ${homeBreakdown.negativeScore} from ${homeBreakdown.negativeFlags} flag(s).`,
    `Away context score ${awayBreakdown.netScore}: positives ${awayBreakdown.positiveScore} from ${awayBreakdown.positiveFlags} flag(s), negatives ${awayBreakdown.negativeScore} from ${awayBreakdown.negativeFlags} flag(s).`,
    `Raw context gap is ${rawContextGap >= 0 ? "+" : ""}${rawContextGap}, converted to Motivation Edge ${motivationEdge >= 0 ? "+" : ""}${motivationEdge}.`,
    `Match volatility flags active: ${volatilityScore}. Volatility does not automatically pick a side, but it increases review risk when other gates are weak.`,
  ];

  const warnings: string[] = [];
  if (volatilityScore >= 2) {
    warnings.push("Context volatility is high. Treat strong tips carefully.");
  }
  if (homeBreakdown.negativeFlags >= 2) {
    warnings.push(
      "Home context has multiple negative flags such as rotation, safety, distraction or travel fatigue.",
    );
  }
  if (awayBreakdown.negativeFlags >= 2) {
    warnings.push(
      "Away context has multiple negative flags such as rotation, safety, distraction or travel fatigue.",
    );
  }
  if (
    motivationEdge === 0 &&
    homeBreakdown.positiveFlags + awayBreakdown.positiveFlags > 0
  ) {
    warnings.push(
      "Both teams have meaningful motivation, so context does not create a clear edge.",
    );
  }

  return {
    homeContextScore: homeBreakdown.netScore,
    awayContextScore: awayBreakdown.netScore,
    rawContextGap,
    motivationEdge,
    volatilityScore,
    homeBreakdown,
    awayBreakdown,
    evidence,
    warnings,
  };
}

function normaliseProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 100);
}

function convertFavouriteToOddsSupport(
  favourite: "home" | "draw" | "away" | "none",
  margin: number,
): number {
  if (favourite === "home") {
    if (margin >= 18) return 2;
    if (margin >= 7) return 1;
    return 0;
  }
  if (favourite === "away") {
    if (margin >= 18) return -2;
    if (margin >= 7) return -1;
    return 0;
  }
  return 0;
}

export function calculateOddsFromMarket(market: OddsMarket): OddsCalculation {
  const homeProbability = normaliseProbability(market.homeWinProbability);
  const drawProbability = normaliseProbability(market.drawProbability);
  const awayProbability = normaliseProbability(market.awayWinProbability);
  const ordered = [
    { side: "home" as const, probability: homeProbability },
    { side: "draw" as const, probability: drawProbability },
    { side: "away" as const, probability: awayProbability },
  ].sort((a, b) => b.probability - a.probability);

  const top = ordered[0];
  const second = ordered[1];
  const total = homeProbability + drawProbability + awayProbability;
  const externalFavourite =
    total <= 0 || top.probability <= 0 ? "none" : top.side;
  const favouriteMargin = roundOne(
    Math.max(0, top.probability - second.probability),
  );
  const oddsSupport = convertFavouriteToOddsSupport(
    externalFavourite,
    favouriteMargin,
  );

  const source = market.sourceLabel.trim() || "Manual external check";
  const evidence = [
    `${source}: Home ${homeProbability}%, Draw ${drawProbability}%, Away ${awayProbability}%.`,
    externalFavourite === "none"
      ? "No external favourite is available yet, so Odds Support stays neutral at 0."
      : `External favourite is ${externalFavourite} by ${favouriteMargin} percentage point(s), converted to Odds Support ${oddsSupport >= 0 ? "+" : ""}${oddsSupport}.`,
    "Odds support is a sanity check only. It can add caution or confirmation, but it should not replace the evidence gates.",
  ];

  const warnings: string[] = [];
  if (total > 0 && Math.abs(total - 100) > 8) {
    warnings.push(
      "External probabilities do not add close to 100%, so check the odds inputs.",
    );
  }
  if (externalFavourite === "draw") {
    warnings.push(
      "External signal favours or heavily respects the draw, so avoid overconfident home/away calls.",
    );
  }
  if (favouriteMargin > 0 && favouriteMargin < 7) {
    warnings.push(
      "External market is tight; it does not give clear directional support.",
    );
  }
  if (drawProbability >= 32) {
    warnings.push(
      "Draw probability is elevated, which increases low-confidence or review risk.",
    );
  }

  return {
    homeProbability,
    drawProbability,
    awayProbability,
    externalFavourite,
    favouriteMargin,
    oddsSupport,
    evidence,
    warnings,
  };
}

function selectedSideFromEdge(
  edgeWithoutConflict: number,
): "home" | "away" | "draw" {
  if (edgeWithoutConflict >= 1) return "home";
  if (edgeWithoutConflict <= -1) return "away";
  return "draw";
}

function conflictLevelFromScore(score: number): ConflictLevel {
  if (score >= 4) return "block";
  if (score >= 3) return "review";
  if (score >= 1.5) return "caution";
  return "clean";
}

export function calculateConflictFromSignals(args: {
  scores: MatchScores;
  weights?: Partial<RuleWeights>;
  contextWarnings?: string[];
  oddsWarnings?: string[];
  volatilityScore?: number;
  drawProbability?: number;
  externalFavourite?: "home" | "draw" | "away" | "none";
  favouriteMargin?: number;
}): ConflictCalculation {
  const scores = { ...args.scores, conflictScore: 0 };
  const weights = mergeWeights(args.weights);
  const edgeWithoutConflict = calculateHomeEdge(scores, weights);
  const selectedSide = selectedSideFromEdge(edgeWithoutConflict);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const evidence: string[] = [];
  let rawConflictPoints = 0;
  let failedSignals = 0;
  let cautionSignals = 0;

  function addCaution(points: number, message: string) {
    rawConflictPoints += points;
    cautionSignals += 1;
    warnings.push(message);
  }

  function addFailure(points: number, message: string) {
    rawConflictPoints += points;
    failedSignals += 1;
    blockers.push(message);
    warnings.push(message);
  }

  if (selectedSide === "draw") {
    addFailure(
      1.5,
      "Model edge is near zero before conflicts, so this fixture should not be treated as a confident home/away tip.",
    );
  } else if (Math.abs(edgeWithoutConflict) < 3) {
    addCaution(
      0.75,
      "Directional edge exists but is thin before conflict penalties.",
    );
  }

  if (selectedSide === "home") {
    if (scores.qualityGap <= -1)
      addFailure(1.25, "Quality Gate conflicts with the home-side lean.");
    if (scores.recentFormGap <= -2)
      addFailure(
        1.1,
        "Recent Form Gate strongly conflicts with the home-side lean.",
      );
    else if (scores.recentFormGap < 0)
      addCaution(0.6, "Recent form slightly works against the home-side lean.");
    if (scores.injuryRisk >= 2)
      addFailure(
        1.1,
        "Availability Gate shows significant home-side missing-player risk.",
      );
    else if (scores.injuryRisk === 1)
      addCaution(
        0.5,
        "Availability Gate shows mild home-side missing-player risk.",
      );
    if (scores.motivationEdge <= -2)
      addFailure(1, "Context Gate strongly favours the away side.");
    else if (scores.motivationEdge < 0)
      addCaution(0.5, "Context Gate slightly works against the home side.");
    if (scores.oddsSupport <= -2)
      addFailure(1.25, "Odds Gate strongly disagrees with the home-side lean.");
    else if (scores.oddsSupport < 0)
      addCaution(0.6, "Odds Gate slightly works against the home-side lean.");
  }

  if (selectedSide === "away") {
    if (scores.qualityGap >= 1)
      addFailure(1.25, "Quality Gate conflicts with the away-side lean.");
    if (scores.recentFormGap >= 2)
      addFailure(
        1.1,
        "Recent Form Gate strongly conflicts with the away-side lean.",
      );
    else if (scores.recentFormGap > 0)
      addCaution(0.6, "Recent form slightly works against the away-side lean.");
    if (scores.injuryRisk <= -2)
      addFailure(
        1.1,
        "Availability Gate shows significant away-side missing-player risk.",
      );
    else if (scores.injuryRisk === -1)
      addCaution(
        0.5,
        "Availability Gate shows mild away-side missing-player risk.",
      );
    if (scores.motivationEdge >= 2)
      addFailure(1, "Context Gate strongly favours the home side.");
    else if (scores.motivationEdge > 0)
      addCaution(0.5, "Context Gate slightly works against the away side.");
    if (scores.oddsSupport >= 2)
      addFailure(1.25, "Odds Gate strongly disagrees with the away-side lean.");
    else if (scores.oddsSupport > 0)
      addCaution(0.6, "Odds Gate slightly works against the away-side lean.");
  }

  const volatilityScore = args.volatilityScore ?? 0;
  if (volatilityScore >= 3)
    addFailure(
      1,
      "Match volatility is very high because several volatility flags are active.",
    );
  else if (volatilityScore >= 2)
    addCaution(0.65, "Match volatility is elevated.");

  const drawProbability = args.drawProbability ?? 0;
  if (drawProbability >= 36)
    addFailure(
      0.9,
      "External draw probability is high, which weakens confident home/away calls.",
    );
  else if (drawProbability >= 30)
    addCaution(0.45, "External draw probability is elevated.");

  if (args.externalFavourite === "draw") {
    addFailure(0.9, "External signal has draw as the favourite.");
  } else if (
    (args.favouriteMargin ?? 0) > 0 &&
    (args.favouriteMargin ?? 0) < 7
  ) {
    addCaution(0.35, "External favourite margin is tight.");
  }

  const extraContextWarnings = args.contextWarnings ?? [];
  const extraOddsWarnings = args.oddsWarnings ?? [];
  const extraWarningPoints = Math.min(
    1.2,
    (extraContextWarnings.length + extraOddsWarnings.length) * 0.25,
  );
  if (extraWarningPoints > 0) {
    rawConflictPoints += extraWarningPoints;
    cautionSignals += extraContextWarnings.length + extraOddsWarnings.length;
  }

  const conflictScore = clamp(Math.round(rawConflictPoints), 0, 5);
  const conflictLevel = conflictLevelFromScore(conflictScore);

  evidence.push(
    `Pre-conflict edge is ${edgeWithoutConflict >= 0 ? "+" : ""}${edgeWithoutConflict}, pointing to ${selectedSide}.`,
  );
  evidence.push(
    `${failedSignals} blocking signal(s) and ${cautionSignals} caution signal(s) were detected.`,
  );
  evidence.push(
    `Raw conflict points ${roundOne(rawConflictPoints)} were converted to Conflict Score ${conflictScore}/5.`,
  );
  evidence.push(
    `Conflict level: ${conflictLevel}. Score 0-1 is clean, 2 caution, 3 review, 4-5 block.`,
  );

  return {
    conflictScore,
    rawConflictPoints: roundOne(rawConflictPoints),
    conflictLevel,
    failedSignals,
    cautionSignals,
    evidence,
    warnings: Array.from(new Set(warnings)),
    blockers: Array.from(new Set(blockers)),
  };
}

export function applyCalculatedGaps(
  scores: MatchScores,
  qualityGap: number,
  recentFormGap: number,
  injuryRisk: number = scores.injuryRisk,
  motivationEdge: number = scores.motivationEdge,
  oddsSupport: number = scores.oddsSupport,
  conflictScore: number = scores.conflictScore,
): MatchScores {
  return {
    ...scores,
    qualityGap,
    recentFormGap,
    injuryRisk,
    motivationEdge,
    oddsSupport,
    conflictScore,
  };
}

export function applyCalculatedQualityGap(
  scores: MatchScores,
  qualityGap: number,
): MatchScores {
  return { ...scores, qualityGap };
}

export function calculateHomeEdge(
  scores: MatchScores,
  partialWeights?: Partial<RuleWeights>,
): number {
  const weights = mergeWeights(partialWeights);
  const weightedEdge =
    scores.qualityGap * weights.qualityGap +
    scores.homeAdvantage * weights.homeAdvantage +
    scores.recentFormGap * weights.recentFormGap +
    scores.headToHeadEdge * weights.headToHeadEdge +
    scores.motivationEdge * weights.motivationEdge +
    scores.otherStatsEdge * weights.otherStatsEdge +
    scores.oddsSupport * weights.oddsSupport -
    scores.injuryRisk * weights.injuryRisk -
    scores.conflictScore * weights.conflictScore;

  return roundOne(weightedEdge);
}

function confidenceFromEdge(
  homeEdge: number,
  conflictScore: number,
  partialWeights?: Partial<RuleWeights>,
): number {
  const weights = mergeWeights(partialWeights);
  const raw =
    42 +
    Math.abs(homeEdge) * weights.confidenceEdgeMultiplier -
    conflictScore * weights.confidenceConflictPenalty;
  return Math.round(clamp(raw, 22, 96));
}

function buildGates(
  scores: MatchScores,
  homeEdge: number,
  partialWeights?: Partial<RuleWeights>,
): GateResult[] {
  const weights = mergeWeights(partialWeights);
  const strongSideIsHome = homeEdge > 0;
  const qualitySupportsPick = strongSideIsHome
    ? scores.qualityGap >= 1
    : scores.qualityGap <= -1;
  const formSupportsPick = strongSideIsHome
    ? scores.recentFormGap >= 0
    : scores.recentFormGap <= 0;
  const formStronglyOpposesPick = strongSideIsHome
    ? scores.recentFormGap <= -2
    : scores.recentFormGap >= 2;
  const availabilityAcceptable = strongSideIsHome
    ? scores.injuryRisk <= 1
    : scores.injuryRisk >= -1;
  const contextSupportsPick = strongSideIsHome
    ? scores.motivationEdge >= 0
    : scores.motivationEdge <= 0;
  const contextStronglyOpposesPick = strongSideIsHome
    ? scores.motivationEdge <= -2
    : scores.motivationEdge >= 2;
  const marketNotOpposed = strongSideIsHome
    ? scores.oddsSupport >= -1
    : scores.oddsSupport <= 1;

  return [
    {
      id: "edge",
      name: "Edge Gate",
      status: Math.abs(homeEdge) >= 1 ? "pass" : "fail",
      note:
        Math.abs(homeEdge) >= 1
          ? "The model has a directional edge."
          : "The edge is too close to call.",
    },
    {
      id: "quality",
      name: "Quality Gate",
      status: qualitySupportsPick ? "pass" : "fail",
      note: qualitySupportsPick
        ? "Calculated team strength supports the selected side."
        : "Calculated team strength does not clearly support the selected side.",
    },
    {
      id: "form",
      name: "Form Gate",
      status: formSupportsPick && !formStronglyOpposesPick ? "pass" : "fail",
      note:
        formSupportsPick && !formStronglyOpposesPick
          ? "Calculated recent form supports or does not oppose the tip."
          : "Calculated recent form is pushing against the tip.",
    },
    {
      id: "availability",
      name: "Availability Gate",
      status: availabilityAcceptable ? "pass" : "fail",
      note: availabilityAcceptable
        ? "Calculated missing-player impact is acceptable for the selected side."
        : "Calculated missing-player impact is too high for the selected side.",
    },
    {
      id: "context",
      name: "Context Gate",
      status:
        contextSupportsPick && !contextStronglyOpposesPick ? "pass" : "fail",
      note:
        contextSupportsPick && !contextStronglyOpposesPick
          ? "Calculated motivation/context supports or does not oppose the tip."
          : "Calculated motivation/context is pushing against the tip.",
    },
    {
      id: "market",
      name: "Odds Sanity Gate",
      status: marketNotOpposed ? "pass" : "fail",
      note: marketNotOpposed
        ? "Market signal is not strongly opposed."
        : "Market signal conflicts with the model.",
    },
    {
      id: "conflict",
      name: "Conflict Gate",
      status:
        scores.conflictScore < weights.reviewConflictThreshold
          ? "pass"
          : "fail",
      note:
        scores.conflictScore < weights.reviewConflictThreshold
          ? "Contradictions are manageable."
          : "Too many warning signs. Manual review required.",
    },
  ];
}

function basePrediction(homeEdge: number): PredictionLabel {
  if (homeEdge >= 9) return "Very Strong Home Win";
  if (homeEdge >= 6) return "Strong Home Win";
  if (homeEdge >= 1) return "Lean Home Win";
  if (homeEdge <= -9) return "Very Strong Away Win";
  if (homeEdge <= -6) return "Strong Away Win";
  if (homeEdge <= -1) return "Lean Away Win";
  return "Draw / Low Confidence";
}

function buildWarnings(
  scores: MatchScores,
  homeEdge: number,
  gates: GateResult[],
): string[] {
  const warnings: string[] = [];
  if (Math.abs(homeEdge) < 1)
    warnings.push(
      "The calculated edge is near zero, so a draw or low-confidence pick is more likely.",
    );
  if (scores.conflictScore >= 3)
    warnings.push(
      "Conflict score is high. Do not publish as a strong tip without review.",
    );
  if (scores.recentFormGap <= -2 && homeEdge > 0)
    warnings.push(
      "Recent form strongly conflicts with the home-side prediction.",
    );
  if (scores.recentFormGap >= 2 && homeEdge < 0)
    warnings.push(
      "Recent form strongly conflicts with the away-side prediction.",
    );
  if (scores.injuryRisk >= 2)
    warnings.push("Home team injury risk is significant.");
  if (scores.injuryRisk <= -2)
    warnings.push(
      "Away team injury risk is significant, which may help the home side.",
    );
  if (scores.motivationEdge <= -2 && homeEdge > 0)
    warnings.push("Context strongly conflicts with the home-side prediction.");
  if (scores.motivationEdge >= 2 && homeEdge < 0)
    warnings.push("Context strongly conflicts with the away-side prediction.");
  if (scores.oddsSupport <= -2 && homeEdge > 0)
    warnings.push("Odds strongly disagree with the home-side prediction.");
  if (scores.oddsSupport >= 2 && homeEdge < 0)
    warnings.push("Odds strongly disagree with the away-side prediction.");
  if (gates.filter((gate) => gate.status === "fail").length >= 2)
    warnings.push("Multiple gates failed, so confidence is capped.");
  return warnings;
}

export function runPrediction(
  scores: MatchScores,
  partialWeights?: Partial<RuleWeights>,
): PredictionResult {
  const weights = mergeWeights(partialWeights);
  const homeEdge = calculateHomeEdge(scores, weights);
  const gates = buildGates(scores, homeEdge, weights);
  const failedGates = gates.filter((gate) => gate.status === "fail").length;
  const confidence = confidenceFromEdge(
    homeEdge,
    scores.conflictScore + failedGates,
    weights,
  );
  const warnings = buildWarnings(scores, homeEdge, gates);
  const reviewRequired =
    failedGates >= weights.reviewFailedGateThreshold ||
    scores.conflictScore >= weights.reviewConflictThreshold ||
    confidence < weights.minimumPublishConfidence;

  let prediction = basePrediction(homeEdge);
  if (reviewRequired && prediction !== "Draw / Low Confidence") {
    prediction = "Review Required";
  }

  return {
    homeEdge,
    awayEdge: -homeEdge,
    confidence,
    prediction,
    gateStatus: reviewRequired
      ? "review"
      : failedGates > 0
        ? "blocked"
        : "passed",
    reviewRequired,
    gates,
    warnings,
  };
}

export function getActualOutcome(result: MatchResultInput): ActualOutcome {
  if (result.status !== "final") return "pending";
  if (result.homeGoals > result.awayGoals) return "home";
  if (result.awayGoals > result.homeGoals) return "away";
  return "draw";
}

export function getPredictedOutcome(
  prediction: PredictionResult,
): PredictionOutcome {
  if (
    prediction.reviewRequired ||
    prediction.prediction === "Review Required"
  ) {
    return "review";
  }
  if (prediction.homeEdge >= 1) return "home";
  if (prediction.homeEdge <= -1) return "away";
  return "draw";
}

function labelOutcome(outcome: ActualOutcome | PredictionOutcome): string {
  if (outcome === "home") return "Home win";
  if (outcome === "away") return "Away win";
  if (outcome === "draw") return "Draw";
  if (outcome === "review") return "Review / no published tip";
  return "Pending";
}

export function calculateResultAccuracy(
  prediction: PredictionResult,
  result: MatchResultInput,
): ResultAccuracy {
  const actualOutcome = getActualOutcome(result);
  const predictedOutcome = getPredictedOutcome(prediction);
  const isSettled = actualOutcome !== "pending";
  const isTipPublished = predictedOutcome !== "review";
  const isCorrect =
    !isSettled || !isTipPublished ? null : predictedOutcome === actualOutcome;
  const pointsAwarded = isCorrect ? 1 : 0;

  const evidence = [
    isSettled
      ? `Final score ${result.homeGoals}-${result.awayGoals}, actual outcome: ${labelOutcome(actualOutcome)}.`
      : "No final result entered yet, so accuracy is pending.",
    `Model output: ${prediction.prediction}, mapped to ${labelOutcome(predictedOutcome)} for accuracy tracking.`,
    isTipPublished
      ? isSettled
        ? isCorrect
          ? "Published tip matched the final result."
          : "Published tip did not match the final result."
        : "Published tip is waiting for a final result."
      : "Prediction stayed in review/no-tip status, so it is not counted as a published tip hit or miss.",
  ];

  return {
    actualOutcome,
    predictedOutcome,
    isSettled,
    isTipPublished,
    isCorrect,
    pointsAwarded,
    evidence,
  };
}

export function calculateAccuracySummary(
  items: ResultAccuracy[],
  confidences: number[],
): AccuracySummary {
  const finalFixtures = items.filter((item) => item.isSettled).length;
  const pendingFixtures = items.length - finalFixtures;
  const publishedFinalTips = items.filter(
    (item) => item.isSettled && item.isTipPublished,
  );
  const correctTips = publishedFinalTips.filter(
    (item) => item.isCorrect,
  ).length;
  const reviewOrNoTips = items.filter(
    (item) => item.isSettled && !item.isTipPublished,
  ).length;
  const confidenceCount = confidences.length || 1;

  return {
    totalFixtures: items.length,
    finalFixtures,
    pendingFixtures,
    publishedTips: publishedFinalTips.length,
    correctTips,
    reviewOrNoTips,
    hitRate:
      publishedFinalTips.length > 0
        ? Math.round((correctTips / publishedFinalTips.length) * 100)
        : 0,
    totalPoints: publishedFinalTips.reduce(
      (total, item) => total + item.pointsAwarded,
      0,
    ),
    averageConfidence: Math.round(
      confidences.reduce((total, value) => total + value, 0) / confidenceCount,
    ),
  };
}

export type GateLearningItem = {
  gateId: string;
  gateName: string;
  settledTips: number;
  passPublishedTips: number;
  passCorrectTips: number;
  failPublishedTips: number;
  failCorrectTips: number;
  reviewFlags: number;
  passHitRate: number;
  failHitRate: number;
  recommendation: string;
};

export type GateLearningInput = {
  prediction: PredictionResult;
  accuracy: ResultAccuracy;
};

export type RuleLearningSummary = {
  settledFixtures: number;
  publishedTips: number;
  reviewFixtures: number;
  avoidedPublishedMisses: number;
  bestGateName: string;
  weakestGateName: string;
  learningItems: GateLearningItem[];
  insights: string[];
};

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export function calculateRuleLearningSummary(
  items: GateLearningInput[],
): RuleLearningSummary {
  const settledItems = items.filter((item) => item.accuracy.isSettled);
  const publishedItems = settledItems.filter(
    (item) => item.accuracy.isTipPublished,
  );
  const reviewItems = settledItems.filter(
    (item) => !item.accuracy.isTipPublished,
  );

  const gateMap = new Map<string, GateLearningItem>();

  for (const item of settledItems) {
    for (const gate of item.prediction.gates) {
      const current = gateMap.get(gate.id) ?? {
        gateId: gate.id,
        gateName: gate.name,
        settledTips: 0,
        passPublishedTips: 0,
        passCorrectTips: 0,
        failPublishedTips: 0,
        failCorrectTips: 0,
        reviewFlags: 0,
        passHitRate: 0,
        failHitRate: 0,
        recommendation: "Collect more final results before changing this gate.",
      };

      current.settledTips += 1;

      if (!item.accuracy.isTipPublished) {
        if (gate.status === "fail") current.reviewFlags += 1;
      } else if (gate.status === "pass") {
        current.passPublishedTips += 1;
        if (item.accuracy.isCorrect) current.passCorrectTips += 1;
      } else {
        current.failPublishedTips += 1;
        if (item.accuracy.isCorrect) current.failCorrectTips += 1;
      }

      gateMap.set(gate.id, current);
    }
  }

  const learningItems = Array.from(gateMap.values()).map((gate) => {
    const passHitRate = percentage(
      gate.passCorrectTips,
      gate.passPublishedTips,
    );
    const failHitRate = percentage(
      gate.failCorrectTips,
      gate.failPublishedTips,
    );
    let recommendation =
      "Collect more final results before changing this gate.";

    if (gate.passPublishedTips >= 2 && passHitRate >= 70) {
      recommendation =
        "This gate is currently supporting accurate published tips. Keep its threshold for now.";
    }
    if (gate.passPublishedTips >= 2 && passHitRate < 50) {
      recommendation =
        "This gate is passing too many weak tips. Consider tightening its threshold or weight.";
    }
    if (gate.failPublishedTips >= 1 && failHitRate >= passHitRate) {
      recommendation =
        "Failed-gate tips are still landing. This gate may be too strict or under-weighted elsewhere.";
    }
    if (gate.reviewFlags >= 2 && gate.failPublishedTips === 0) {
      recommendation =
        "This gate is mostly acting as a review blocker. Check whether those reviews were genuinely useful.";
    }

    return {
      ...gate,
      passHitRate,
      failHitRate,
      recommendation,
    };
  });

  const bestGate = learningItems
    .filter((gate) => gate.passPublishedTips > 0)
    .sort(
      (a, b) =>
        b.passHitRate - a.passHitRate ||
        b.passPublishedTips - a.passPublishedTips,
    )[0];
  const weakestGate = learningItems
    .filter((gate) => gate.passPublishedTips > 0)
    .sort(
      (a, b) =>
        a.passHitRate - b.passHitRate ||
        b.passPublishedTips - a.passPublishedTips,
    )[0];

  const avoidedPublishedMisses = reviewItems.length;
  const insights = [
    `${publishedItems.length} settled published tip(s) are available for rule learning.`,
    `${reviewItems.length} settled fixture(s) were held in review/no-tip status instead of being published.`,
    bestGate
      ? `${bestGate.gateName} is currently the strongest supporting gate at ${bestGate.passHitRate}% when it passes on published tips.`
      : "No strongest gate yet because there are not enough settled published tips.",
    weakestGate
      ? `${weakestGate.gateName} is currently the weakest supporting gate at ${weakestGate.passHitRate}% when it passes on published tips.`
      : "No weakest gate yet because there are not enough settled published tips.",
  ];

  return {
    settledFixtures: settledItems.length,
    publishedTips: publishedItems.length,
    reviewFixtures: reviewItems.length,
    avoidedPublishedMisses,
    bestGateName: bestGate?.gateName ?? "Not enough data",
    weakestGateName: weakestGate?.gateName ?? "Not enough data",
    learningItems,
    insights,
  };
}
