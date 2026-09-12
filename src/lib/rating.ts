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

export type RatingPointMode = "absolute" | "offset";

export type RatingPoint = {
  percent: number;
  mode: RatingPointMode;
  value: number;
};

/** 達成率%に対する単曲レート。absolute は固定値、offset は 定数+value。 */
export const DEFAULT_RATING_POINTS: RatingPoint[] = [
  { percent: 0, mode: "absolute", value: 0 },
  { percent: 95, mode: "offset", value: -3.5 },
  { percent: 97, mode: "offset", value: -1.5 },
  { percent: 98.5, mode: "offset", value: 0 },
  { percent: 99, mode: "offset", value: 1 },
  { percent: 99.5, mode: "offset", value: 2.5 },
  { percent: 100, mode: "offset", value: 3 },
];

export type JudgementWeights = {
  perfect: number;
  great: number;
  good: number;
  bad: number;
  miss: number;
};

export const DEFAULT_JUDGEMENT_WEIGHTS: JudgementWeights = {
  perfect: 100,
  great: 80,
  good: 50,
  bad: 10,
  miss: 0,
};

export function normalizeJudgementWeights(
  weights: Partial<JudgementWeights> | undefined,
): JudgementWeights {
  const pick = (key: keyof JudgementWeights) => {
    const n = weights?.[key];
    return Number.isFinite(n) ? Number(n) : DEFAULT_JUDGEMENT_WEIGHTS[key];
  };
  return {
    perfect: pick("perfect"),
    great: pick("great"),
    good: pick("good"),
    bad: pick("bad"),
    miss: pick("miss"),
  };
}

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

/** 各ノーツ均等。分母は PERFECT 重み×総ノーツ。上限 100%。 */
export function scoreJudgement(
  notes: number,
  judgement: Judgement,
  weights: JudgementWeights = DEFAULT_JUDGEMENT_WEIGHTS,
) {
  const w = normalizeJudgementWeights(weights);
  const j = clampJudgement(notes, judgement);
  const perfect = perfectCount(notes, j);
  const score =
    w.perfect * perfect +
    w.great * j.great +
    w.good * j.good +
    w.bad * j.bad +
    w.miss * j.miss;
  const maxScore = w.perfect * notes;
  const achievement =
    maxScore === 0 ? 0 : Math.min(1, Math.max(0, score / maxScore));
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

export function normalizeRatingPoints(points: RatingPoint[]): RatingPoint[] {
  const cleaned = points
    .filter(
      (p) =>
        Number.isFinite(p.percent) &&
        Number.isFinite(p.value) &&
        (p.mode === "absolute" || p.mode === "offset"),
    )
    .map((p) => ({
      percent: Math.min(100, Math.max(0, p.percent)),
      mode: p.mode,
      value: p.value,
    }))
    .sort((a, b) => a.percent - b.percent);
  const unique = new Map<number, RatingPoint>();
  for (const p of cleaned) unique.set(p.percent, p);
  const next = [...unique.values()].sort((a, b) => a.percent - b.percent);
  return next.length > 0 ? next : DEFAULT_RATING_POINTS;
}

function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  if (x1 === x0) return y1;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

function pointRating(constant: number, point: RatingPoint): number {
  return point.mode === "absolute" ? point.value : constant + point.value;
}

export function singleRating(
  constant: number,
  achievement: number,
  points: RatingPoint[] = DEFAULT_RATING_POINTS,
): number {
  const pts = normalizeRatingPoints(points);
  const x = Math.min(1, Math.max(0, achievement)) * 100;
  const xs = pts.map((p) => p.percent);
  const ys = pts.map((p) => pointRating(constant, p));
  if (x <= xs[0]) {
    if (xs[0] === 0) return ys[0];
    return lerp(0, 0, xs[0], ys[0], x);
  }
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  for (let i = 0; i < last; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      return lerp(xs[i], ys[i], xs[i + 1], ys[i + 1], x);
    }
  }
  return ys[last];
}

export function describeRatingPoint(point: RatingPoint): string {
  if (point.mode === "absolute") return String(point.value);
  const sign = point.value > 0 ? "+" : "";
  return `定数${sign}${point.value}`;
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
