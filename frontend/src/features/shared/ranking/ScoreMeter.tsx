import { formatNormalizedScore, type RankingTier } from "./rankingScoreTypes";

export function ScoreMeter({ value, label, tier }: { value: number | null | undefined; label: string; tier: RankingTier | null }) {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return <div className="neo-score-meter" data-tier={tier} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-valuetext={formatNormalizedScore(value)}>
    <span style={{ width: `${value * 100}%` }} />
  </div>;
}
