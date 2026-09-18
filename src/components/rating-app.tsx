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
  isAppendPool,
  isFullCombo,
  overallRating,
  APPEND_POOL_LABEL,
  OTHER_POOL_LABEL,
  OVERALL_LABEL,
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
