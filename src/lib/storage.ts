import type { Judgement } from "@/lib/rating";

export const RESULTS_KEY = "pjsk-rating-results-v1";

export type BackupFile = {
  version: 1 | 2;
  results: Record<string, Judgement>;
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

export function saveResults(results: Record<string, Judgement>) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export function makeBackup(results: Record<string, Judgement>): BackupFile {
  return {
    version: 2,
    results,
  };
}

export function parseBackup(raw: string): BackupFile {
  const data = JSON.parse(raw) as BackupFile & { results?: Record<string, Judgement> };
  if (!data || (data.version !== 1 && data.version !== 2)) {
    throw new Error("未対応のバックアップ形式です");
  }
  return {
    version: data.version,
    results: data.results ?? {},
  };
}
