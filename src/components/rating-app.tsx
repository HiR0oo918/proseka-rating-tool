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
import { FeedbackDialog } from "@/components/feedback-dialog";
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
  APP_NAME,
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
