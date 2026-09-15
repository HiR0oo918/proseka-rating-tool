#!/usr/bin/env python3
"""MASTER定数: スプレッドシート定数(A) と Wiki判定(B) を合成してカタログへ反映する。"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "data/sources/mas-sheet.csv"
WIKI = ROOT / "data/sources/mas-wiki.txt"
CHARTS_CSV = ROOT / "data/charts.csv"
CHARTS_JSON = ROOT / "src/data/charts.json"
MASTER_WS = ROOT / "data/constants-master-below.csv"
REPORT = ROOT / "data/constants-mas-merge-report.csv"

# B 判定 → 小数レンジ（両端含む）と平均用の代表値
B_RANGE = {
    "最下位－": (0.0, 0.0, 0.0),
    "最下位": (0.0, 0.2, 0.1),
    "下位": (0.2, 0.4, 0.3),
    "適正": (0.4, 0.6, 0.5),
    "上位": (0.6, 0.8, 0.7),
    "最上位": (0.8, 0.9, 0.85),
    "最上位＋": (0.9, 0.9, 0.9),
}

LABELS = tuple(sorted(B_RANGE.keys(), key=len, reverse=True))


def norm_title(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("攻略情報あり", "")
    s = re.sub(r"\s+", "", s)
    s = s.replace("〜", "~").replace("～", "~")
    return s.casefold()


def round1(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def snap(level: int, value: float) -> float:
    digit = int(round1(value) * 10) % 10
    return level + digit / 10


def parse_sheet(path: Path) -> dict[str, float]:
    rows = list(csv.reader(path.open(encoding="utf-8")))
    out: dict[str, float] = {}
    for r in rows[1:]:
        if len(r) < 8:
            continue
        title = r[2].strip()
        const = r[7].strip()
        m = re.match(r"(\d+\.\d+)", const)
        if not title or not m:
            continue
        out[norm_title(title)] = float(m.group(1))
    return out


def parse_wiki(path: Path) -> dict[tuple[str, int], str]:
    text = path.read_text(encoding="utf-8")
    stop = text.find("#### 難易度評価・議論ページ一覧")
    if stop != -1:
        text = text[:stop]
    level = None
    out: dict[tuple[str, int], str] = {}
    for line in text.splitlines():
        m = re.match(r"#### Lv\.(\d+)", line)
        if m:
            level = int(m.group(1))
            continue
        if level is None or not line.startswith("|"):
            continue
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cols) < 2 or cols[0] in {"曲名", "---"} or set(cols[1]) <= {"-"}:
            continue
        title = cols[0]
        judge_cell = cols[1]
        if judge_cell.startswith("-"):
            continue
        label = None
        for lab in LABELS:
            if judge_cell.startswith(lab):
                label = lab
                break
        if not label:
            continue
        out[(norm_title(title), level)] = label
    return out


def load_masters() -> list[dict]:
    text = CHARTS_CSV.read_text(encoding="utf-8-sig")
    rows = list(csv.DictReader(text.splitlines()))
    return [r for r in rows if r["difficulty"] == "master"]


def combine(a: float | None, b_label: str | None, level: int) -> tuple[float | None, str]:
    if a is None and b_label is None:
        return None, "none"
    if b_label is None:
        return snap(level, a), "A-only"
    lo, hi, mid = B_RANGE[b_label]
    b_val = level + mid
    if a is None:
        return snap(level, b_val), "B-only"
    frac = round1(a - int(a))  # 0.0-0.9 from A's displayed decimal
    # use actual tenths of snapped A relative to official level
    a_digit = int(round1(a) * 10) % 10
    frac = a_digit / 10
    if lo - 1e-9 <= frac <= hi + 1e-9:
        return snap(level, a), "match"
    avg = (snap(level, a) + b_val) / 2
    return snap(level, round1(avg)), "avg"


def main() -> None:
    sheet = parse_sheet(SHEET)
    wiki = parse_wiki(WIKI)
    masters = load_masters()
    wiki_by_title: dict[str, list[tuple[int, str]]] = {}
    for (t, lv), lab in wiki.items():
        wiki_by_title.setdefault(t, []).append((lv, lab))

    report = []
    updates: dict[str, str] = {}
    stats = {"match": 0, "avg": 0, "A-only": 0, "B-only": 0, "none": 0}

    for r in masters:
        cid = r["chart_id"]
        title = r["title"]
        level = int(r["play_level"])
        key = norm_title(title)
        a = sheet.get(key)
        b = wiki.get((key, level))
        if b is None:
            cands = wiki_by_title.get(key, [])
            if len(cands) == 1:
                b = cands[0][1]
        final, how = combine(a, b, level)
        stats[how] += 1
        const = "" if final is None else f"{final:.1f}"
        updates[cid] = const
        report.append(
            {
                "chart_id": cid,
                "title": title,
                "play_level": level,
                "A": "" if a is None else f"{a:.1f}",
                "B": b or "",
                "result": const,
                "how": how,
            }
        )

    # write worksheet master rows
    ws = list(csv.DictReader(MASTER_WS.open(encoding="utf-8")))
    for row in ws:
        if row["difficulty"] == "master":
            row["chart_constant"] = updates.get(row["chart_id"], row["chart_constant"])
    with MASTER_WS.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["chart_id", "difficulty", "play_level", "title", "chart_constant"],
        )
        w.writeheader()
        w.writerows(ws)

    with REPORT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["chart_id", "title", "play_level", "A", "B", "result", "how"],
        )
        w.writeheader()
        w.writerows(report)

    print("masters", len(masters))
    print("sheet titles", len(sheet), "wiki", len(wiki))
    print(stats)
    print("filled", sum(1 for v in updates.values() if v))
    unmatched_a = [t for t in sheet if t not in {norm_title(r["title"]) for r in masters}]
    print("sheet not in catalog", len(unmatched_a))
    for t in unmatched_a[:15]:
        print("  A extra", t)


if __name__ == "__main__":
    main()
