import { ParsedResume } from "../types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ONGOING = /\b(present|current|now|today|ongoing)\b/i;
// Internships don't count as professional experience.
const NOT_PROFESSIONAL = /\b(intern|internship|trainee|co-?op|apprentice)\b/i;

/** Months since year 0, so date ranges can be compared and merged. */
type Month = number;

/** Reads "Mar 2021", "March 2021", "03/2021", "2021-03" or a bare year. A bare year starts in January and ends in December. */
const parseMonth = (text: string, edge: "start" | "end", today: Date): Month | null => {
  const value = text.trim().toLowerCase();
  if (ONGOING.test(value)) return today.getFullYear() * 12 + today.getMonth();
  const named = /([a-z]{3,9})\.?\s+(\d{4})/.exec(value);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3));
    if (month >= 0) return Number(named[2]) * 12 + month;
  }
  const slashed = /\b(\d{1,2})\/(\d{4})\b/.exec(value);
  const iso = /\b(\d{4})-(\d{1,2})\b/.exec(value);
  const numeric = slashed ? { month: Number(slashed[1]), year: Number(slashed[2]) }
    : iso ? { month: Number(iso[2]), year: Number(iso[1]) } : null;
  if (numeric && numeric.month >= 1 && numeric.month <= 12) return numeric.year * 12 + numeric.month - 1;
  const year = /\b(19|20)\d{2}\b/.exec(value);
  if (year) return Number(year[0]) * 12 + (edge === "start" ? 0 : 11);
  return null;
};

/** A duration such as "Feb 2022 - Oct 2026" as a half-open month range, or null if it can't be read. */
export const parseDuration = (duration: string, today: Date): [Month, Month] | null => {
  const parts = duration.split(/\s*(?:–|—|-|\bto\b)\s*(?=[a-z]|\d{1,2}\/|\d{4})/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const start = parseMonth(parts[0], "start", today);
  const end = parseMonth(parts[1], "end", today);
  // Counts both the first and last month, so "Jan 2019 - Jan 2022" is 37 months, near enough to 3 years.
  return start !== null && end !== null && end >= start ? [start, end + 1] : null;
};

/**
 * Total years of professional experience from the roles' own dates, with overlapping roles counted once.
 * The model's own total was off by almost 3 years on a two-column resume, while it read every date correctly.
 * Null when any professional role's dates can't be read, since a partial sum would undercount.
 */
export const yearsFromWorkHistory = (workHistory: ParsedResume["workHistory"], today = new Date()): number | null => {
  const professional = workHistory.filter(work => !NOT_PROFESSIONAL.test(work.role));
  if (professional.length === 0) return workHistory.length ? 0 : null;
  const ranges: [Month, Month][] = [];
  for (const work of professional) {
    const range = parseDuration(work.duration, today);
    if (!range) return null;
    ranges.push(range);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let [start, end] = ranges[0];
  for (const [nextStart, nextEnd] of ranges.slice(1)) {
    if (nextStart <= end) { end = Math.max(end, nextEnd); continue; }
    months += end - start;
    [start, end] = [nextStart, nextEnd];
  }
  months += end - start;
  return Math.round((months / 12) * 10) / 10;
};
