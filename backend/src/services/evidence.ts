import { EvidenceLevel, EvidenceSection, SkillEvidence } from "../types";
import { mentionsSkill } from "./scorer";

// Short strings can appear by chance inside longer words.
export const MIN_QUOTE_CHARS = 12;
const WORK_SECTIONS = new Set<EvidenceSection>(["experience", "project"]);

/** Drops case, spacing and punctuation, which PDF extraction changes through line wraps, hyphenation and ligatures. */
export const toComparable = (text: string): string =>
  text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]/gu, "");

// Words a row of the other column can put at the start of a wrapped line's continuation.
const MAX_COLUMN_WORDS = 8;
const lineWords = (line: string): string[] => line.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}+#]+/gu) ?? [];

/**
 * Two-column PDFs are often read row by row across both columns, so a wrapped line continues on the next row after
 * a few words from the other column: "...lifted click-through rate" then "Python, PyTorch, SQL by 11% across...".
 * This allows exactly that: the quote's words in order, unbroken within a line, and at each line break a skip of
 * up to MAX_COLUMN_WORDS words at the start of the next line. Nothing may be skipped in the middle of a line.
 * The skip can't tell the other column's words from words of the quote's own next line, so a quote that leaves out
 * the first few words of a continuation line still counts. Every word it does quote is in the PDF, in order.
 */
const existsAcrossColumns = (quote: string, resumeText: string): boolean => {
  const target = lineWords(quote);
  const lines = resumeText.split(/\r?\n/).map(lineWords);
  const continues = (lineIndex: number, from: number, matched: number): boolean => {
    const line = lines[lineIndex];
    let i = from;
    let m = matched;
    while (i < line.length && m < target.length && line[i] === target[m]) { i++; m++; }
    if (m === target.length) return true;
    if (i < line.length || lineIndex + 1 >= lines.length) return false;
    const next = lines[lineIndex + 1];
    for (let skip = 0; skip <= Math.min(MAX_COLUMN_WORDS, next.length - 1); skip++) {
      if (next[skip] === target[m] && continues(lineIndex + 1, skip, m)) return true;
    }
    return false;
  };
  return target.length > 0 && lines.some((line, li) => line.some((word, wi) => word === target[0] && continues(li, wi, 0)));
};

export const quoteExists = (quote: string, resumeText: string): boolean => {
  const comparable = toComparable(quote);
  if (comparable.length < MIN_QUOTE_CHARS) return false;
  return toComparable(resumeText).includes(comparable) || existsAcrossColumns(quote, resumeText);
};

/** A comma-separated run of short items, as in "Stack: React, Node, AWS", names skills without showing their use. */
const isBareList = (quote: string): boolean => {
  const items = quote.split(/[,;|•]/).map(item => item.trim()).filter(Boolean);
  return items.length >= 3 && items.every(item => item.split(/\s+/).length <= 3);
};

const classify = (item: Omit<SkillEvidence, "level">, resumeText: string): EvidenceLevel => {
  if (!mentionsSkill(item.quote, item.skill)) return "unverified";
  if (quoteExists(item.quote, resumeText)) return WORK_SECTIONS.has(item.section) && !isBareList(item.quote) ? "demonstrated" : "listed";
  // A skills list often cites just the name, as in "Docker", which is too short to check as a quote. The name
  // appearing in the PDF text is enough to confirm it's listed, never that it's demonstrated.
  if (item.section === "skills_list" && toComparable(item.quote).length < MIN_QUOTE_CHARS && mentionsSkill(resumeText, item.skill)) return "listed";
  return "unverified";
};

/** Grades the model's citations against the PDF text, so the model never gets to vouch for its own quotes. */
export const gradeEvidence = (items: Omit<SkillEvidence, "level">[], resumeText: string): SkillEvidence[] =>
  items.map(item => ({ ...item, level: classify(item, resumeText) }));
