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
import { charts, DIFFICULTY_BG, DIFFICULTY_LABEL } from "@/lib/charts";
import {
  bestAverage,
  clampJudgement,
  DEFAULT_JUDGEMENT_WEIGHTS,
  DEFAULT_RATING_POINTS,
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
  type RatingPointMode,
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

type Pool = "master-below" | "append";
type DiffFilter = "all" | "hard" | "expert" | "master";
type SortKey = "title" | "level-desc" | "level-asc" | "rating";

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
  const [constants, setConstants] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [pool, setPool] = useState<Pool>("master-below");
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("level-desc");
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
  }, [results, constants, settings.ratingPoints, settings.judgementWeights]);

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
    list.sort((a, b) => {
      if (sortKey === "level-desc") {
        return b.playLevel - a.playLevel || a.title.localeCompare(b.title, "ja");
      }
      if (sortKey === "level-asc") {
        return a.playLevel - b.playLevel || a.title.localeCompare(b.title, "ja");
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
            達成率の判定重みと単曲レートの折れ線は、設定から変えられます。定数が空の譜面は公式レベルを仮置きします。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpDialog settings={settings} />
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
            constants={constants}
            settings={settings}
            ranked={otherRanked}
            onJudgement={upsertJudgement}
            onAp={setAllPerfect}
            onClear={clearChart}
            onConstant={setConstant}
          />
        </TabsContent>
        <TabsContent value="append" className="mt-4">
          <PoolPanels
            pool="append"
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
            constants={constants}
            settings={settings}
            ranked={appendRanked}
            onJudgement={upsertJudgement}
            onAp={setAllPerfect}
            onClear={clearChart}
            onConstant={setConstant}
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

type RankedRow = {
  chart: Chart;
  rating: number;
  achievement: number;
  constant: number;
};

function PoolPanels({
  pool,
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
  constants,
  settings,
  ranked,
  onJudgement,
  onAp,
  onClear,
  onConstant,
}: {
  pool: Pool;
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
  constants: Record<string, number>;
  settings: Settings;
  ranked: RankedRow[];
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
  onConstant: (chart: Chart, raw: string) => void;
}) {
  const [view, setView] = useState<"charts" | "best">("charts");
  const bestTitle =
    pool === "append"
      ? `APPEND ベスト ${settings.appendBestCount}`
      : `MASTER以下 ベスト ${settings.otherBestCount}`;

  return (
    <div className="space-y-4">
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
              <option value="level-desc">レベル高い順</option>
              <option value="level-asc">レベル低い順</option>
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
                  ratingPoints={settings.ratingPoints}
                  judgementWeights={settings.judgementWeights}
                  onJudgement={onJudgement}
                  onAp={onAp}
                  onClear={onClear}
                  onConstant={onConstant}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <ChartTable
                charts={shown}
                results={results}
                constants={constants}
                ratingPoints={settings.ratingPoints}
                judgementWeights={settings.judgementWeights}
                onJudgement={onJudgement}
                onAp={onAp}
                onClear={onClear}
                onConstant={onConstant}
              />
            </div>
            {shown.length < filtered.length ? (
              <Button variant="outline" className="w-full" onClick={onMore}>
                さらに表示（残り {filtered.length - shown.length}）
              </Button>
            ) : null}
          </>
        )}
        </div>
      ) : (
      <div className="space-y-6">
        {ranked.length === 0 ? (
          <EmptyState
            title="まだリザルトがありません"
            body="譜面入力で GREAT 以下を入れるか、AP を押すとここにベスト内訳が出ます。"
          />
        ) : (
          <BestList
            title={bestTitle}
            poolLabel={pool === "append" ? "APPEND" : "MASTER以下"}
            cap={
              pool === "append"
                ? settings.appendBestCount
                : settings.otherBestCount
            }
            rows={ranked}
          />
        )}
      </div>
      )}
    </div>
  );
}

function ChartTable({
  charts: rows,
  results,
  constants,
  ratingPoints,
  judgementWeights,
  onJudgement,
  onAp,
  onClear,
  onConstant,
}: {
  charts: Chart[];
  results: Record<string, Judgement>;
  constants: Record<string, number>;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
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
          const { value, source } = effectiveConstant(chart, constants[key]);
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
  ratingPoints,
  judgementWeights,
  onJudgement,
  onAp,
  onClear,
  onConstant,
}: {
  chart: Chart;
  judgement: Judgement | undefined;
  constantOverride: number | undefined;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
  onJudgement: (chart: Chart, patch: Partial<Judgement>) => void;
  onAp: (chart: Chart) => void;
  onClear: (chart: Chart) => void;
  onConstant: (chart: Chart, raw: string) => void;
}) {
  const stats = judgement
    ? scoreJudgement(chart.totalNoteCount, judgement, judgementWeights)
    : null;
  const { value, source } = effectiveConstant(chart, constantOverride);
  const rating = stats
    ? singleRating(value, stats.achievement, ratingPoints)
    : null;
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
  poolLabel,
  cap,
  rows,
}: {
  title: string;
  poolLabel: string;
  cap: number;
  rows: RankedRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const average =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;

  async function saveImage() {
    setBusy(true);
    setError(null);
    try {
      const { renderBestImage } = await import("@/lib/best-image");
      const blob = await renderBestImage({
        poolLabel,
        average,
        cap,
        rows: rows.map((row) => ({
          title: row.chart.title,
          difficulty: row.chart.difficulty,
          playLevel: row.chart.playLevel,
          constant: row.constant,
          achievement: row.achievement,
          rating: row.rating,
          jacketAsset: row.chart.jacketAsset,
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pjsk-best-${poolLabel}.png`;
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
            disabled={busy || rows.length === 0}
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

function HelpDialog({ settings }: { settings: Settings }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>計算式</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>計算式</DialogTitle>
          <DialogDescription>
            非公式です。判定の重みと単曲レートの境界は設定から変えられます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
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
            MASTER以下レート = 上位 N 譜面の平均（初期 30）
            <br />
            APPEND レート = 上位 M 譜面の平均（初期 20）
          </p>
          <ul className="font-mono text-xs">
            {settings.ratingPoints.map((point) => (
              <li key={point.percent}>
                {point.percent}% → {describeRatingPoint(point)}
              </li>
            ))}
          </ul>
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
  function updatePoint(index: number, patch: Partial<RatingPoint>) {
    const next = settings.ratingPoints.map((point, i) =>
      i === index ? { ...point, ...patch } : point,
    );
    onChange({ ...settings, ratingPoints: next });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>設定</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            ベスト譜面数、判定の重み、単曲レートの境界をあとから変えられます。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="other-n">MASTER以下の譜面数</Label>
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
            <Label htmlFor="append-n">APPEND の譜面数</Label>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>判定の重み</Label>
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...settings,
                  judgementWeights: DEFAULT_JUDGEMENT_WEIGHTS,
                })
              }
            >
              初期値に戻す
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            達成率の分子に使います。分母は PERFECT の重み × 総ノーツです。100% を超えた分は切り捨てます。
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["perfect", "PERFECT"],
                ["great", "GREAT"],
                ["good", "GOOD"],
                ["bad", "BAD"],
                ["miss", "MISS"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`weight-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`weight-${key}`}
                  inputMode="decimal"
                  className="tabular-nums"
                  value={settings.judgementWeights[key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      onChange({
                        ...settings,
                        judgementWeights: {
                          ...settings.judgementWeights,
                          [key]: n,
                        },
                      });
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>単曲レートの境界</Label>
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...settings,
                    ratingPoints: [
                      ...settings.ratingPoints,
                      { percent: 100, mode: "offset", value: 0 },
                    ],
                  })
                }
              >
                行を追加
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...settings,
                    ratingPoints: DEFAULT_RATING_POINTS,
                  })
                }
              >
                初期値に戻す
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            「定数+」は譜面定数への加減、「固定」は達成率に対するレートそのものです。境界の間は線形補間します。
          </p>
          <div className="space-y-2">
            {settings.ratingPoints.map((point, index) => (
              <div
                key={`${index}-${point.percent}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
              >
                <Input
                  aria-label="達成率パーセント"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={point.percent}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      updatePoint(index, { percent: n });
                    }
                  }}
                />
                <select
                  aria-label="境界の種類"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={point.mode}
                  onChange={(e) =>
                    updatePoint(index, {
                      mode: e.target.value as RatingPointMode,
                    })
                  }
                >
                  <option value="offset">定数+</option>
                  <option value="absolute">固定</option>
                </select>
                <Input
                  aria-label="境界の値"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={point.value}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      updatePoint(index, { value: n });
                    }
                  }}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={settings.ratingPoints.length <= 1}
                  onClick={() =>
                    onChange({
                      ...settings,
                      ratingPoints: settings.ratingPoints.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  削除
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
