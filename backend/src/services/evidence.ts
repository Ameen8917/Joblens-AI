import { EvidenceLevel, EvidenceSection, SkillEvidence } from "../types";
import { mentionsSkill } from "./scorer";

// Short strings can appear by chance inside longer words.
export const MIN_QUOTE_CHARS = 12;
const WORK_SECTIONS = new Set<EvidenceSection>(["experience", "project"]);

/** Drops case, spacing and punctuation, which PDF extraction changes through line wraps, hyphenation and ligatures. */
export const toComparable = (text: string): string =>
  text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]/gu, "");

export const quoteExists = (quote: string, resumeText: string): boolean => {
  const comparable = toComparable(quote);
  return comparable.length >= MIN_QUOTE_CHARS && toComparable(resumeText).includes(comparable);
};

/** A comma-separated run of short items, as in "Stack: React, Node, AWS", names skills without showing their use. */
const isBareList = (quote: string): boolean => {
  const items = quote.split(/[,;|•]/).map(item => item.trim()).filter(Boolean);
  return items.length >= 3 && items.every(item => item.split(/\s+/).length <= 3);
};

const classify = (item: Omit<SkillEvidence, "level">, resumeText: string): EvidenceLevel => {
  if (!quoteExists(item.quote, resumeText) || !mentionsSkill(item.quote, item.skill)) return "unverified";
  return WORK_SECTIONS.has(item.section) && !isBareList(item.quote) ? "demonstrated" : "listed";
};

/** Grades the model's citations against the PDF text, so the model never gets to vouch for its own quotes. */
export const gradeEvidence = (items: Omit<SkillEvidence, "level">[], resumeText: string): SkillEvidence[] =>
  items.map(item => ({ ...item, level: classify(item, resumeText) }));
