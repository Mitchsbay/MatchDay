import { PersistedAppState } from "./workspace";
import {
  WorkspacePreservationMetrics,
  describeWorkspaceMetrics,
  getWorkspacePreservationMetrics,
} from "./workspacePreservation";

export const WORKSPACE_BACKUP_VAULT_KEY = "tipping-gates-app-workspace-recovery-vault-v1";
export const MAX_AUTOMATIC_RECOVERY_SNAPSHOTS = 10;

export type WorkspaceRecoverySnapshotReason =
  | "automatic"
  | "manual"
  | "pre-reset"
  | "pre-import"
  | "pre-cloud-restore";

export type WorkspaceRecoverySnapshot = {
  id: string;
  label: string;
  reason: WorkspaceRecoverySnapshotReason;
  createdAt: string;
  state: PersistedAppState;
  metrics: WorkspacePreservationMetrics;
};

export type WorkspaceRecoveryVaultSummary = {
  snapshotCount: number;
  automaticCount: number;
  manualCount: number;
  latestSnapshotAt: string | null;
  richestSnapshotId: string | null;
  richestSnapshotLabel: string | null;
  richestSnapshotDescription: string;
};

export function isWorkspaceRecoverySnapshot(value: unknown): value is WorkspaceRecoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceRecoverySnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.createdAt === "string" &&
    !!candidate.state &&
    typeof candidate.state === "object" &&
    Array.isArray(candidate.state.fixtures)
  );
}

export function parseWorkspaceRecoveryVault(raw: string | null): WorkspaceRecoverySnapshot[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkspaceRecoverySnapshot).map((snapshot) => ({
      ...snapshot,
      metrics: getWorkspacePreservationMetrics(snapshot.state),
    }));
  } catch {
    return [];
  }
}

function makeSnapshotId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkspaceRecoverySnapshot(
  state: PersistedAppState,
  label: string,
  reason: WorkspaceRecoverySnapshotReason,
): WorkspaceRecoverySnapshot {
  return {
    id: makeSnapshotId(),
    label: label.trim() || "Workspace recovery snapshot",
    reason,
    createdAt: new Date().toISOString(),
    state,
    metrics: getWorkspacePreservationMetrics(state),
  };
}

function snapshotShapeSignature(snapshot: WorkspaceRecoverySnapshot): string {
  const metrics = snapshot.metrics;
  const competitions = Array.from(
    new Set(snapshot.state.fixtures.map((fixture) => fixture.competition.trim()).filter(Boolean)),
  )
    .sort()
    .join("|");
  return [
    metrics.fixtureCount,
    metrics.competitionCount,
    metrics.finalFixtureCount,
    metrics.aliasCount,
    metrics.tuningPresetCount,
    metrics.modelChangeLogCount,
    competitions,
  ].join("::");
}

export function pruneWorkspaceRecoveryVault(snapshots: WorkspaceRecoverySnapshot[]): WorkspaceRecoverySnapshot[] {
  const newestFirst = [...snapshots].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const seenSignatures = new Set<string>();
  const deduped = newestFirst.filter((snapshot) => {
    const signature = `${snapshot.reason}-${snapshotShapeSignature(snapshot)}`;
    if (seenSignatures.has(signature)) return false;
    seenSignatures.add(signature);
    return true;
  });

  const automatic = deduped.filter((snapshot) => snapshot.reason === "automatic").slice(0, MAX_AUTOMATIC_RECOVERY_SNAPSHOTS);
  const protectedSnapshots = deduped.filter((snapshot) => snapshot.reason !== "automatic");
  return [...protectedSnapshots, ...automatic].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function addWorkspaceRecoverySnapshot(
  snapshots: WorkspaceRecoverySnapshot[],
  snapshot: WorkspaceRecoverySnapshot,
): WorkspaceRecoverySnapshot[] {
  return pruneWorkspaceRecoveryVault([snapshot, ...snapshots]);
}

export function shouldCreateAutomaticWorkspaceSnapshot(
  snapshots: WorkspaceRecoverySnapshot[],
  nextState: PersistedAppState,
): boolean {
  const nextSnapshot = createWorkspaceRecoverySnapshot(nextState, "Automatic recovery point", "automatic");
  const latestAutomatic = snapshots.find((snapshot) => snapshot.reason === "automatic");
  if (!latestAutomatic) return nextState.fixtures.length > 0;
  return snapshotShapeSignature(latestAutomatic) !== snapshotShapeSignature(nextSnapshot);
}

export function summariseWorkspaceRecoveryVault(
  snapshots: WorkspaceRecoverySnapshot[],
): WorkspaceRecoveryVaultSummary {
  const latest = [...snapshots].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
  const richest = [...snapshots].sort((a, b) => b.metrics.richnessScore - a.metrics.richnessScore)[0] ?? null;
  return {
    snapshotCount: snapshots.length,
    automaticCount: snapshots.filter((snapshot) => snapshot.reason === "automatic").length,
    manualCount: snapshots.filter((snapshot) => snapshot.reason !== "automatic").length,
    latestSnapshotAt: latest?.createdAt ?? null,
    richestSnapshotId: richest?.id ?? null,
    richestSnapshotLabel: richest?.label ?? null,
    richestSnapshotDescription: richest ? describeWorkspaceMetrics(richest.metrics) : "No recovery snapshots saved yet.",
  };
}
