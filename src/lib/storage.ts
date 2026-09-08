import {
  DEFAULT_APPEND_BEST,
  DEFAULT_OTHER_BEST,
  type Judgement,
} from "@/lib/rating";

export const RESULTS_KEY = "pjsk-rating-results-v1";
export const CONSTANTS_KEY = "pjsk-rating-constants-v1";
export const SETTINGS_KEY = "pjsk-rating-settings-v1";

export type Settings = {
  otherBestCount: number;
  appendBestCount: number;
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

export function loadSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    otherBestCount: Math.max(1, s.otherBestCount ?? DEFAULT_OTHER_BEST),
    appendBestCount: Math.max(1, s.appendBestCount ?? DEFAULT_APPEND_BEST),
  };
}

export function saveResults(results: Record<string, Judgement>) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export function saveConstants(constants: Record<string, number>) {
  localStorage.setItem(CONSTANTS_KEY, JSON.stringify(constants));
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function makeBackup(
  settings: Settings,
  results: Record<string, Judgement>,
  constants: Record<string, number>,
): BackupFile {
  return { version: 1, settings, results, constants };
}

export function parseBackup(raw: string): BackupFile {
  const data = JSON.parse(raw) as BackupFile;
  if (!data || data.version !== 1) {
    throw new Error("未対応のバックアップ形式です");
  }
  return {
    version: 1,
    settings: {
      otherBestCount: Math.max(
        1,
        data.settings?.otherBestCount ?? DEFAULT_OTHER_BEST,
      ),
      appendBestCount: Math.max(
        1,
        data.settings?.appendBestCount ?? DEFAULT_APPEND_BEST,
      ),
    },
    results: data.results ?? {},
    constants: data.constants ?? {},
  };
}
