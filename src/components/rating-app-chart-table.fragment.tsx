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
