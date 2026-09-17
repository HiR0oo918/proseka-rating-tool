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
import { renderBestImage, type BestImageRow } from "@/lib/best-image";
import { charts, DIFFICULTY_BG, DIFFICULTY_LABEL } from "@/lib/charts";
import {
  bestAverage,
  clampJudgement,
  describeRatingPoint,
  effectiveConstant,
  EMPTY_JUDGEMENT,
  formatPercent,
  formatRating,
  isAllPerfect,
  isFullCombo,
  scoreJudgement,
  singleRating,
  type Chart,
  type Difficulty,
  type Judgement,
  type JudgementWeights,
  type RatingPoint,
} from "@/lib/rating";
import { ratingConfig, type RatingConfig } from "@/lib/rating-config";
import { loadResults, makeBackup, parseBackup, saveResults } from "@/lib/storage";

type Pool = "master-below" | "append";
type DiffFilter = "all" | "hard" | "expert" | "master";
type View = "charts" | "best";
type SortKey =
  | "title"
  | "constant-desc"
  | "constant-asc"
  | "rating";

const PAGE_SIZE = 40;

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

function ConstantDisplay({
  playLevel,
  value,
  source,
}: {
  playLevel: number;
  value: number;
  source: "csv" | "level" | "override";
}) {
  return (
    <span className="tabular-nums">
      {value.toFixed(1)}
      {source === "level" ? (
        <span className="ml-1 text-[10px] text-muted-foreground">仮</span>
      ) : null}
      <span className="sr-only">（公式レベル {playLevel}）</span>
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge
      variant="outline"
      className="border-transparent font-semibold text-white shadow-none"
      style={{
        background: DIFFICULTY_BG[difficulty],
        color: "#fff",
      }}
    >
      {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  );
}

export function RatingApp() {
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<Record<string, Judgement>>({});
  const [pool, setPool] = useState<Pool>("master-below");
  const [view, setView] = useState<View>("charts");
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("constant-desc");
  const [enteredOnly, setEnteredOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settings = ratingConfig;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- マウント後に localStorage を読む */
    setResults(loadResults());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveResults(results);
  }, [results, ready]);

  const played = useMemo(() => {
    return charts.flatMap((chart) => {
      const key = String(chart.chartId);
      const judgement = results[key];
      if (!judgement) return [];
      const { value, source } = effectiveConstant(chart, null);
      const rm = scoreJudgement(
        chart.totalNoteCount,
        judgement,
        settings.judgementWeights,
      );
      return [
        {
          chart,
          judgement,
          source,
          constant: value,
          ...rm,
          rating: singleRating(value, rm.achievement, settings.ratingPoints),
        },
      ];
    });
  }, [results, settings.ratingPoints, settings.judgementWeights]);

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
      const isAppend = chart.difficulty === "append";
      if (pool === "append" ? !isAppend : isAppend) return false;
      if (pool === "master-below" && diffFilter !== "all") {
        if (chart.difficulty !== diffFilter) return false;
      }
      if (!matchesQuery(chart, query)) return false;
      if (enteredOnly && !results[String(chart.chartId)]) return false;
      return true;
    });
    const ratingOf = (chart: Chart) => {
      const row = played.find((p) => p.chart.chartId === chart.chartId);
      return row?.rating ?? -1;
    };
    const constantOf = (chart: Chart) => effectiveConstant(chart, null).value;
    list.sort((a, b) => {
      if (sortKey === "constant-desc") {
        return constantOf(b) - constantOf(a) || a.title.localeCompare(b.title, "ja");
      }
      if (sortKey === "constant-asc") {
        return constantOf(a) - constantOf(b) || a.title.localeCompare(b.title, "ja");
      }
      if (sortKey === "rating") {
        return ratingOf(b) - ratingOf(a) || a.title.localeCompare(b.title, "ja");
      }
      return a.title.localeCompare(b.title, "ja") || a.playLevel - b.playLevel;
    });
    return list;
  }, [pool, diffFilter, query, enteredOnly, results, sortKey, played]);

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

  function exportBackup() {
    const blob = new Blob(
      [JSON.stringify(makeBackup(results), null, 2)],
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
        setResults(backup.results);
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
        </div>
        <div className="flex flex-wrap gap-2">
          <SpecificationsDialog settings={settings} />
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
          title="MASTER以下"
          description={`HARD・EXPERT・MASTER の上位 ${settings.otherBestCount} 譜面`}
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

      <div className="flex gap-2">
        <Button
          variant={view === "charts" ? "default" : "outline"}
          onClick={() => setView("charts")}
        >
          譜面入力
        </Button>
        <Button
          variant={view === "best" ? "default" : "outline"}
          onClick={() => setView("best")}
        >
          ベスト内訳
        </Button>
      </div>

      <Tabs
        value={pool}
        onValueChange={(value) => {
          if (value !== "master-below" && value !== "append") return;
          setPool(value);
          setVisible(PAGE_SIZE);
          setDiffFilter("all");
        }}
      >
        <TabsList>
          <TabsTrigger value="master-below">MASTER以下</TabsTrigger>
          <TabsTrigger value="append">APPEND</TabsTrigger>
        </TabsList>
        <TabsContent value="master-below" className="mt-4">
          <PoolPanels
            pool="master-below"
            view={view}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setVisible(PAGE_SIZE);
            }}
            diffFilter={diffFilter}
            onDiffFilter={(v) => {
              setDiffFilter(v);
              setVisible(PAGE_SIZE);
            }}
            sortKey={sortKey}
            onSortKey={setSortKey}
            enteredOnly={enteredOnly}
            onEnteredOnly={(v) => {
              setEnteredOnly(v);
              setVisible(PAGE_SIZE);
            }}
            onMore={() => setVisible((v) => v + PAGE_SIZE)}
            filtered={filtered}
            shown={shown}
            results={results}
            settings={settings}
            ranked={otherRanked}
            otherRanked={otherRanked}
            appendRanked={appendRanked}
            onJudgement={upsertJudgement}
            onAp={setAllPerfect}
            onClear={clearChart}
          />
        </TabsContent>
        <TabsContent value="append" className="mt-4">
          <PoolPanels
            pool="append"
            view={view}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setVisible(PAGE_SIZE);
            }}
            diffFilter={diffFilter}
            onDiffFilter={(v) => {
              setDiffFilter(v);
              setVisible(PAGE_SIZE);
            }}
            sortKey={sortKey}
            onSortKey={setSortKey}
            enteredOnly={enteredOnly}
            onEnteredOnly={(v) => {
              setEnteredOnly(v);
              setVisible(PAGE_SIZE);
            }}
            onMore={() => setVisible((v) => v + PAGE_SIZE)}
            filtered={filtered}
            shown={shown}
            results={results}
            settings={settings}
            ranked={appendRanked}
            otherRanked={otherRanked}
            appendRanked={appendRanked}
            onJudgement={upsertJudgement}
            onAp={setAllPerfect}
            onClear={clearChart}
          />
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
          {formatRating(average)}
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

type RankedRow = {
  chart: Chart;
  judgement: Judgement;
  rating: number;
  achievement: number;
  constant: number;
};

function PoolPanels({
  pool,
  view,
  query,
  onQuery,
  diffFilter,
  onDiffFilter,
  sortKey,
  onSortKey,
  enteredOnly,
  onEnteredOnly,
  onMore,
  filtered,
  shown,
  results,
  settings,
  ranked,
  otherRanked,
  appendRanked,
  onJudgement,
  onAp,
  onClear,
}: {
  pool: Pool;
  view: View;
  query: string;
  onQuery: (query: string) => void;
  diffFilter: DiffFilter;
  onDiffFilter: (filter: DiffFilter) => void;
  sortKey: SortKey;
  onSortKey: (sort: SortKey) => void;
  enteredOnly: boolean;
  onEnteredOnly: (value: boolean) => void;
  onMore: () => void;
  filtered: Chart[];
  shown: Chart[];
  results: Record<string, Judgement>;
  settings: RatingConfig;
  ranked: RankedRow[];
  otherRanked: RankedRow[];
  appendRanked: RankedRow[];
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
}) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const bestTitle =
    pool === "append"
      ? `APPEND ベスト ${settings.appendBestCount}`
      : `MASTER以下 ベスト ${settings.otherBestCount}`;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      view !== "charts" ||
      shown.length >= filtered.length ||
      !target
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filtered.length, onMore, shown.length, view]);

  return (
    <div className="space-y-4">
      {view === "charts" ? (
        <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`search-${pool}`}>曲名 / 読み</Label>
            <Input
              id={`search-${pool}`}
              placeholder="例: ヒバナ、ひばな"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
          {pool === "master-below" ? (
            <div className="space-y-1">
              <Label htmlFor="diff">難易度</Label>
              <select
                id="diff"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-36"
                value={diffFilter}
                onChange={(e) => onDiffFilter(e.target.value as DiffFilter)}
              >
                <option value="all">すべて</option>
                <option value="hard">HARD</option>
                <option value="expert">EXPERT</option>
                <option value="master">MASTER</option>
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`sort-${pool}`}>並び</Label>
            <select
              id={`sort-${pool}`}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm md:w-40"
              value={sortKey}
              onChange={(e) => onSortKey(e.target.value as SortKey)}
            >
              <option value="title">曲名</option>
              <option value="constant-desc">譜面定数高い順</option>
              <option value="constant-asc">譜面定数低い順</option>
              <option value="rating">単曲レート高い順</option>
            </select>
          </div>
          <Button
            variant={enteredOnly ? "default" : "outline"}
            onClick={() => onEnteredOnly(!enteredOnly)}
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
            <div className="space-y-3 md:hidden">
              {shown.map((chart) => (
                <ChartCard
                  key={chart.chartId}
                  chart={chart}
                  judgement={results[String(chart.chartId)]}
                  ratingPoints={settings.ratingPoints}
                  judgementWeights={settings.judgementWeights}
                  onJudgement={onJudgement}
                  onAp={onAp}
                  onClear={onClear}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <ChartTable
                charts={shown}
                results={results}
                ratingPoints={settings.ratingPoints}
                judgementWeights={settings.judgementWeights}
                onJudgement={onJudgement}
                onAp={onAp}
                onClear={onClear}
              />
            </div>
            {shown.length < filtered.length ? (
              <div ref={loadMoreRef}>
                <Button variant="outline" className="w-full" onClick={onMore}>
                  さらに表示（残り {filtered.length - shown.length}）
                </Button>
              </div>
            ) : null}
          </>
        )}
        </div>
      ) : (
      <div className="space-y-6">
        <BestList
          title={bestTitle}
          rows={ranked}
          otherRows={otherRanked}
          appendRows={appendRanked}
          settings={settings}
        />
      </div>
      )}
    </div>
  );
}

function ChartTable({
  charts: rows,
  results,
  ratingPoints,
  judgementWeights,
  onJudgement,
  onAp,
  onClear,
}: {
  charts: Chart[];
  results: Record<string, Judgement>;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>曲</TableHead>
          <TableHead>Lv</TableHead>
          <TableHead>定数</TableHead>
          <TableHead>ノーツ</TableHead>
          <TableHead>PERFECT</TableHead>
          <TableHead>GREAT</TableHead>
          <TableHead>GOOD</TableHead>
          <TableHead>BAD</TableHead>
          <TableHead>MISS</TableHead>
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
            ? scoreJudgement(chart.totalNoteCount, judgement, judgementWeights)
            : null;
          const { value, source } = effectiveConstant(chart, null);
          const rating = stats
            ? singleRating(value, stats.achievement, ratingPoints)
            : null;
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
                <ConstantDisplay
                  playLevel={chart.playLevel}
                  value={value}
                  source={source}
                />
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
  ratingPoints,
  judgementWeights,
  onJudgement,
  onAp,
  onClear,
}: {
  chart: Chart;
  judgement: Judgement | undefined;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
}) {
  const stats = judgement
    ? scoreJudgement(chart.totalNoteCount, judgement, judgementWeights)
    : null;
  const { value, source } = effectiveConstant(chart, null);
  const rating = stats
    ? singleRating(value, stats.achievement, ratingPoints)
    : null;
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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">定数</span>
          <ConstantDisplay
            playLevel={chart.playLevel}
            value={value}
            source={source}
          />
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-[11px] text-muted-foreground">
          <span>PERFECT {stats ? stats.perfect : "—"}</span>
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
  otherRows,
  appendRows,
  settings,
}: {
  title: string;
  rows: RankedRow[];
  otherRows: RankedRow[];
  appendRows: RankedRow[];
  settings: RatingConfig;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveImage() {
    setBusy(true);
    setError(null);
    try {
      const imageRows = (source: RankedRow[]): BestImageRow[] =>
        source.map((row) => ({
          title: row.chart.title,
          difficulty: row.chart.difficulty,
          playLevel: row.chart.playLevel,
          constant: row.constant,
          achievement: row.achievement,
          rating: row.rating,
          clearStatus: isAllPerfect(
            row.chart.totalNoteCount,
            row.judgement,
          )
            ? "AP"
            : isFullCombo(row.chart.totalNoteCount, row.judgement)
              ? "FC"
              : null,
          jacketAsset: row.chart.jacketAsset,
        }));
      const blob = await renderBestImage({
        sections: [
          {
            poolLabel: "MASTER以下",
            average:
              otherRows.reduce((sum, row) => sum + row.rating, 0) /
              settings.otherBestCount,
            cap: settings.otherBestCount,
            rows: imageRows(otherRows),
          },
          {
            poolLabel: "APPEND",
            average:
              appendRows.reduce((sum, row) => sum + row.rating, 0) /
              settings.appendBestCount,
            cap: settings.appendBestCount,
            rows: imageRows(appendRows),
          },
        ],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pjsk-best.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {rows.length === 0
                ? "この枠に入るリザルトはまだありません。"
                : `上位 ${rows.length} 譜面`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            disabled={busy || (otherRows.length === 0 && appendRows.length === 0)}
            onClick={() => void saveImage()}
          >
            {busy ? "生成中…" : "ベスト枠画像"}
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.chart.chartId}
              className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* ベスト枠のサムネは API 経由のジャケット */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/jacket/${encodeURIComponent(row.chart.jacketAsset)}`}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-md object-cover bg-muted"
                />
                <div className="min-w-0">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{row.chart.title}</span>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    <DifficultyBadge difficulty={row.chart.difficulty} />
                    <span>
                      定数 {row.constant} / {formatPercent(row.achievement)}
                    </span>
                  </div>
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

function SpecificationsDialog({ settings }: { settings: RatingConfig }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>仕様</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>仕様</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <h3 className="font-medium">計算式</h3>
          <p>
            PERFECT = 総ノーツ − GREAT − GOOD − BAD − MISS。各ノーツの重みは均等です。
          </p>
          <p className="font-mono text-xs leading-relaxed">
            達成率 = ({settings.judgementWeights.perfect}×P +{" "}
            {settings.judgementWeights.great}×GREAT +{" "}
            {settings.judgementWeights.good}×GOOD +{" "}
            {settings.judgementWeights.bad}×BAD +{" "}
            {settings.judgementWeights.miss}×MISS) / (
            {settings.judgementWeights.perfect}×総ノーツ)
            <br />
            上限 100%
            <br />
            単曲レート = 下記境界を線形補間
            <br />
            MASTER以下レート = 上位 {settings.otherBestCount} 譜面の平均
            <br />
            APPEND レート = 上位 {settings.appendBestCount} 譜面の平均
          </p>
          <ul className="font-mono text-xs">
            {settings.ratingPoints.map((point) => (
              <li key={point.percent}>
                {point.percent}% → {describeRatingPoint(point)}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">共通設定</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>MASTER以下の譜面数</Label>
              <p className="tabular-nums text-sm">{settings.otherBestCount}</p>
            </div>
            <div className="space-y-1">
              <Label>APPEND の譜面数</Label>
              <p className="tabular-nums text-sm">{settings.appendBestCount}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
