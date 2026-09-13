import raw from "@/data/charts.json";
import type { Chart, Difficulty } from "@/lib/rating";

export const charts: Chart[] = (raw as Chart[]).map((c) => ({
  ...c,
  difficulty: c.difficulty as Difficulty,
}));

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  expert: "EXPERT",
  master: "MASTER",
  append: "APPEND",
};

/** アプリ内の難易度ボタンに近い色。APPEND は虹色グラデーション。 */
export const DIFFICULTY_BG: Record<Difficulty, string> = {
  easy: "#66DD11",
  normal: "#33BBEE",
  hard: "#FEAA00",
  expert: "#EE4366",
  master: "#BB33EE",
  append:
    "linear-gradient(90deg, #FF7AD2 0%, #7AD7FF 48%, #FFE27A 100%)",
};
