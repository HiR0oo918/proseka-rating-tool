"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { charts, DIFFICULTY_LABEL } from "@/lib/charts";
import {
  bestAverage,
  clampJudgement,
  effectiveConstant,
  EMPTY_JUDGEMENT,
  formatPercent,
  formatRating,
  isAllPerfect,
  isFullCombo,
  rankMatch,
  singleRating,
  type Chart,
  type Difficulty,
  type Judgement,
} from "@/lib/rating";
import {
  loadConstants,
  loadResults,
  loadSettings,
  makeBackup,
  parseBackup,
  saveConstants,
  saveResults,
  saveSettings,
  type Settings,
} from "@/lib/storage";

type DiffFilter = "all" | Difficulty;
type SortKey = "title" | "level" | "rating";

const PAGE_SIZE = 40;

const DIFF_CLASS: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-900",
  normal: "bg-sky-100 text-sky-900",
  hard: "bg-lime-100 text-lime-900",
  expert: "bg-amber-100 text-amber-950",
  master: "bg-rose-100 text-rose-900",
  append: "bg-violet-100 text-violet-900",
};

function matchesQuery(chart: Chart, query: string): boolean {
  if (!query) return true;
  const q = query.normalize("NFKC").toLowerCase();
  return (
    chart.title.normalize("NFKC").toLowerCase().includes(q) ||
    chart.pronunciation.normalize("NFKC").toLowerCase().includes(q)
  );
}

function IntInput({
  value,
  onCommit,
  "aria-label": ariaLabel,
}: {
  value: number;
  onCommit: (value: number) => void;
  "aria-label": string;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      inputMode="numeric"
      className="h-8 w-14 px-1.5 text-center tabular-nums md:text-sm"
      value={Number.isFinite(value) ? String(value) : "0"}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onCommit(0);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) onCommit(Math.floor(n));
      }}
    />
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge className={DIFF_CLASS[difficulty]} variant="secondary">
      {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  );
}

export function RatingApp() {
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<Record<string, Judgement>>({});
  const [constants, setConstants] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [enteredOnly, setEnteredOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- マウント後に localStorage を読む */
    setResults(loadResults());
    setConstants(loadConstants());
    setSettings(loadSettings());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveResults(results);
  }, [results, ready]);

  useEffect(() => {
    if (!ready) return;
    saveConstants(constants);
  }, [constants, ready]);

  useEffect(() => {
    if (!ready) return;
    saveSettings(settings);
  }, [settings, ready]);

  const played = useMemo(() => {
    return charts.flatMap((chart) => {
      const key = String(chart.chartId);
      const judgement = results[key];
      if (!judgement) return [];
      const { value, source } = effectiveConstant(chart, constants[key]);
      const rm = rankMatch(chart.totalNoteCount, judgement);
      return [
        {
          chart,
          judgement,
          source,
          constant: value,
          ...rm,
          rating: singleRating(value, rm.achievement),
        },
      ];
    });
  }, [results, constants]);

  const otherPlayed = played.filter((p) => p.chart.difficulty !== "append");
  const appendPlayed = played.filter((p) => p.chart.difficulty === "append");
  const otherBest = bestAverage(
    otherPlayed.map((p) => p.rating),
    settings.otherBestCount,
  );
  const appendBest = bestAverage(
    appendPlayed.map((p) => p.rating),
    settings.appendBestCount,
  );

  const otherRanked = [...otherPlayed]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, settings.otherBestCount);
  const appendRanked = [...appendPlayed]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, settings.appendBestCount);

  const filtered = useMemo(() => {
    const list = charts.filter((chart) => {
      if (diffFilter !== "all" && chart.difficulty !== diffFilter) return false;
      if (!matchesQuery(chart, query)) return false;
      if (enteredOnly && !results[String(chart.chartId)]) return false;
      return true;
    });
    const ratingOf = (chart: Chart) => {
      const row = played.find((p) => p.chart.chartId === chart.chartId);
      return row?.rating ?? -1;
    };
    list.sort((a, b) => {
      if (sortKey === "level") {
        return b.playLevel - a.playLevel || a.title.localeCompare(b.title, "ja");
      }
      if (sortKey === "rating") {
        return ratingOf(b) - ratingOf(a) || a.title.localeCompare(b.title, "ja");
      }
      return a.title.localeCompare(b.title, "ja") || a.playLevel - b.playLevel;
    });
    return list;
  }, [diffFilter, query, enteredOnly, results, sortKey, played]);

  const shown = filtered.slice(0, visible);

  function upsertJudgement(chart: Chart, patch: Partial<Judgement>) {
    const key = String(chart.chartId);
    const current = results[key] ?? EMPTY_JUDGEMENT;
    const next = clampJudgement(chart.totalNoteCount, { ...current, ...patch });
    setResults((prev) => ({ ...prev, [key]: next }));
  }

  function setAllPerfect(chart: Chart) {
    setResults((prev) => ({
      ...prev,
      [String(chart.chartId)]: { ...EMPTY_JUDGEMENT },
    }));
  }

  function clearChart(chart: Chart) {
    setResults((prev) => {
      const next = { ...prev };
      delete next[String(chart.chartId)];
      return next;
    });
  }

  function setConstant(chart: Chart, raw: string) {
    const key = String(chart.chartId);
    if (raw.trim() === "") {
      setConstants((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setConstants((prev) => ({ ...prev, [key]: n }));
  }

  function exportBackup() {
    const blob = new Blob(
      [JSON.stringify(makeBackup(settings, results, constants), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pjsk-rating-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBackup(String(reader.result));
        setSettings(backup.settings);
        setResults(backup.results);
        setConstants(backup.constants);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : "読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            プロセカレーティング
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            ランクマッチと同じ配点（PERFECT 3 / GREAT 2 / GOOD 1）で達成率を出し、譜面定数×達成率を単曲レートにします。定数が空の譜面は公式レベルを仮置きします。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpDialog />
          <SettingsDialog settings={settings} onChange={setSettings} />
          <Button variant="outline" onClick={exportBackup}>
            書き出し
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            読み込み
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {importError ? (
        <p className="text-sm text-destructive">{importError}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <RatingSummary
          title="その他"
          description={`EXPERT・MASTER・HARD など APPEND 以外の上位 ${settings.otherBestCount} 譜面`}
          average={otherBest.average}
          used={otherBest.used}
          cap={otherBest.cap}
        />
        <RatingSummary
          title="APPEND"
          description={`APPEND 譜面の上位 ${settings.appendBestCount} 譜面`}
          average={appendBest.average}
          used={appendBest.used}
          cap={appendBest.cap}
        />
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">譜面入力</TabsTrigger>
          <TabsTrigger value="best">ベスト内訳</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="search">曲名 / 読み</Label>
              <Input
                id="search"
                placeholder="例: ヒバナ、ひばな"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="diff">難易度</Label>
              <select
                id="diff"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-36"
                value={diffFilter}
                onChange={(e) => {
                  setDiffFilter(e.target.value as DiffFilter);
                  setVisible(PAGE_SIZE);
                }}
              >
                <option value="all">すべて</option>
                <option value="hard">HARD</option>
                <option value="expert">EXPERT</option>
                <option value="master">MASTER</option>
                <option value="append">APPEND</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sort">並び</Label>
              <select
                id="sort"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-40"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="title">曲名</option>
                <option value="level">レベル高い順</option>
                <option value="rating">単曲レート高い順</option>
              </select>
            </div>
            <Button
              variant={enteredOnly ? "default" : "outline"}
              onClick={() => {
                setEnteredOnly((v) => !v);
                setVisible(PAGE_SIZE);
              }}
            >
              {enteredOnly ? "入力済みのみ" : "未入力も含む"}
            </Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="該当する譜面がありません"
              body="検索語や難易度フィルタを変えてください。カタログはレベル 24 以上のみです。"
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {filtered.length} 譜面中 {shown.length} 件を表示。GREAT 以下を入れると PERFECT
                は総ノーツから自動で埋まります。AP は判定をすべて 0 にします。
              </p>
              <div className="space-y-3 md:hidden">
                {shown.map((chart) => (
                  <ChartCard
                    key={chart.chartId}
                    chart={chart}
                    judgement={results[String(chart.chartId)]}
                    constantOverride={constants[String(chart.chartId)]}
                    onJudgement={upsertJudgement}
                    onAp={setAllPerfect}
                    onClear={clearChart}
                    onConstant={setConstant}
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <ChartTable
                  charts={shown}
                  results={results}
                  constants={constants}
                  onJudgement={upsertJudgement}
                  onAp={setAllPerfect}
                  onClear={clearChart}
                  onConstant={setConstant}
                />
              </div>
              {shown.length < filtered.length ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  さらに表示（残り {filtered.length - shown.length}）
                </Button>
              ) : null}
            </>
          )}
        </TabsContent>
        <TabsContent value="best" className="mt-4 space-y-6">
          {played.length === 0 ? (
            <EmptyState
              title="まだリザルトがありません"
              body="譜面入力タブで GREAT 以下を入れるか、AP を押すとここにベスト内訳が出ます。"
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <BestList
                title={`その他 ベスト ${settings.otherBestCount}`}
                rows={otherRanked}
              />
              <BestList
                title={`APPEND ベスト ${settings.appendBestCount}`}
                rows={appendRanked}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RatingSummary({
  title,
  description,
  average,
  used,
  cap,
}: {
  title: string;
  description: string;
  average: number;
  used: number;
  cap: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-mono text-3xl tabular-nums">
          {used === 0 ? "—" : formatRating(average)}
        </CardTitle>
        <CardDescription>
          {description}（{used}/{cap} 譜面）
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function ChartTable({
  charts: rows,
  results,
  constants,
  onJudgement,
  onAp,
  onClear,
  onConstant,
}: {
  charts: Chart[];
  results: Record<string, Judgement>;
  constants: Record<string, number>;
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
  onConstant: (chart: Chart, raw: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>曲</TableHead>
          <TableHead>Lv</TableHead>
          <TableHead>定数</TableHead>
          <TableHead>ノーツ</TableHead>
          <TableHead>P</TableHead>
          <TableHead>G</TableHead>
          <TableHead>GO</TableHead>
          <TableHead>B</TableHead>
          <TableHead>M</TableHead>
          <TableHead>達成率</TableHead>
          <TableHead>単曲</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((chart) => {
          const key = String(chart.chartId);
          const judgement = results[key];
          const stats = judgement
            ? rankMatch(chart.totalNoteCount, judgement)
            : null;
          const { value, source } = effectiveConstant(chart, constants[key]);
          const rating = stats ? singleRating(value, stats.achievement) : null;
          return (
            <TableRow key={chart.chartId}>
              <TableCell>
                <div className="flex min-w-40 flex-col gap-1">
                  <span className="font-medium">{chart.title}</span>
                  <DifficultyBadge difficulty={chart.difficulty} />
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{chart.playLevel}</TableCell>
              <TableCell>
                <Input
                  aria-label={`${chart.title} の譜面定数`}
                  className="h-8 w-16 px-1.5 tabular-nums"
                  placeholder={String(chart.playLevel)}
                  value={
                    constants[key] != null
                      ? String(constants[key])
                      : chart.chartConstant != null
                        ? String(chart.chartConstant)
                        : ""
                  }
                  onChange={(e) => onConstant(chart, e.target.value)}
                />
                {source === "level" && judgement ? (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    仮
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="tabular-nums">
                {chart.totalNoteCount}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {stats ? stats.perfect : "—"}
              </TableCell>
              <TableCell>
                <IntInput
                  aria-label="GREAT"
                  value={judgement?.great ?? 0}
                  onCommit={(great) => onJudgement(chart, { great })}
                />
              </TableCell>
              <TableCell>
                <IntInput
                  aria-label="GOOD"
                  value={judgement?.good ?? 0}
                  onCommit={(good) => onJudgement(chart, { good })}
                />
              </TableCell>
              <TableCell>
                <IntInput
                  aria-label="BAD"
                  value={judgement?.bad ?? 0}
                  onCommit={(bad) => onJudgement(chart, { bad })}
                />
              </TableCell>
              <TableCell>
                <IntInput
                  aria-label="MISS"
                  value={judgement?.miss ?? 0}
                  onCommit={(miss) => onJudgement(chart, { miss })}
                />
              </TableCell>
              <TableCell className="tabular-nums">
                {stats ? formatPercent(stats.achievement) : "—"}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {rating != null ? formatRating(rating) : "—"}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => onAp(chart)}>
                    AP
                  </Button>
                  {judgement ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onClear(chart)}
                    >
                      削除
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ChartCard({
  chart,
  judgement,
  constantOverride,
  onJudgement,
  onAp,
  onClear,
  onConstant,
}: {
  chart: Chart;
  judgement: Judgement | undefined;
  constantOverride: number | undefined;
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
  onConstant: (chart: Chart, raw: string) => void;
}) {
  const stats = judgement
    ? rankMatch(chart.totalNoteCount, judgement)
    : null;
  const { value, source } = effectiveConstant(chart, constantOverride);
  const rating = stats ? singleRating(value, stats.achievement) : null;
  const key = String(chart.chartId);
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>{chart.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1">
              <DifficultyBadge difficulty={chart.difficulty} />
              <span className="text-xs text-muted-foreground">
                Lv.{chart.playLevel} / {chart.totalNoteCount} notes
              </span>
              {judgement && isAllPerfect(chart.totalNoteCount, judgement) ? (
                <Badge>AP</Badge>
              ) : judgement && isFullCombo(chart.totalNoteCount, judgement) ? (
                <Badge variant="secondary">FC</Badge>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg tabular-nums">
              {rating != null ? formatRating(rating) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {stats ? formatPercent(stats.achievement) : "未入力"}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs" htmlFor={`const-${key}`}>
            定数{source === "level" ? "（仮）" : ""}
          </Label>
          <Input
            id={`const-${key}`}
            className="h-8 w-20 tabular-nums"
            placeholder={String(chart.playLevel)}
            value={
              constantOverride != null
                ? String(constantOverride)
                : chart.chartConstant != null
                  ? String(chart.chartConstant)
                  : ""
            }
            onChange={(e) => onConstant(chart, e.target.value)}
          />
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-[11px] text-muted-foreground">
          <span>P {stats ? stats.perfect : "—"}</span>
          <span>GREAT</span>
          <span>GOOD</span>
          <span>BAD</span>
          <span>MISS</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div />
          <IntInput
            aria-label="GREAT"
            value={judgement?.great ?? 0}
            onCommit={(great) => onJudgement(chart, { great })}
          />
          <IntInput
            aria-label="GOOD"
            value={judgement?.good ?? 0}
            onCommit={(good) => onJudgement(chart, { good })}
          />
          <IntInput
            aria-label="BAD"
            value={judgement?.bad ?? 0}
            onCommit={(bad) => onJudgement(chart, { bad })}
          />
          <IntInput
            aria-label="MISS"
            value={judgement?.miss ?? 0}
            onCommit={(miss) => onJudgement(chart, { miss })}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onAp(chart)}>
            AP にする
          </Button>
          {judgement ? (
            <Button size="sm" variant="ghost" onClick={() => onClear(chart)}>
              削除
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BestList({
  title,
  rows,
}: {
  title: string;
  rows: {
    chart: Chart;
    rating: number;
    achievement: number;
    constant: number;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {rows.length === 0
            ? "この枠に入るリザルトはまだありません。"
            : `上位 ${rows.length} 譜面`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.chart.chartId}
              className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span className="font-medium">{row.chart.title}</span>
                <div className="ml-6 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <DifficultyBadge difficulty={row.chart.difficulty} />
                  <span>
                    定数 {row.constant} / {formatPercent(row.achievement)}
                  </span>
                </div>
              </div>
              <span className="font-mono tabular-nums">
                {formatRating(row.rating)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>計算式</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>計算式</DialogTitle>
          <DialogDescription>
            非公式です。ゲーム内のランクマッチ配点だけを借りています。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            PERFECT = 総ノーツ − GREAT − GOOD − BAD − MISS。各ノーツの重みは均等です。
          </p>
          <p className="font-mono text-xs leading-relaxed">
            達成率 = (3×P + 2×GREAT + GOOD) / (3×総ノーツ)
            <br />
            単曲レート = 譜面定数 × 達成率
            <br />
            その他レート = 上位 N 譜面の平均（初期 30）
            <br />
            APPEND レート = 上位 M 譜面の平均（初期 20）
          </p>
          <p className="text-muted-foreground">
            CSV の定数列は空欄のままです。画面の定数欄に入れるか、あとで
            data/charts.csv を埋めてください。未設定時は公式レベルを仮の定数にします。N
            曲に満たないときは、入力済みの平均を出します（0 埋めしません）。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>譜面数</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ベスト譜面数</DialogTitle>
          <DialogDescription>
            あとから変えられます。平均の対象曲数だけが変わります。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="other-n">その他</Label>
            <Input
              id="other-n"
              inputMode="numeric"
              value={settings.otherBestCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 1) {
                  onChange({ ...settings, otherBestCount: Math.floor(n) });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="append-n">APPEND</Label>
            <Input
              id="append-n"
              inputMode="numeric"
              value={settings.appendBestCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 1) {
                  onChange({ ...settings, appendBestCount: Math.floor(n) });
                }
              }}
            />
          </div>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
