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
