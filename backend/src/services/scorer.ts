import { EvidenceLevel, ParsedJD, ParsedResume, ScoreBreakdown, SkillEvidence, SkillMatch } from "../types";
import { runHardChecks } from "./hardChecks";

export const cosineSimilarity = (a: number[], b: number[]): number => {
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

/**
 * Concrete skills that show a broad area. Jobs often list areas such as "backend development" or "infrastructure"
 * as required skills, which no resume names word for word, so they counted as missing for strong candidates.
 */
const AREA_SIGNALS: Record<string, string[]> = {
  backend: ["node.js", "java", "python", "go", "c#", "ruby", "php", "rust", "postgresql", "mysql", "sql", "mongodb", "redis", "rest", "graphql", "grpc", "spring boot", "django", "express", "fastapi", "microservices", "kafka"],
  frontend: ["react", "vue", "angular", "svelte", "javascript", "typescript", "css", "html", "next.js", "tailwind css", "redux"],
  api: ["rest", "graphql", "grpc", "express", "fastapi", "django", "spring boot", "openapi"],
  infrastructure: ["kubernetes", "terraform", "aws", "gcp", "azure", "docker", "ansible", "linux", "prometheus", "helm"],
  platform: ["kubernetes", "terraform", "docker", "aws", "gcp", "azure", "helm"],
  cloud: ["aws", "gcp", "azure", "kubernetes", "terraform"],
  devops: ["kubernetes", "docker", "terraform", "jenkins", "ansible", "ci cd", "github actions", "gitlab ci"],
  data: ["sql", "spark", "airflow", "kafka", "pandas", "dbt", "snowflake", "bigquery", "hadoop"],
  mobile: ["swift", "kotlin", "react native", "flutter", "ios", "android"],
  database: ["postgresql", "mysql", "mongodb", "sql", "redis", "dynamodb", "cassandra"],
};
AREA_SIGNALS.web = [...AREA_SIGNALS.frontend, ...AREA_SIGNALS.backend];
AREA_SIGNALS.databases = AREA_SIGNALS.database;
AREA_SIGNALS.apis = AREA_SIGNALS.api;

// Words that describe the kind of work rather than the area, as in "backend development" or "API design".
const AREA_FILLER = new Set(["development", "developer", "engineering", "design", "architecture", "operations", "programming", "systems", "services", "experience", "skills", "work"]);
const MIN_AREA_SIGNALS = 2;

/** The areas a broad skill names, or null when it isn't made only of area words, like "react" or "machine learning". */
const broadAreas = (skill: string): string[] | null => {
  const areas = normalizeSkill(skill).filter(word => !AREA_FILLER.has(word));
  return areas.length > 0 && areas.every(area => area in AREA_SIGNALS) ? areas : null;
};

/**
 * Matches a broad skill when the resume has at least two concrete skills from each area it names: Node.js and
 * PostgreSQL show "backend development". Evidence comes from those skills' own graded quotes.
 */
const matchBroadSkill = (jdSkill: string, candidateSkills: string[], evidence: SkillEvidence[]): SkillMatch | null => {
  const areas = broadAreas(jdSkill);
  if (!areas) return null;
  const shownBy: string[] = [];
  for (const area of areas) {
    const signals = candidateSkills.filter(skill => AREA_SIGNALS[area].some(signal => skillsMatch(signal, skill) === "matched"));
    const distinct = [...new Map(signals.map(s => [s.toLowerCase(), s])).values()];
    if (distinct.length < MIN_AREA_SIGNALS) return null;
    shownBy.push(...distinct.filter(s => !shownBy.includes(s)));
  }
  const best = evidence
    .filter(item => item.level !== "unverified" && shownBy.some(skill => skillsMatch(skill, item.skill) === "matched"))
    .sort((a, b) => EVIDENCE_RANK[b.level] - EVIDENCE_RANK[a.level])[0];
  return {
    skill: jdSkill, status: "matched", shownBy,
    evidence: best?.level ?? "unverified", quote: best?.quote ?? null,
  };
};

/** Cosine similarities at or below floor score 0, and at or above ceiling score 100. */
export interface SemanticCalibration { floor: number; ceiling: number }

/**
 * Measured by `npm run eval`. Unrelated resumes and jobs still have a cosine near 0.6 with gemini-embedding-001,
 * so the old (cosine + 1) / 2 mapping put every pair between 80 and 92. The eval suggested 0.562 and 0.828 from
 * 18 labelled pairs; these are rounded to avoid overfitting a small set. Re-measure after changing the embedding
 * model or the text that gets embedded.
 */
export const SEMANTIC_CALIBRATION: SemanticCalibration = { floor: 0.55, ceiling: 0.85 };

export const toSemanticScore = (similarity: number, { floor, ceiling }: SemanticCalibration = SEMANTIC_CALIBRATION): number =>
  Math.round(Math.min(Math.max((similarity - floor) / (ceiling - floor), 0), 1) * 100);

export const combineScores = (semanticScore: number, programmaticScore: number): number =>
  Math.min(Math.round(semanticScore * 0.6 + programmaticScore * 0.4), 100);

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
    const broad = best ? null : matchBroadSkill(jdSkill, candidateSkills, skillEvidence);
    matchedSkills.push(best
      ? { skill: jdSkill, status: best, ...strongestEvidence(jdSkill, best, skillEvidence) }
      : broad ?? { skill: jdSkill, status: "missing", evidence: null, quote: null });
    if (!best && !broad) missingRequired.push(jdSkill);
  }

  for (const jdSkill of jd.niceToHaveSkills) {
    if (!candidateSkills.some(rs => skillsMatch(jdSkill, rs)) && !matchBroadSkill(jdSkill, candidateSkills, skillEvidence)) {
      missingNiceToHave.push(jdSkill);
    }
  }

  const totalRequired = jd.requiredSkills.length;
  const programmaticScore = totalRequired === 0 ? 75 :
    Math.min(Math.round(matchedSkills.reduce((s, m) =>
      s + (m.status === "matched" ? 1 : m.status === "partial" ? 0.5 : 0), 0) / totalRequired * 100), 100);

  const semanticScore = toSemanticScore(cosineSimilarity(jdEmbedding, resumeEmbedding));
  const finalScore = combineScores(semanticScore, programmaticScore);

  return {
    programmaticScore, semanticScore, finalScore, matchedSkills,
    missingRequired, missingNiceToHave,
    yearsOfExperienceDelta: Math.round((resume.yearsOfExperience - jd.yearsOfExperience) * 10) / 10,
    hardChecks: runHardChecks(jd, resume),
  };
};
