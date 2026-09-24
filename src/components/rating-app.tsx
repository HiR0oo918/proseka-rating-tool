function RatingSummary({
  title,
  description,
  average,
  used,
  cap,
  large = false,
}: {
  title: string;
  description?: string;
  average: number;
  used: number | null;
  cap: number | null;
  large?: boolean;
}) {
  const detail =
    used != null && cap != null
      ? (description ? description + "（" : "（") +
        String(used) +
        "/" +
        String(cap) +
        " 譜面）"
      : description;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={
            large
              ? "font-mono text-4xl tabular-nums sm:text-5xl"
              : "font-mono text-3xl tabular-nums"
          }
        >
          {formatRating(average)}
        </CardTitle>
        {detail ? <CardDescription>{detail}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}
