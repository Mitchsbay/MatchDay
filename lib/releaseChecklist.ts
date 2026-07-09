export type ReleaseCheckStatus = "pass" | "warn" | "info";

export type ReleaseChecklistItem = {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
};

export type StandingItemStatus = {
  label: string;
  state: "left-alone" | "touched";
  detail: string;
};

export type ReleaseChecklistSummary = {
  version: string;
  patch: string;
  title: string;
  verificationCommand: string;
  deploymentItems: ReleaseChecklistItem[];
  workspaceItems: ReleaseChecklistItem[];
  standingItems: StandingItemStatus[];
  handoffNotes: string[];
};

export type BuildReleaseChecklistInput = {
  fixtureCount: number;
  competitionCount: number;
  aliasRuleCount: number;
  tuningPresetCount: number;
  modelChangeLogCount: number;
  hasSupabaseConfig: boolean;
};

export const CURRENT_RELEASE_VERSION = "0.47.5";

export function buildReleaseChecklist(input: BuildReleaseChecklistInput): ReleaseChecklistSummary {
  const hasFixtures = input.fixtureCount > 0;
  const hasCompetitions = input.competitionCount > 0;

  return {
    version: CURRENT_RELEASE_VERSION,
    patch: "P47.5",
    title: "Single-user tips cleanup + analytics relocation",
    verificationCommand: "npm run verify",
    deploymentItems: [
      {
        id: "verify",
        label: "Verification pipeline",
        status: "info",
        detail: "Before deployment, run npm run verify. It should run the lockfile guard, typecheck, smoke tests, and production build.",
      },
      {
        id: "lockfile",
        label: "Lockfile guard",
        status: "pass",
        detail: "The hardened public-registry lockfile guard remains part of npm run verify.",
      },
      {
        id: "node",
        label: "Node runtime",
        status: "pass",
        detail: "package.json remains pinned to Node 24.x for Vercel compatibility.",
      },
      {
        id: "supabase",
        label: "Supabase browser config",
        status: input.hasSupabaseConfig ? "pass" : "warn",
        detail: input.hasSupabaseConfig
          ? "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are available in this browser build."
          : "Supabase public environment variables are not visible in this browser build. Browser autosave still works, but P38-P40 cloud mirroring and live fixture cache features need env setup.",
      },
    ],
    workspaceItems: [
      {
        id: "fixtures",
        label: "Workspace fixtures",
        status: hasFixtures ? "pass" : "warn",
        detail: `${input.fixtureCount} fixture${input.fixtureCount === 1 ? "" : "s"} in the current workspace.`,
      },
      {
        id: "competitions",
        label: "Competition coverage",
        status: hasCompetitions ? "pass" : "warn",
        detail: `${input.competitionCount} competition${input.competitionCount === 1 ? "" : "s"} detected from workspace fixtures.`,
      },
      {
        id: "aliases",
        label: "Team aliases",
        status: input.aliasRuleCount > 0 ? "pass" : "info",
        detail: `${input.aliasRuleCount} alias rule${input.aliasRuleCount === 1 ? "" : "s"} configured.`,
      },
      {
        id: "presets",
        label: "Tuning presets",
        status: input.tuningPresetCount > 0 ? "pass" : "info",
        detail: `${input.tuningPresetCount} saved tuning preset${input.tuningPresetCount === 1 ? "" : "s"}.`,
      },
      {
        id: "change-log",
        label: "Model change log",
        status: input.modelChangeLogCount > 0 ? "pass" : "info",
        detail: `${input.modelChangeLogCount} model change-log entr${input.modelChangeLogCount === 1 ? "y" : "ies"}.`,
      },
    ],
    standingItems: [
      {
        label: "Tennis H2H gate",
        state: "left-alone",
        detail: "P45 does not touch tennis scoring files or tennis panel wiring.",
      },
      {
        label: "Alias-priority fix",
        state: "left-alone",
        detail: "P45 does not change team alias matching or import alias application.",
      },
      {
        label: "P28 probability rounding fix",
        state: "left-alone",
        detail: "P45 does not change probability calculation or rounding logic.",
      },
      {
        label: "Lockfile guard",
        state: "left-alone",
        detail: "P45 preserves the public-registry lockfile guard and npm run verify pipeline.",
      },
    ],
    handoffNotes: [
      "P45 adds an Advanced Data Calibration Review for the P43/P44 advanced evidence signals and gate.",
      "The calibration review is advisory and does not retune the model; no tennis, alias, probability rounding, or lockfile logic is intentionally changed.",
      "This continues the five-patch Claude handoff cycle: P41–P45.",
    ],
  };
}

export function countChecklistStatuses(items: ReleaseChecklistItem[]) {
  return items.reduce(
    (counts, item) => ({
      ...counts,
      [item.status]: counts[item.status] + 1,
    }),
    { pass: 0, warn: 0, info: 0 } as Record<ReleaseCheckStatus, number>,
  );
}
