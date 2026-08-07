import type { TeamContext } from "./scoringEngine";

// These thresholds are deliberately simple, fixed bands (top 3 / bottom 4 /
// 4th-7th) rather than a league-specific model of exactly how many teams
// are promoted, relegated, or qualify for Europe in a given competition —
// that varies by league and season (the Championship relegates 3 but has a
// 4-team playoff for promotion; a 20-team top flight isn't the same shape
// as a 16-team one). Treat this as a rough "is this team near the sharp
// end of the table" signal to review and adjust, not a competition-aware
// verdict.

export type StandingsContext = {
  position: number;
  totalTeams: number;
};

export type ContextFlagSuggestion = {
  flags: Partial<TeamContext>;
  reasoning: string[];
};

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function suggestTeamContextFlags(standings: StandingsContext): ContextFlagSuggestion {
  const { position, totalTeams } = standings;
  const flags: Partial<TeamContext> = {};
  const reasoning: string[] = [];
  const posLabel = `${ordinal(position)} of ${totalTeams}`;

  if (totalTeams <= 0 || position <= 0) {
    return { flags, reasoning: ["No usable table position — leaving context flags untouched."] };
  }

  if (position <= 3) {
    flags.titleRace = true;
    reasoning.push(`${posLabel} — in touch with the title race.`);
  } else if (position <= 7) {
    flags.chasingFinalsOrEurope = true;
    reasoning.push(`${posLabel} — in touch with the continental qualification places.`);
  }

  if (position >= totalTeams - 3) {
    flags.relegationBattle = true;
    reasoning.push(`${posLabel} — in or just above the relegation zone.`);
  } else if (position > 7 && position < totalTeams - 3) {
    flags.alreadyQualifiedOrSafe = true;
    reasoning.push(`${posLabel} — comfortably mid-table, likely safe from both ends.`);
  }

  return { flags, reasoning };
}
