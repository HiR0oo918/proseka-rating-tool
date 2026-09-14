import { DIFFICULTY_LABEL, DIFFICULTY_SOLID } from "@/lib/charts";
import { formatPercent, formatRating, type Difficulty } from "@/lib/rating";

export type BestImageRow = {
  title: string;
  difficulty: Difficulty;
  playLevel: number;
  constant: number;
  achievement: number;
  rating: number;
  jacketAsset: string;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadJacket(asset: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `/api/jacket/${encodeURIComponent(asset)}`;
  });
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

export async function renderBestImage(opts: {
  poolLabel: string;
  average: number;
  cap: number;
  rows: BestImageRow[];
}): Promise<Blob> {
  const cols = opts.cap <= 20 ? 5 : 6;
  const rowsCount = Math.ceil(opts.cap / cols);
  const cell = 172;
  const gap = 12;
  const pad = 36;
  const header = 118;
  const width = pad * 2 + cols * cell + (cols - 1) * gap;
  const height = pad + header + rowsCount * (cell + 52) + (rowsCount - 1) * gap + pad;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("キャンバスを初期化できませんでした");
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#1b1428");
  bg.addColorStop(1, "#2a1a38");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px 'Noto Sans JP', sans-serif";
  ctx.fillText("プロセカレーティング", pad, pad + 28);
  ctx.font = "600 18px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "#d8c8e8";
  ctx.fillText(opts.poolLabel, pad, pad + 56);

  ctx.font = "700 42px ui-monospace, monospace";
  ctx.fillStyle = "#ffffff";
  const ratingText = formatRating(opts.average);
  ctx.fillText(ratingText, pad, pad + 104);
  const ratingWidth = ctx.measureText(ratingText).width;
  ctx.font = "500 16px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "#b8a8c8";
  ctx.fillText(
    `${opts.rows.length} / ${opts.cap} 譜面`,
    pad + ratingWidth + 16,
    pad + 98,
  );

  const jackets = await Promise.all(
    opts.rows.map((row) => loadJacket(row.jacketAsset)),
  );

  const slots = Array.from({ length: opts.cap }, (_, i) => opts.rows[i] ?? null);

  slots.forEach((row, i) => {
    const col = i % cols;
    const r = Math.floor(i / cols);
    const x = pad + col * (cell + gap);
    const y = pad + header + r * (cell + 52 + gap);

    roundRect(ctx, x, y, cell, cell, 14);
    ctx.fillStyle = "#3a2a48";
    ctx.fill();

    const jacket = row ? jackets[i] : null;
    ctx.save();
    roundRect(ctx, x, y, cell, cell, 14);
    ctx.clip();
    if (jacket) {
      ctx.drawImage(jacket, x, y, cell, cell);
    } else {
      ctx.fillStyle = "#4a3a58";
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = "#8a7a98";
      ctx.font = "600 14px 'Noto Sans JP', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(row ? "NO JACKET" : "EMPTY", x + cell / 2, y + cell / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    const badgeH = 22;
    roundRect(ctx, x + 8, y + 8, 78, badgeH, 11);
    ctx.fillStyle = row
      ? DIFFICULTY_SOLID[row.difficulty]
      : "#6a5a78";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 11px 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      row ? `${DIFFICULTY_LABEL[row.difficulty]} ${row.playLevel}` : `${i + 1}`,
      x + 47,
      y + 23,
    );
    ctx.textAlign = "left";

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 13px 'Noto Sans JP', sans-serif";
    const name = row ? truncate(ctx, row.title, cell) : "—";
    ctx.fillText(name, x, y + cell + 18);
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillStyle = "#e8d8f8";
    ctx.fillText(
      row
        ? `#${i + 1}  ${formatRating(row.rating)}  ${formatPercent(row.achievement)}`
        : `#${i + 1}`,
      x,
      y + cell + 38,
    );
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("画像の生成に失敗しました"));
        else resolve(blob);
      },
      "image/png",
    );
  });
}
