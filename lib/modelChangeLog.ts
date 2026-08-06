import type { RuleWeights } from "./scoringEngine";

export type ModelChangeReason =
  | "sandbox-apply"
  | "live-reset"
  | "manual-snapshot"
  | "imported-workspace";

export type ModelChangeLogEntry = {
  id: string;
  createdAt: string;
  reason: ModelChangeReason;
  label: string;
  note: string;
  beforeWeights: RuleWeights;
  afterWeights: RuleWeights;
  changedKeys: Array<keyof RuleWeights>;
};

export type ModelChangeLogSummary = {
  totalEntries: number;
  latestEntry: ModelChangeLogEntry | null;
  sandboxApplications: number;
  resets: number;
  manualSnapshots: number;
  changedKeyCounts: Array<{ key: keyof RuleWeights; count: number }>;
  recentEntries: ModelChangeLogEntry[];
};

const MAX_NOTE_LENGTH = 240;
const MAX_LABEL_LENGTH = 80;
const MAX_LOG_ENTRIES = 80;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `model-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneRuleWeights(weights: RuleWeights): RuleWeights {
  return { ...weights };
}

export function getChangedRuleWeightKeys(beforeWeights: RuleWeights, afterWeights: RuleWeights): Array<keyof RuleWeights> {
  return (Object.keys(afterWeights) as Array<keyof RuleWeights>).filter(
    (key) => beforeWeights[key] !== afterWeights[key],
  );
}

function sanitiseText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function createModelChangeLogEntry(args: {
  reason: ModelChangeReason;
  label: string;
  note?: string;
  beforeWeights: RuleWeights;
  afterWeights: RuleWeights;
}): ModelChangeLogEntry | null {
  const changedKeys = getChangedRuleWeightKeys(args.beforeWeights, args.afterWeights);
  if (changedKeys.length === 0 && args.reason !== "manual-snapshot") return null;

  return {
    id: makeId(),
    createdAt: nowIso(),
    reason: args.reason,
    label: sanitiseText(args.label, MAX_LABEL_LENGTH) || "Model change",
    note: sanitiseText(args.note ?? "", MAX_NOTE_LENGTH),
    beforeWeights: cloneRuleWeights(args.beforeWeights),
    afterWeights: cloneRuleWeights(args.afterWeights),
    changedKeys,
  };
}

export function appendModelChangeLogEntry(
  entries: ModelChangeLogEntry[],
  entry: ModelChangeLogEntry | null,
): ModelChangeLogEntry[] {
  if (!entry) return cloneModelChangeLog(entries);
  return [entry, ...cloneModelChangeLog(entries)].slice(0, MAX_LOG_ENTRIES);
}

export function cloneModelChangeLog(entries: ModelChangeLogEntry[]): ModelChangeLogEntry[] {
  return entries.map((entry) => ({
    ...entry,
    beforeWeights: cloneRuleWeights(entry.beforeWeights),
    afterWeights: cloneRuleWeights(entry.afterWeights),
    changedKeys: [...entry.changedKeys],
  }));
}

export function isModelChangeLogArray(value: unknown): value is ModelChangeLogEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ModelChangeLogEntry>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.createdAt === "string" &&
      typeof candidate.reason === "string" &&
      typeof candidate.label === "string" &&
      typeof candidate.note === "string" &&
      !!candidate.beforeWeights &&
      typeof candidate.beforeWeights === "object" &&
      !!candidate.afterWeights &&
      typeof candidate.afterWeights === "object" &&
      Array.isArray(candidate.changedKeys)
    );
  });
}

export function summariseModelChangeLog(entries: ModelChangeLogEntry[]): ModelChangeLogSummary {
  const clonedEntries = cloneModelChangeLog(entries).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const changedKeyCounter = new Map<keyof RuleWeights, number>();
  for (const entry of clonedEntries) {
    for (const key of entry.changedKeys) {
      changedKeyCounter.set(key, (changedKeyCounter.get(key) ?? 0) + 1);
    }
  }

  const changedKeyCounts = [...changedKeyCounter.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));

  return {
    totalEntries: clonedEntries.length,
    latestEntry: clonedEntries[0] ?? null,
    sandboxApplications: clonedEntries.filter((entry) => entry.reason === "sandbox-apply").length,
    resets: clonedEntries.filter((entry) => entry.reason === "live-reset").length,
    manualSnapshots: clonedEntries.filter((entry) => entry.reason === "manual-snapshot").length,
    changedKeyCounts,
    recentEntries: clonedEntries.slice(0, 8),
  };
}
