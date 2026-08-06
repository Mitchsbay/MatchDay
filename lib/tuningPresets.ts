import type { RuleWeights } from "./scoringEngine";

export type TuningPreset = {
  id: string;
  name: string;
  description: string;
  weights: RuleWeights;
  createdAt: string;
  updatedAt: string;
};

const MAX_PRESET_NAME_LENGTH = 60;
const MAX_PRESET_DESCRIPTION_LENGTH = 220;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitisePresetName(name: string, fallback = "Untitled preset"): string {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, MAX_PRESET_NAME_LENGTH);
  return trimmed || fallback;
}

export function sanitisePresetDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").slice(0, MAX_PRESET_DESCRIPTION_LENGTH);
}

export function createTuningPreset(args: {
  name: string;
  description?: string;
  weights: RuleWeights;
  existingPresets?: TuningPreset[];
}): TuningPreset {
  const createdAt = nowIso();
  const baseName = sanitisePresetName(args.name);
  const existingNames = new Set((args.existingPresets ?? []).map((preset) => preset.name.toLowerCase()));
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name.toLowerCase())) {
    name = sanitisePresetName(`${baseName} ${suffix}`);
    suffix += 1;
  }

  return {
    id: makeId(),
    name,
    description: sanitisePresetDescription(args.description ?? ""),
    weights: { ...args.weights },
    createdAt,
    updatedAt: createdAt,
  };
}

export function cloneTuningPresets(presets: TuningPreset[]): TuningPreset[] {
  return presets.map((preset) => ({
    ...preset,
    weights: { ...preset.weights },
  }));
}

export function isTuningPresetArray(value: unknown): value is TuningPreset[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<TuningPreset>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.createdAt === "string" &&
      typeof candidate.updatedAt === "string" &&
      !!candidate.weights &&
      typeof candidate.weights === "object"
    );
  });
}

export function updateTuningPreset(args: {
  presets: TuningPreset[];
  presetId: string;
  name?: string;
  description?: string;
  weights?: RuleWeights;
}): TuningPreset[] {
  return args.presets.map((preset) => {
    if (preset.id !== args.presetId) return preset;
    return {
      ...preset,
      name: args.name === undefined ? preset.name : sanitisePresetName(args.name, preset.name),
      description: args.description === undefined ? preset.description : sanitisePresetDescription(args.description),
      weights: args.weights ? { ...args.weights } : { ...preset.weights },
      updatedAt: nowIso(),
    };
  });
}

export function deleteTuningPreset(presets: TuningPreset[], presetId: string): TuningPreset[] {
  return presets.filter((preset) => preset.id !== presetId);
}

export function getPresetWeightChangeCount(preset: TuningPreset, comparisonWeights: RuleWeights): number {
  return (Object.keys(preset.weights) as Array<keyof RuleWeights>).filter(
    (key) => preset.weights[key] !== comparisonWeights[key],
  ).length;
}
