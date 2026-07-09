import type { Fixture, TipPick } from "./sampleData";
import { getActualOutcomeFromScore } from "./workspace";

export type BetSettlement = "pending" | "win" | "loss";

export type BankrollRow = {
  fixtureId: string;
  competition: string;
  match: string;
  date: string;
  outcomeBacked: TipPick;
  odds: string;
  stake: number;
  settlement: BetSettlement;
  payout: number;
  rollingTotal: number;
};

export function parseFractionalOdds(odds: string): number | null {
  const trimmed = odds.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function sortableDateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function calculateBetPayout(args: {
  odds: string;
  stake: number;
  outcomeBacked: TipPick;
  actualOutcome: TipPick | "pending";
}): { settlement: BetSettlement; payout: number } {
  const stake = Math.max(0, Number(args.stake) || 0);
  if (args.actualOutcome === "pending") return { settlement: "pending", payout: 0 };
  if (args.actualOutcome !== args.outcomeBacked) return { settlement: "loss", payout: -stake };
  const multiplier = parseFractionalOdds(args.odds);
  if (multiplier === null) return { settlement: "win", payout: 0 };
  return { settlement: "win", payout: Math.round(stake * multiplier * 100) / 100 };
}

export function buildBankrollRows(fixtures: Fixture[]): BankrollRow[] {
  let rollingTotal = 0;
  return fixtures
    .filter((fixture) => {
      const betLog = fixture.betLog;
      return Boolean(betLog?.outcomeBacked && betLog.stake > 0 && betLog.odds.trim());
    })
    .sort((a, b) => {
      const dateDelta = sortableDateValue(a.date) - sortableDateValue(b.date);
      if (dateDelta !== 0) return dateDelta;
      return `${a.homeTeam} ${a.awayTeam}`.localeCompare(`${b.homeTeam} ${b.awayTeam}`);
    })
    .map((fixture) => {
      const betLog = fixture.betLog!;
      const actualOutcome = getActualOutcomeFromScore(fixture.matchResult);
      const calculated = calculateBetPayout({
        odds: betLog.odds,
        stake: betLog.stake,
        outcomeBacked: betLog.outcomeBacked,
        actualOutcome,
      });
      rollingTotal += calculated.payout;
      return {
        fixtureId: fixture.id,
        competition: fixture.competition,
        match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        date: fixture.date,
        outcomeBacked: betLog.outcomeBacked,
        odds: betLog.odds,
        stake: betLog.stake,
        settlement: calculated.settlement,
        payout: calculated.payout,
        rollingTotal: Math.round(rollingTotal * 100) / 100,
      };
    });
}
