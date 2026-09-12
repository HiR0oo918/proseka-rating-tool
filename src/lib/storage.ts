import {
  DEFAULT_APPEND_BEST,
  DEFAULT_JUDGEMENT_WEIGHTS,
  DEFAULT_OTHER_BEST,
  DEFAULT_RATING_POINTS,
  normalizeJudgementWeights,
  type Judgement,
  type JudgementWeights,
  type RatingPoint,
} from "@/lib/rating";

export const RESULTS_KEY = "pjsk-rating-results-v1";
export const CONSTANTS_KEY = "pjsk-rating-constants-v1";
export const SETTINGS_KEY = "pjsk-rating-settings-v1";

export type Settings = {
  otherBestCount: number;
  appendBestCount: number;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
};

export type BackupFile = {
  version: 1;
  settings: Settings;
  results: Record<string, Judgement>;
  constants: Record<string, number>;
};

export const DEFAULT_SETTINGS: Settings = {
  otherBestCount: DEFAULT_OTHER_BEST,
  appendBestCount: DEFAULT_APPEND_BEST,
  ratingPoints: DEFAULT_RATING_POINTS,
  judgementWeights: DEFAULT_JUDGEMENT_WEIGHTS,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadResults(): Record<string, Judgement> {
  return readJson(RESULTS_KEY, {});
}

export function loadConstants(): Record<string, number> {
  return readJson(CONSTANTS_KEY, {});
}

function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const points = Array.isArray(s?.ratingPoints)
    ? s.ratingPoints.filter(
        (p) =>
          p &&
          Number.isFinite(p.percent) &&
          Number.isFinite(p.value) &&
          (p.mode === "absolute" || p.mode === "offset"),
      )
    : [];
  return {
    otherBestCount: Math.max(1, s?.otherBestCount ?? DEFAULT_OTHER_BEST),
    appendBestCount: Math.max(1, s?.appendBestCount ?? DEFAULT_APPEND_BEST),
    ratingPoints: points.length > 0 ? points : DEFAULT_RATING_POINTS,
    judgementWeights: normalizeJudgementWeights(s?.judgementWeights),
  };
}

export function loadSettings(): Settings {
  return normalizeSettings(readJson<Partial<Settings>>(SETTINGS_KEY, {}));
}

export function saveResults(results: Record<string, Judgement>) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export function saveConstants(constants: Record<string, number>) {
  localStorage.setItem(CONSTANTS_KEY, JSON.stringify(constants));
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function makeBackup(
  settings: Settings,
  results: Record<string, Judgement>,
  constants: Record<string, number>,
): BackupFile {
  return { version: 1, settings: normalizeSettings(settings), results, constants };
}

export function parseBackup(raw: string): BackupFile {
  const data = JSON.parse(raw) as BackupFile;
  if (!data || data.version !== 1) {
    throw new Error("未対応のバックアップ形式です");
  }
  return {
    version: 1,
    settings: normalizeSettings(data.settings),
    results: data.results ?? {},
    constants: data.constants ?? {},
  };
}
