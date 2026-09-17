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
  jacketAsset: string;
};

/** MASTER 37 はゲーム上 MASTER だが、レートは APPEND 枠に入れる。 */
export const APPEND_POOL_MASTER_LEVEL = 37;

export function isAppendPool(
  chart: Pick<Chart, "difficulty" | "playLevel">,
): boolean {
  return (
    chart.difficulty === "append" ||
    (chart.difficulty === "master" &&
      chart.playLevel >= APPEND_POOL_MASTER_LEVEL)
  );
}
