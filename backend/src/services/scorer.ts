import { EvidenceLevel, ParsedJD, ParsedResume, ScoreBreakdown, SkillEvidence, SkillMatch } from "../types";
import { runHardChecks } from "./hardChecks";

const cosineSimilarity = (a: number[], b: number[]): number => {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
};

const ALIASES: Record<string, string[]> = {
  javascript: ["js", "es6", "ecmascript"], typescript: ["ts"], "node.js": ["node", "nodejs"],
  react: ["react.js", "reactjs"], "next.js": ["next", "nextjs"], vue: ["vue.js", "vuejs"], express: ["express.js", "expressjs"],
  postgresql: ["postgres", "pg"], mongodb: ["mongo"], kubernetes: ["k8s"], go: ["golang"], "c#": ["csharp", "c sharp"],
  aws: ["amazon web services"], gcp: ["google cloud platform", "google cloud"], "ci cd": ["cicd"],
  rest: ["rest api", "rest apis", "restful", "restful api", "restful apis"],
  "machine learning": ["ml"], "artificial intelligence": ["ai"],
};

// A resume skill that proves a broader job requirement.
const IMPLIES: Record<string, string[]> = {
  postgresql: ["sql"], mysql: ["sql"], sqlite: ["sql"], "sql server": ["sql"],
  mongodb: ["nosql"], dynamodb: ["nosql"], cassandra: ["nosql"], redis: ["nosql"],
};

const CANONICAL = new Map(Object.entries(ALIASES).flatMap(([name, alts]) => alts.map((alt): [string, string] => [alt, name])));
const IGNORED_WORDS = new Set(["programming", "language", "languages", "framework", "frameworks", "library", "libraries", "and", "or", "with"]);

const canonicalize = (phrase: string): string => CANONICAL.get(phrase) ?? phrase;

const normalizeSkill = (skill: string): string[] => {
  const tokens = skill.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").split(/\s+/).map(t => t.replace(/\.+$/, "")).filter(Boolean);
  const meaningful = tokens.filter(t => !IGNORED_WORDS.has(t));
  return meaningful.length ? meaningful : tokens;
};

/**
 * Compares whole words, never substrings, so "go" can't match "mongodb".
 * Partial means one skill's words are all in the other, as in "react" and "react native".
 */
export const skillsMatch = (jdSkill: string, resumeSkill: string): "matched" | "partial" | null => {
  const jdTokens = normalizeSkill(jdSkill);
  const resumeTokens = normalizeSkill(resumeSkill);
  const jd = canonicalize(jdTokens.join(" "));
  const resume = canonicalize(resumeTokens.join(" "));
  if (!jd || !resume) return null;
  if (jd === resume || IMPLIES[resume]?.includes(jd)) return "matched";
  if (IMPLIES[jd]?.includes(resume)) return "partial";

  const jdWords = jdTokens.map(canonicalize);
  const resumeWords = resumeTokens.map(canonicalize);
  const [shorter, longer] = jdWords.length <= resumeWords.length ? [jdWords, resumeWords] : [resumeWords, jdWords];
  // Single letters such as "c" are too ambiguous to count as part of a longer skill.
  if (shorter.join(" ").length >= 2 && shorter.every(word => longer.includes(word))) return "partial";
  return null;
};

const MAX_SKILL_WORDS = 4;

/** Whether a line names the skill, including by alias, as a whole word or phrase. */
export const mentionsSkill = (line: string, skill: string): boolean => {
  const words = line.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").split(/\s+/).map(w => w.replace(/\.+$/, "")).filter(Boolean);
  for (let length = 1; length <= MAX_SKILL_WORDS; length++) {
    for (let start = 0; start + length <= words.length; start++) {
      if (skillsMatch(skill, words.slice(start, start + length).join(" ")) === "matched") return true;
    }
  }
  return false;
};

const EVIDENCE_RANK: Record<EvidenceLevel, number> = { demonstrated: 2, listed: 1, unverified: 0 };

const strongestEvidence = (jdSkill: string, status: "matched" | "partial", evidence: SkillEvidence[]): Pick<SkillMatch, "evidence" | "quote"> => {
  const best = evidence
    .filter(item => skillsMatch(jdSkill, item.skill) === status)
    .sort((a, b) => EVIDENCE_RANK[b.level] - EVIDENCE_RANK[a.level])[0];
  if (!best || best.level === "unverified") return { evidence: "unverified", quote: null };
  return { evidence: best.level, quote: best.quote };
};

export const computeScore = (
  jd: ParsedJD, resume: ParsedResume, jdEmbedding: number[], resumeEmbedding: number[]
): ScoreBreakdown => {
  const candidateSkills = [...resume.skills, ...resume.tools];
  const skillEvidence = resume.skillEvidence ?? [];
  const matchedSkills: SkillMatch[] = [];
  const missingRequired: string[] = [];
  const missingNiceToHave: string[] = [];

  for (const jdSkill of jd.requiredSkills) {
    let best: "matched" | "partial" | null = null;
    for (const rs of candidateSkills) {
      const m = skillsMatch(jdSkill, rs);
      if (m === "matched") { best = "matched"; break; }
      if (m === "partial" && best == null) best = "partial";
    }
    matchedSkills.push(best
      ? { skill: jdSkill, status: best, ...strongestEvidence(jdSkill, best, skillEvidence) }
      : { skill: jdSkill, status: "missing", evidence: null, quote: null });
    if (!best) missingRequired.push(jdSkill);
  }

  for (const jdSkill of jd.niceToHaveSkills) {
    if (!candidateSkills.some(rs => skillsMatch(jdSkill, rs))) missingNiceToHave.push(jdSkill);
  }

  const totalRequired = jd.requiredSkills.length;
  const programmaticScore = totalRequired === 0 ? 75 :
    Math.min(Math.round(matchedSkills.reduce((s, m) =>
      s + (m.status === "matched" ? 1 : m.status === "partial" ? 0.5 : 0), 0) / totalRequired * 100), 100);

  const similarity = cosineSimilarity(jdEmbedding, resumeEmbedding);
  const semanticScore = Math.round(((similarity + 1) / 2) * 100);
  const finalScore = Math.min(Math.round(semanticScore * 0.6 + programmaticScore * 0.4), 100);

  return {
    programmaticScore, semanticScore, finalScore, matchedSkills,
    missingRequired, missingNiceToHave,
    yearsOfExperienceDelta: Math.round((resume.yearsOfExperience - jd.yearsOfExperience) * 10) / 10,
    hardChecks: runHardChecks(jd, resume),
  };
};
