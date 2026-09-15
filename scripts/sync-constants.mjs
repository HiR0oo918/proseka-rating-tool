#!/usr/bin/env node
/**
 * 定数入力用リストの発行と、入力結果のカタログ反映。
 *
 *   node scripts/sync-constants.mjs list
 *   node scripts/sync-constants.mjs apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chartsCsvPath = join(root, "data/charts.csv");
const publicCsvPath = join(root, "public/data/charts.csv");
const chartsJsonPath = join(root, "src/data/charts.json");
const masterCsvPath = join(root, "data/constants-master-below.csv");
const appendCsvPath = join(root, "data/constants-append.csv");
const listMdPath = join(root, "data/constants-by-level.md");

const DIFF_LABEL = {
  hard: "HARD",
  expert: "EXPERT",
  master: "MASTER",
  append: "APPEND",
};
const DIFF_ORDER = { master: 0, expert: 1, hard: 2, append: 3 };

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function csvField(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function loadCatalog() {
  const buf = readFileSync(chartsCsvPath);
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const nl = buf.includes(0x0d) ? "\r\n" : "\n";
  const text = buf.toString("utf8");
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
  const rows = parseCsv(text);
  return { rows, hasBom, nl, header };
}

function sortCharts(rows) {
  return [...rows].sort((a, b) => {
    const lv = Number(b.play_level) - Number(a.play_level);
    if (lv) return lv;
    const d = (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9);
    if (d) return d;
    return a.title.localeCompare(b.title, "ja");
  });
}

function worksheetLines(rows) {
  const header = "chart_id,difficulty,play_level,title,chart_constant";
  const body = rows.map((r) =>
    [r.chart_id, r.difficulty, r.play_level, csvField(r.title), r.chart_constant ?? ""].join(","),
  );
  return [header, ...body].join("\n") + "\n";
}

function writeUtf8(path, text) {
  writeFileSync(path, text, "utf8");
}

function emitMarkdown(master, append) {
  const section = (title, rows) => {
    const lines = [`## ${title}`, ""];
    let lastLv = null;
    for (const r of rows) {
      const lv = r.play_level;
      if (lv !== lastLv) {
        if (lastLv !== null) lines.push("");
        lines.push(`### Lv.${lv}`, "");
        lastLv = lv;
      }
      const c = r.chart_constant ? r.chart_constant : "（未設定 → 仮 " + `${lv}.5）`;
      lines.push(
        `- ${DIFF_LABEL[r.difficulty] ?? r.difficulty} ${r.title} \`${c}\`  \`${r.chart_id}\``,
      );
    }
    lines.push("");
    return lines.join("\n");
  };

  return [
    "# 定数入力用譜面リスト（レベル高い順）",
    "",
    "カタログから自動生成しています。定数は `chart_constant` に公式レベル.小数1桁で入れてください。",
    "",
    "入力用 CSV:",
    "",
    "- [constants-master-below.csv](constants-master-below.csv) … MASTER以下",
    "- [constants-append.csv](constants-append.csv) … APPEND",
    "",
    "CSV を埋めたら `npm run constants:apply` で `charts.csv` と `charts.json` に反映します。",
    "",
    section("MASTER以下", master),
    section("APPEND", append),
  ].join("\n");
}

function cmdList() {
  const { rows } = loadCatalog();
  const master = sortCharts(rows.filter((r) => r.difficulty !== "append"));
  const append = sortCharts(rows.filter((r) => r.difficulty === "append"));
  writeUtf8(masterCsvPath, worksheetLines(master));
  writeUtf8(appendCsvPath, worksheetLines(append));
  writeUtf8(listMdPath, emitMarkdown(master, append));
  console.log(
    `wrote ${master.length} MASTER以下 + ${append.length} APPEND → data/constants-*.csv, data/constants-by-level.md`,
  );
}

function cmdApply() {
  const { rows, hasBom, nl, header } = loadCatalog();
  const updates = new Map();
  for (const path of [masterCsvPath, appendCsvPath]) {
    for (const r of parseCsv(readFileSync(path, "utf8"))) {
      const id = r.chart_id;
      const raw = (r.chart_constant ?? "").trim();
      if (!id) continue;
      updates.set(id, raw);
    }
  }

  let filled = 0;
  for (const r of rows) {
    if (!updates.has(r.chart_id)) continue;
    const raw = updates.get(r.chart_id);
    if (raw === "") {
      r.chart_constant = "";
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`不正な定数: chart_id=${r.chart_id} value=${raw}`);
    }
    if (Math.abs(n * 10 - Math.round(n * 10)) > Number.EPSILON * 10) {
      throw new Error(`定数は小数1桁まで: chart_id=${r.chart_id} value=${raw}`);
    }
    const level = Number(r.play_level);
    const digit = Math.round(n * 10) % 10;
    r.chart_constant = (level + digit / 10).toFixed(1);
    filled += 1;
  }

  const headerCols = header.split(",");
  const csvBody = [
    header,
    ...rows.map((r) => headerCols.map((h) => csvField(r[h] ?? "")).join(",")),
  ].join(nl);
  const csvOut = (hasBom ? "\uFEFF" : "") + csvBody + nl;
  writeFileSync(chartsCsvPath, csvOut);
  writeFileSync(publicCsvPath, csvOut);

  const json = JSON.parse(readFileSync(chartsJsonPath, "utf8"));
  const byId = new Map(rows.map((r) => [Number(r.chart_id), r]));
  for (const chart of json) {
    const src = byId.get(chart.chartId);
    if (!src) continue;
    const raw = src.chart_constant;
    chart.chartConstant = raw === "" ? null : Number(raw);
  }
  writeFileSync(chartsJsonPath, JSON.stringify(json), "utf8");
  console.log(`applied constants (${filled} set) to charts.csv / charts.json`);
}

const cmd = process.argv[2];
if (cmd === "list") cmdList();
else if (cmd === "apply") cmdApply();
else {
  console.error("usage: node scripts/sync-constants.mjs <list|apply>");
  process.exit(1);
}
