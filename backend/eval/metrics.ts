import { skillsMatch } from "../src/services/scorer";
import type { Fit } from "./cases";

/** Null when there is nothing to measure, so an empty case can't pass as 100%. */
export const ratio = (hits: number, total: number): number | null => (total === 0 ? null : hits / total);

export const accepts = <T>(expected: T | T[], actual: T): boolean =>
  Array.isArray(expected) ? expected.includes(actual) : expected === actual;

/** Exact skill or a known alias. Partial overlaps like "react" and "react native" don't count. */
export const sameSkill = (a: string, b: string): boolean => skillsMatch(a, b) === "matched";

export interface SetComparison { found: string[]; missed: string[]; extra: string[] }

/** Compares skill names by meaning, so "node" and "node.js" count as the same skill. */
export const compareSkills = (expected: string[], actual: string[], allowedExtras: string[] = []): SetComparison => ({
  found: expected.filter(skill => actual.some(a => sameSkill(skill, a))),
  missed: expected.filter(skill => !actual.some(a => sameSkill(skill, a))),
  extra: actual.filter(a => ![...expected, ...allowedExtras].some(skill => sameSkill(skill, a))),
});

/** The same thresholds as the score headline in the frontend. */
export const fitFromScore = (score: number): Fit => (score >= 75 ? "strong" : score >= 50 ? "moderate" : "weak");

const FIT_RANK: Record<Fit, number> = { weak: 0, moderate: 1, strong: 2 };

/**
 * Of all pairs of cases with different labels, the share the value puts in the right order. Ties count half.
 * 0.5 is chance and 1 is perfect. This is the same as ROC AUC when there are only two labels.
 */
export const rankingAccuracy = (items: { fit: Fit; value: number }[]): number | null => {
  let correct = 0;
  let total = 0;
  for (const a of items) {
    for (const b of items) {
      if (FIT_RANK[a.fit] <= FIT_RANK[b.fit]) continue;
      total++;
      if (a.value > b.value) correct++;
      else if (a.value === b.value) correct += 0.5;
    }
  }
  return ratio(correct, total);
};

/** Least-squares straight line through the points. Null when every x is the same. */
export const fitLine = (points: { x: number; y: number }[]): { slope: number; intercept: number } | null => {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (sxx === 0) return null;
  const slope = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / sxx;
  return { slope, intercept: meanY - slope * meanX };
};

/** The score each label should land near, in the middle of its band on the 0-100 scale. */
export const FIT_TARGET: Record<Fit, number> = { strong: 87, moderate: 62, weak: 25 };

/**
 * Maps raw similarity onto the score scale so each label's pairs land near its target.
 * Returns the similarities that should score 0 and 100.
 */
export const suggestCalibration = (items: { fit: Fit; similarity: number }[]): { floor: number; ceiling: number } | null => {
  const line = fitLine(items.map(item => ({ x: item.similarity, y: FIT_TARGET[item.fit] })));
  if (!line || line.slope <= 0) return null;
  return { floor: -line.intercept / line.slope, ceiling: (100 - line.intercept) / line.slope };
};

export interface Regression { metric: string; baseline: number; current: number }

/** Metrics that dropped by more than the tolerance. Missing or unmeasured metrics are skipped. */
export const findRegressions = (
  baseline: Record<string, number | null>, current: Record<string, number | null>, tolerance: number,
): Regression[] =>
  Object.entries(baseline).flatMap(([metric, base]) => {
    const now = current[metric];
    if (base == null || now == null || base - now <= tolerance) return [];
    return [{ metric, baseline: base, current: now }];
  });
