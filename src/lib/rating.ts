export type Difficulty =
  | "easy"
  | "normal"
  | "hard"
  | "expert"
  | "master"
  | "append";

export type Chart = {
  chartId: number;
  musicId: number;
  title: string;
  pronunciation: string;
  difficulty: Difficulty;
  playLevel: number;
  chartConstant: number | null;
  totalNoteCount: number;
  publishedAt: string;
};

export type Judgement = {
  great: number;
  good: number;
  bad: number;
  miss: number;
};

export type ConstantSource = "override" | "csv" | "level";

export const DEFAULT_OTHER_BEST = 30;
export const DEFAULT_APPEND_BEST = 20;

export const EMPTY_JUDGEMENT: Judgement = {
  great: 0,
  good: 0,
  bad: 0,
  miss: 0,
};

export function clampJudgement(
  notes: number,
  judgement: Judgement,
): Judgement {
  const next: Judgement = {
    great: Math.max(0, Math.floor(judgement.great) || 0),
    good: Math.max(0, Math.floor(judgement.good) || 0),
    bad: Math.max(0, Math.floor(judgement.bad) || 0),
    miss: Math.max(0, Math.floor(judgement.miss) || 0),
  };
  let used = next.great + next.good + next.bad + next.miss;
  if (used <= notes) return next;
  const order: (keyof Judgement)[] = ["miss", "bad", "good", "great"];
  for (const key of order) {
    const overflow = used - notes;
    if (overflow <= 0) break;
    const cut = Math.min(next[key], overflow);
    next[key] -= cut;
    used -= cut;
  }
  return next;
}

export function perfectCount(notes: number, judgement: Judgement): number {
  const j = clampJudgement(notes, judgement);
  return Math.max(0, notes - j.great - j.good - j.bad - j.miss);
}

export function isFullCombo(notes: number, judgement: Judgement): boolean {
  const j = clampJudgement(notes, judgement);
  return j.good === 0 && j.bad === 0 && j.miss === 0 && notes > 0;
}

export function isAllPerfect(notes: number, judgement: Judgement): boolean {
  return isFullCombo(notes, judgement) && judgement.great === 0 && notes > 0;
}

/** ランクマッチ: PERFECT 3 / GREAT 2 / GOOD 1 / BAD・MISS 0。各ノーツ均等。 */
export function rankMatch(notes: number, judgement: Judgement) {
  const j = clampJudgement(notes, judgement);
  const perfect = perfectCount(notes, j);
  const score = 3 * perfect + 2 * j.great + 1 * j.good;
  const maxScore = 3 * notes;
  const achievement = maxScore === 0 ? 0 : score / maxScore;
  return { perfect, score, maxScore, achievement };
}

export function effectiveConstant(
  chart: Chart,
  override: number | null | undefined,
): { value: number; source: ConstantSource } {
  if (override != null && Number.isFinite(override)) {
    return { value: override, source: "override" };
  }
  if (chart.chartConstant != null && Number.isFinite(chart.chartConstant)) {
    return { value: chart.chartConstant, source: "csv" };
  }
  return { value: chart.playLevel, source: "level" };
}

export function singleRating(constant: number, achievement: number): number {
  return constant * achievement;
}

export function bestAverage(values: number[], bestCount: number) {
  const n = Math.max(1, Math.floor(bestCount) || 1);
  const top = [...values].sort((a, b) => b - a).slice(0, n);
  if (top.length === 0) {
    return { average: 0, used: 0, cap: n };
  }
  const sum = top.reduce((a, b) => a + b, 0);
  return { average: sum / top.length, used: top.length, cap: n };
}

export function formatRating(value: number): string {
  return value.toFixed(3);
}

export function formatPercent(achievement: number): string {
  return `${(achievement * 100).toFixed(2)}%`;
}
