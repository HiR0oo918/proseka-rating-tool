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
      ? APPEND_POOL_LABEL + " ベスト " + String(settings.appendBestCount)
      : OTHER_POOL_LABEL + " ベスト " + String(settings.otherBestCount);

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
