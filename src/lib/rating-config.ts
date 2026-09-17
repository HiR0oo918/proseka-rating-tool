import raw from "@/data/rating-config.json";
import {
  DEFAULT_APPEND_BEST,
  DEFAULT_JUDGEMENT_WEIGHTS,
  DEFAULT_OTHER_BEST,
  DEFAULT_OVERALL_APPEND_WEIGHT,
  DEFAULT_OVERALL_OTHER_WEIGHT,
  DEFAULT_RATING_POINTS,
  normalizeJudgementWeights,
  normalizeRatingPoints,
  type JudgementWeights,
  type RatingPoint,
} from "@/lib/rating";

export type RatingConfig = {
  updatedAt: string;
  otherBestCount: number;
  appendBestCount: number;
  overallOtherWeight: number;
  overallAppendWeight: number;
  ratingPoints: RatingPoint[];
  judgementWeights: JudgementWeights;
};

function normalizeConfig(rawConfig: Partial<RatingConfig>): RatingConfig {
  const points = Array.isArray(rawConfig.ratingPoints)
    ? normalizeRatingPoints(rawConfig.ratingPoints)
    : DEFAULT_RATING_POINTS;
  return {
    updatedAt: rawConfig.updatedAt ?? "",
    otherBestCount: Math.max(
      1,
      Math.floor(rawConfig.otherBestCount ?? DEFAULT_OTHER_BEST) ||
        DEFAULT_OTHER_BEST,
    ),
    appendBestCount: Math.max(
      1,
      Math.floor(rawConfig.appendBestCount ?? DEFAULT_APPEND_BEST) ||
        DEFAULT_APPEND_BEST,
    ),
    overallOtherWeight: Math.max(
      0,
      Math.floor(
        rawConfig.overallOtherWeight ?? DEFAULT_OVERALL_OTHER_WEIGHT,
      ) || DEFAULT_OVERALL_OTHER_WEIGHT,
    ),
    overallAppendWeight: Math.max(
      0,
      Math.floor(
        rawConfig.overallAppendWeight ?? DEFAULT_OVERALL_APPEND_WEIGHT,
      ) || DEFAULT_OVERALL_APPEND_WEIGHT,
    ),
    ratingPoints: points,
    judgementWeights: normalizeJudgementWeights(rawConfig.judgementWeights),
  };
}

export const ratingConfig: RatingConfig = normalizeConfig(
  raw as Partial<RatingConfig>,
);
