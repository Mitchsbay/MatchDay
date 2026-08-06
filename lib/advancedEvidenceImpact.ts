import type { Fixture, TipPick } from "./sampleData";
import type { FixtureAdvancedEvidence, TeamAdvancedEvidence } from "./advancedEvidence";
import type { PredictionLabel } from "./scoringEngine";

export type AdvancedImpactSeverity = "watch" | "caution" | "strong";
export type AdvancedImpactDirection = "home" | "away" | "draw-risk" | "volatility" | "market" | "neutral";

export type AdvancedImpactSignal = {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  category: string;
  severity: AdvancedImpactSeverity;
  direction: AdvancedImpactDirection;
  title: string;
  detail: string;
  currentPrediction: string;
};

export type AdvancedImpactFixtureInput = {
  fixture: Fixture;
  prediction?: {
    label?: PredictionLabel | string;
    prediction?: PredictionLabel | string;
    pick?: TipPick | "review";
    confidence?: number;
  };
  probabilities?: unknown;
};

export type AdvancedImpactSummary = {
  fixtureCount: number;
  fixturesWithAdvancedEvidence: number;
  signalCount: number;
  strongSignalCount: number;
  cautionSignalCount: number;
  watchSignalCount: number;
  coveragePct: number;
  topSignals: AdvancedImpactSignal[];
  categoryCounts: Array<{ category: string; count: number }>;
  notes: string[];
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round1(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
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

function playerImpact(side?: TeamAdvancedEvidence): number {
  if (!side) return 0;
  return (
    (side.missingStarters ?? 0) * 1 +
    (side.missingKeyAttackers ?? 0) * 2 +
    (side.missingKeyDefenders ?? 0) * 2 +
    (side.missingGoalkeepers ?? 0) * 3 -
    (side.returningKeyPlayers ?? 0) * 1
  );
}

function setPieceEdge(side?: TeamAdvancedEvidence): number | null {
  if (!side) return null;
  const goalsFor = side.setPieceGoalsFor ?? 0;
  const goalsAgainst = side.setPieceGoalsAgainst ?? 0;
  const cornersFor = side.cornersForPerMatch ?? 0;
  const cornersAgainst = side.cornersAgainstPerMatch ?? 0;
  if (![side.setPieceGoalsFor, side.setPieceGoalsAgainst, side.cornersForPerMatch, side.cornersAgainstPerMatch].some(isNumber)) return null;
  return goalsFor - goalsAgainst + (cornersFor - cornersAgainst) * 0.25;
}

function disciplineRisk(side?: TeamAdvancedEvidence): number {
  if (!side) return 0;
  return (side.yellowCardsPerMatch ?? 0) + (side.redCardsPerMatch ?? 0) * 4;
}

function severityFromGap(gap: number, strong = 3, caution = 1.5): AdvancedImpactSeverity {
  const abs = Math.abs(gap);
  if (abs >= strong) return "strong";
  if (abs >= caution) return "caution";
  return "watch";
}

function directionFromGap(gap: number, positiveDirection: AdvancedImpactDirection = "home", negativeDirection: AdvancedImpactDirection = "away"): AdvancedImpactDirection {
  if (gap > 0) return positiveDirection;
  if (gap < 0) return negativeDirection;
  return "neutral";
}

function addSignal(signals: AdvancedImpactSignal[], signal: AdvancedImpactSignal) {
  signals.push(signal);
}

function fixtureLabel(fixture: Fixture): string {
  return `${fixture.homeTeam} vs ${fixture.awayTeam}`;
}

export function buildAdvancedEvidenceImpactSummary(items: AdvancedImpactFixtureInput[]): AdvancedImpactSummary {
  const signals: AdvancedImpactSignal[] = [];

  items.forEach((item) => {
    const { fixture } = item;
    const evidence = fixture.advancedEvidence;
    if (!evidence) return;
    const label = fixtureLabel(fixture);
    const predictionLabel = item.prediction?.label ?? item.prediction?.prediction ?? "No prediction";

    const homeXg = xgDiff(evidence.home);
    const awayXg = xgDiff(evidence.away);
    if (homeXg !== null && awayXg !== null) {
      const gap = homeXg - awayXg;
      if (Math.abs(gap) >= 0.6) {
        addSignal(signals, {
          id: `${fixture.id}-xg`,
          fixtureId: fixture.id,
          fixtureLabel: label,
          category: "xG edge",
          severity: severityFromGap(gap, 1.5, 0.6),
          direction: directionFromGap(gap),
          title: gap > 0 ? "Home xG profile is stronger" : "Away xG profile is stronger",
          detail: `Home xG diff ${round1(homeXg)} vs away ${round1(awayXg)}. This is an evidence signal only in P43.`,
          currentPrediction: predictionLabel,
        });
      }
    }

    const homeFatigue = fatigueLoad(evidence.home);
    const awayFatigue = fatigueLoad(evidence.away);
    const fatigueGap = awayFatigue - homeFatigue;
    if (Math.abs(fatigueGap) >= 2) {
      addSignal(signals, {
        id: `${fixture.id}-fatigue`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Fatigue / congestion",
        severity: severityFromGap(fatigueGap, 5, 2),
        direction: directionFromGap(fatigueGap),
        title: fatigueGap > 0 ? "Away side carries more fatigue risk" : "Home side carries more fatigue risk",
        detail: `Home fatigue load ${homeFatigue}, away fatigue load ${awayFatigue}. Check rest days, travel and fixture congestion.`,
        currentPrediction: predictionLabel,
      });
    }

    const homePlayerImpact = playerImpact(evidence.home);
    const awayPlayerImpact = playerImpact(evidence.away);
    const playerGap = awayPlayerImpact - homePlayerImpact;
    if (Math.abs(playerGap) >= 2) {
      addSignal(signals, {
        id: `${fixture.id}-player-impact`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Player impact",
        severity: severityFromGap(playerGap, 5, 2),
        direction: directionFromGap(playerGap),
        title: playerGap > 0 ? "Away absences may support home side" : "Home absences may support away side",
        detail: `Home player-impact risk ${homePlayerImpact}, away player-impact risk ${awayPlayerImpact}. Missing starters/key roles are separated from generic availability.`,
        currentPrediction: predictionLabel,
      });
    }

    const homeSchedule = evidence.home?.recentOpponentAveragePointsPerGame;
    const awaySchedule = evidence.away?.recentOpponentAveragePointsPerGame;
    if (isNumber(homeSchedule) && isNumber(awaySchedule) && Math.abs(homeSchedule - awaySchedule) >= 0.35) {
      const gap = homeSchedule - awaySchedule;
      addSignal(signals, {
        id: `${fixture.id}-schedule-strength`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Strength of schedule",
        severity: severityFromGap(gap, 0.75, 0.35),
        direction: directionFromGap(gap),
        title: gap > 0 ? "Home recent form came against stronger opponents" : "Away recent form came against stronger opponents",
        detail: `Recent opponent PPG: home ${round1(homeSchedule)}, away ${round1(awaySchedule)}. Use this to sanity-check form ratings.`,
        currentPrediction: predictionLabel,
      });
    }

    const homeSetPiece = setPieceEdge(evidence.home);
    const awaySetPiece = setPieceEdge(evidence.away);
    if (homeSetPiece !== null && awaySetPiece !== null && Math.abs(homeSetPiece - awaySetPiece) >= 1.5) {
      const gap = homeSetPiece - awaySetPiece;
      addSignal(signals, {
        id: `${fixture.id}-set-pieces`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Set pieces",
        severity: severityFromGap(gap, 3, 1.5),
        direction: directionFromGap(gap),
        title: gap > 0 ? "Home set-piece profile is stronger" : "Away set-piece profile is stronger",
        detail: `Set-piece edge estimate: home ${round1(homeSetPiece)}, away ${round1(awaySetPiece)}. Useful for tight matches.`,
        currentPrediction: predictionLabel,
      });
    }

    const homeDiscipline = disciplineRisk(evidence.home);
    const awayDiscipline = disciplineRisk(evidence.away);
    if (Math.max(homeDiscipline, awayDiscipline) >= 2.8 || Math.abs(homeDiscipline - awayDiscipline) >= 1.2) {
      const gap = awayDiscipline - homeDiscipline;
      addSignal(signals, {
        id: `${fixture.id}-discipline`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Discipline / volatility",
        severity: Math.max(homeDiscipline, awayDiscipline) >= 4 ? "strong" : "caution",
        direction: Math.abs(gap) >= 1.2 ? directionFromGap(gap) : "volatility",
        title: "Card profile adds volatility",
        detail: `Discipline risk: home ${round1(homeDiscipline)}, away ${round1(awayDiscipline)}. High card profiles should reduce blind confidence.`,
        currentPrediction: predictionLabel,
      });
    }

    if (evidence.home?.stability === "volatile" || evidence.away?.stability === "volatile" || evidence.match?.weatherDisruptionRisk || evidence.match?.neutralVenue) {
      const flags = [
        evidence.home?.stability === "volatile" ? "home volatile" : "",
        evidence.away?.stability === "volatile" ? "away volatile" : "",
        evidence.match?.weatherDisruptionRisk ? "weather risk" : "",
        evidence.match?.neutralVenue ? "neutral venue" : "",
      ].filter(Boolean);
      addSignal(signals, {
        id: `${fixture.id}-context-volatility`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Context volatility",
        severity: flags.length >= 2 ? "strong" : "caution",
        direction: "volatility",
        title: "Advanced context adds review risk",
        detail: `Flags: ${flags.join(", ")}. Consider holding confidence until checked.`,
        currentPrediction: predictionLabel,
      });
    }

    const movement = evidence.match?.marketMovementDirection;
    const movementStrength = evidence.match?.marketMovementStrength ?? 0;
    if (movement && movement !== "stable" && movement !== "unknown" && movementStrength >= 4) {
      const direction: AdvancedImpactDirection = movement === "home-shortening" ? "home" : movement === "away-shortening" ? "away" : "draw-risk";
      addSignal(signals, {
        id: `${fixture.id}-market-movement`,
        fixtureId: fixture.id,
        fixtureLabel: label,
        category: "Market movement",
        severity: movementStrength >= 7 ? "strong" : "caution",
        direction,
        title: "Market movement is meaningful",
        detail: `${movement.replace("-", " ")} with strength ${movementStrength}. Compare this against model probabilities before publishing.`,
        currentPrediction: predictionLabel,
      });
    }
  });

  const categoryMap = new Map<string, number>();
  signals.forEach((signal) => categoryMap.set(signal.category, (categoryMap.get(signal.category) ?? 0) + 1));
  const fixtureCount = items.length;
  const fixturesWithAdvancedEvidence = items.filter((item) => hasEvidence(item.fixture.advancedEvidence)).length;
  const severityRank: Record<AdvancedImpactSeverity, number> = { strong: 3, caution: 2, watch: 1 };
  const topSignals = [...signals]
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.fixtureLabel.localeCompare(b.fixtureLabel))
    .slice(0, 12);

  return {
    fixtureCount,
    fixturesWithAdvancedEvidence,
    signalCount: signals.length,
    strongSignalCount: signals.filter((signal) => signal.severity === "strong").length,
    cautionSignalCount: signals.filter((signal) => signal.severity === "caution").length,
    watchSignalCount: signals.filter((signal) => signal.severity === "watch").length,
    coveragePct: fixtureCount > 0 ? Math.round((fixturesWithAdvancedEvidence / fixtureCount) * 100) : 0,
    topSignals,
    categoryCounts: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    notes: [
      "P43 converts advanced evidence into review signals only; it does not change live prediction scoring, weights, probabilities, or published tips.",
      "Use these signals to decide which fixtures need manual review before the future Advanced Data Gate is added.",
    ],
  };
}
