import type { Fixture, TipPick } from "./sampleData";
import type { FixtureAdvancedEvidence, TeamAdvancedEvidence } from "./advancedEvidence";
import type { PredictionLabel } from "./scoringEngine";

export type AdvancedDataGateVerdict = "supports" | "weakens" | "review" | "insufficient-data";
export type AdvancedDataGateSeverity = "low" | "medium" | "high";

export type AdvancedDataGateSignal = {
  id: string;
  category: string;
  label: string;
  score: number;
  severity: AdvancedDataGateSeverity;
  supports?: "home" | "away" | "draw" | "review";
  detail: string;
};

export type AdvancedDataGateResult = {
  fixtureId: string;
  fixtureLabel: string;
  predictionLabel: string;
  verdict: AdvancedDataGateVerdict;
  score: number;
  confidenceAdjustment: number;
  signalCount: number;
  supportCount: number;
  warningCount: number;
  reviewCount: number;
  signals: AdvancedDataGateSignal[];
  recommendations: string[];
};

export type AdvancedDataGateFixtureInput = {
  fixture: Fixture;
  prediction?: {
    label?: PredictionLabel | string;
    prediction?: PredictionLabel | string;
    pick?: TipPick | "review";
    confidence?: number;
  };
};

export type AdvancedDataGateSummary = {
  fixtureCount: number;
  fixturesWithGateData: number;
  supportsCount: number;
  weakensCount: number;
  reviewCount: number;
  insufficientDataCount: number;
  averageScore: number;
  topGateResults: AdvancedDataGateResult[];
  notes: string[];
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function predictionSide(label: unknown): "home" | "away" | "draw" | "review" | "unknown" {
  const text = String(label ?? "").toLowerCase();
  if (text.includes("home")) return "home";
  if (text.includes("away")) return "away";
  if (text.includes("draw")) return "draw";
  if (text.includes("review")) return "review";
  return "unknown";
}

function hasEvidence(evidence?: FixtureAdvancedEvidence): boolean {
  if (!evidence) return false;
  return Boolean(
    Object.keys(evidence.home ?? {}).length ||
    Object.keys(evidence.away ?? {}).length ||
    Object.keys(evidence.match ?? {}).length,
  );
}

function xgDiff(side?: TeamAdvancedEvidence): number | null {
  if (!side) return null;
  const forValue = isNumber(side.recentExpectedGoalsFor) ? side.recentExpectedGoalsFor : side.expectedGoalsFor;
  const againstValue = isNumber(side.recentExpectedGoalsAgainst) ? side.recentExpectedGoalsAgainst : side.expectedGoalsAgainst;
  if (!isNumber(forValue) || !isNumber(againstValue)) return null;
  return forValue - againstValue;
}

function fatigueLoad(side?: TeamAdvancedEvidence): number {
  if (!side) return 0;
  let score = 0;
  if (isNumber(side.daysSinceLastMatch)) {
    if (side.daysSinceLastMatch <= 2) score += 3;
    else if (side.daysSinceLastMatch <= 3) score += 2;
    else if (side.daysSinceLastMatch <= 4) score += 1;
  }
  if (isNumber(side.matchesLast7Days)) score += Math.max(0, side.matchesLast7Days - 1) * 2;
  if (isNumber(side.matchesLast14Days)) score += Math.max(0, side.matchesLast14Days - 3);
  if (side.travelBurden === "high") score += 3;
  if (side.travelBurden === "moderate") score += 2;
  if (side.travelBurden === "low") score += 1;
  if (isNumber(side.daysUntilNextMatch) && side.daysUntilNextMatch <= 3) score += 1;
  return score;
}

function playerImpactRisk(side?: TeamAdvancedEvidence): number {
  if (!side) return 0;
  return (
    (side.missingStarters ?? 0) +
    (side.missingKeyAttackers ?? 0) * 2 +
    (side.missingKeyDefenders ?? 0) * 2 +
    (side.missingGoalkeepers ?? 0) * 3 -
    (side.returningKeyPlayers ?? 0)
  );
}

function setPieceEdge(side?: TeamAdvancedEvidence): number | null {
  if (!side) return null;
  if (![side.setPieceGoalsFor, side.setPieceGoalsAgainst, side.cornersForPerMatch, side.cornersAgainstPerMatch].some(isNumber)) return null;
  return (side.setPieceGoalsFor ?? 0) - (side.setPieceGoalsAgainst ?? 0) + ((side.cornersForPerMatch ?? 0) - (side.cornersAgainstPerMatch ?? 0)) * 0.25;
}

function disciplineRisk(side?: TeamAdvancedEvidence): number {
  if (!side) return 0;
  return (side.yellowCardsPerMatch ?? 0) + (side.redCardsPerMatch ?? 0) * 4;
}

function severity(absScore: number): AdvancedDataGateSeverity {
  if (absScore >= 3) return "high";
  if (absScore >= 1.5) return "medium";
  return "low";
}

function sideFromSignedGap(gap: number): "home" | "away" {
  return gap >= 0 ? "home" : "away";
}

function addSignal(signals: AdvancedDataGateSignal[], signal: AdvancedDataGateSignal) {
  signals.push({ ...signal, score: round1(signal.score) });
}

export function buildAdvancedDataGate(input: AdvancedDataGateFixtureInput): AdvancedDataGateResult {
  const { fixture } = input;
  const evidence = fixture.advancedEvidence;
  const predictionLabel = String(input.prediction?.label ?? input.prediction?.prediction ?? input.prediction?.pick ?? "No prediction");
  const predictedSide = predictionSide(predictionLabel);
  const signals: AdvancedDataGateSignal[] = [];

  if (!hasEvidence(evidence)) {
    return {
      fixtureId: fixture.id,
      fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      predictionLabel,
      verdict: "insufficient-data",
      score: 0,
      confidenceAdjustment: 0,
      signalCount: 0,
      supportCount: 0,
      warningCount: 0,
      reviewCount: 0,
      signals,
      recommendations: ["No advanced evidence is available yet. Use P42 imports before using this gate for tuning decisions."],
    };
  }

  const homeXg = xgDiff(evidence?.home);
  const awayXg = xgDiff(evidence?.away);
  if (homeXg !== null && awayXg !== null && Math.abs(homeXg - awayXg) >= 0.6) {
    const gap = (homeXg - awayXg) * 2;
    addSignal(signals, {
      id: "xg-edge",
      category: "xG",
      label: sideFromSignedGap(gap) === "home" ? "xG supports home" : "xG supports away",
      score: gap,
      severity: severity(Math.abs(gap)),
      supports: sideFromSignedGap(gap),
      detail: `Home xG diff ${round1(homeXg)} vs away ${round1(awayXg)}.`,
    });
  }

  const homeSchedule = evidence?.home?.recentOpponentAveragePointsPerGame;
  const awaySchedule = evidence?.away?.recentOpponentAveragePointsPerGame;
  if (isNumber(homeSchedule) && isNumber(awaySchedule) && Math.abs(homeSchedule - awaySchedule) >= 0.35) {
    const gap = homeSchedule - awaySchedule;
    addSignal(signals, {
      id: "schedule-strength",
      category: "Schedule strength",
      label: gap > 0 ? "Home form faced tougher opponents" : "Away form faced tougher opponents",
      score: gap * 2,
      severity: severity(Math.abs(gap * 2)),
      supports: sideFromSignedGap(gap),
      detail: `Recent opponent PPG: home ${round1(homeSchedule)}, away ${round1(awaySchedule)}.`,
    });
  }

  const homeFatigue = fatigueLoad(evidence?.home);
  const awayFatigue = fatigueLoad(evidence?.away);
  if (Math.abs(homeFatigue - awayFatigue) >= 2) {
    const gap = awayFatigue - homeFatigue;
    addSignal(signals, {
      id: "fatigue",
      category: "Fatigue",
      label: gap > 0 ? "Away fatigue supports home" : "Home fatigue supports away",
      score: gap * 0.8,
      severity: severity(Math.abs(gap * 0.8)),
      supports: sideFromSignedGap(gap),
      detail: `Home fatigue load ${homeFatigue}, away fatigue load ${awayFatigue}.`,
    });
  }

  const homePlayerRisk = playerImpactRisk(evidence?.home);
  const awayPlayerRisk = playerImpactRisk(evidence?.away);
  if (Math.abs(homePlayerRisk - awayPlayerRisk) >= 2) {
    const gap = awayPlayerRisk - homePlayerRisk;
    addSignal(signals, {
      id: "player-impact",
      category: "Player impact",
      label: gap > 0 ? "Away absences support home" : "Home absences support away",
      score: gap,
      severity: severity(Math.abs(gap)),
      supports: sideFromSignedGap(gap),
      detail: `Home player-impact risk ${homePlayerRisk}, away player-impact risk ${awayPlayerRisk}.`,
    });
  }

  const homeSetPiece = setPieceEdge(evidence?.home);
  const awaySetPiece = setPieceEdge(evidence?.away);
  if (homeSetPiece !== null && awaySetPiece !== null && Math.abs(homeSetPiece - awaySetPiece) >= 1.5) {
    const gap = homeSetPiece - awaySetPiece;
    addSignal(signals, {
      id: "set-pieces",
      category: "Set pieces",
      label: gap > 0 ? "Set pieces support home" : "Set pieces support away",
      score: gap * 0.7,
      severity: severity(Math.abs(gap * 0.7)),
      supports: sideFromSignedGap(gap),
      detail: `Set-piece edge estimate: home ${round1(homeSetPiece)}, away ${round1(awaySetPiece)}.`,
    });
  }

  const homeDiscipline = disciplineRisk(evidence?.home);
  const awayDiscipline = disciplineRisk(evidence?.away);
  if (Math.max(homeDiscipline, awayDiscipline) >= 3) {
    addSignal(signals, {
      id: "discipline-volatility",
      category: "Discipline",
      label: "Card profile adds review risk",
      score: -Math.min(4, Math.max(homeDiscipline, awayDiscipline) * 0.8),
      severity: severity(Math.max(homeDiscipline, awayDiscipline) * 0.8),
      supports: "review",
      detail: `Discipline risk: home ${round1(homeDiscipline)}, away ${round1(awayDiscipline)}.`,
    });
  }

  const movement = evidence?.match?.marketMovementDirection;
  const movementStrength = evidence?.match?.marketMovementStrength ?? 0;
  if (movement && movement !== "stable" && movement !== "unknown" && movementStrength >= 4) {
    const support = movement === "home-shortening" ? "home" : movement === "away-shortening" ? "away" : "draw";
    const marketScore = movementStrength * 0.8;
    addSignal(signals, {
      id: "market-movement",
      category: "Market movement",
      label: `Market movement: ${movement.replace("-", " ")}`,
      score: support === "draw" ? -marketScore : (support === "home" ? marketScore : -marketScore),
      severity: severity(marketScore),
      supports: support,
      detail: `Movement strength ${movementStrength}; compare against model before publishing.`,
    });
  }

  const volatilityFlags = [
    evidence?.home?.stability === "volatile" ? "home volatile" : "",
    evidence?.away?.stability === "volatile" ? "away volatile" : "",
    evidence?.match?.weatherDisruptionRisk ? "weather risk" : "",
    evidence?.match?.neutralVenue ? "neutral venue" : "",
  ].filter(Boolean);
  if (volatilityFlags.length > 0) {
    addSignal(signals, {
      id: "advanced-context-volatility",
      category: "Context",
      label: "Advanced context adds review risk",
      score: -volatilityFlags.length * 1.5,
      severity: severity(volatilityFlags.length * 1.5),
      supports: "review",
      detail: `Flags: ${volatilityFlags.join(", ")}.`,
    });
  }

  const directionalSignals = signals.filter((signal) => signal.supports === "home" || signal.supports === "away" || signal.supports === "draw");
  const supportCount = directionalSignals.filter((signal) => signal.supports === predictedSide).length;
  const warningCount = directionalSignals.filter((signal) => predictedSide !== "unknown" && signal.supports !== predictedSide).length;
  const reviewCount = signals.filter((signal) => signal.supports === "review").length;
  const score = round1(signals.reduce((sum, signal) => sum + signal.score, 0));
  const absScore = Math.abs(score);
  const confidenceAdjustment = Math.max(-8, Math.min(8, Math.round(score)));

  let verdict: AdvancedDataGateVerdict = "review";
  if (signals.length === 0) verdict = "insufficient-data";
  else if (reviewCount >= 2 || warningCount > supportCount) verdict = "review";
  else if (predictedSide === "home" && score >= 1.5) verdict = "supports";
  else if (predictedSide === "away" && score <= -1.5) verdict = "supports";
  else if (predictedSide === "draw" && directionalSignals.some((signal) => signal.supports === "draw")) verdict = "supports";
  else if (absScore >= 1.5) verdict = "weakens";

  const recommendations: string[] = [];
  if (verdict === "supports") recommendations.push("Advanced data supports the current prediction direction; keep normal review controls in place.");
  if (verdict === "weakens") recommendations.push("Advanced data leans against the current prediction; reduce confidence or send to manual review.");
  if (verdict === "review") recommendations.push("Advanced data contains conflicts or volatility; hold this fixture for review before publishing.");
  if (verdict === "insufficient-data") recommendations.push("Advanced evidence coverage is still thin; do not tune weights from this fixture yet.");
  if (confidenceAdjustment !== 0) recommendations.push(`Suggested confidence guidance: ${confidenceAdjustment > 0 ? "+" : ""}${confidenceAdjustment} points, advisory only.`);

  return {
    fixtureId: fixture.id,
    fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    predictionLabel,
    verdict,
    score,
    confidenceAdjustment,
    signalCount: signals.length,
    supportCount,
    warningCount,
    reviewCount,
    signals,
    recommendations,
  };
}

export function buildAdvancedDataGateSummary(items: AdvancedDataGateFixtureInput[]): AdvancedDataGateSummary {
  const gateResults = items.map(buildAdvancedDataGate);
  const fixturesWithGateData = gateResults.filter((result) => result.signalCount > 0).length;
  const scored = gateResults.filter((result) => result.signalCount > 0);
  const averageScore = scored.length > 0 ? round1(scored.reduce((sum, result) => sum + result.score, 0) / scored.length) : 0;
  const verdictRank: Record<AdvancedDataGateVerdict, number> = { review: 4, weakens: 3, supports: 2, "insufficient-data": 1 };
  const topGateResults = [...gateResults]
    .filter((result) => result.signalCount > 0)
    .sort((a, b) => verdictRank[b.verdict] - verdictRank[a.verdict] || Math.abs(b.score) - Math.abs(a.score) || a.fixtureLabel.localeCompare(b.fixtureLabel))
    .slice(0, 12);

  return {
    fixtureCount: items.length,
    fixturesWithGateData,
    supportsCount: gateResults.filter((result) => result.verdict === "supports").length,
    weakensCount: gateResults.filter((result) => result.verdict === "weakens").length,
    reviewCount: gateResults.filter((result) => result.verdict === "review").length,
    insufficientDataCount: gateResults.filter((result) => result.verdict === "insufficient-data").length,
    averageScore,
    topGateResults,
    notes: [
      "P44 adds a conservative Advanced Data Gate, but it does not replace the existing prediction model or auto-apply weight changes.",
      "The confidence adjustment is guidance only and is intended for review/tuning workflows before any future live scoring integration.",
    ],
  };
}
