import { z } from "zod";
import { generateEmbedding, generateStructured } from "../config/gemini";
import { AppError } from "../middleware/errorHandler";
import { BulletRewrite, ClaimFlag, ParsedJD, ParsedResume, TailoredScore, TailoringSuggestions } from "../types";
import { toComparable } from "./evidence";
import { resumeEmbeddingText } from "./resumeParser";
import { computeScore, mentionsSkill, skillsMatch } from "./scorer";

export const MAX_REWRITES = 6;
export const MAX_BULLET_CHARS = 400;

export const RewriteSchema = z.object({
  rewrites: z.array(z.object({
    bulletId: z.string().describe("The id of the bullet being rewritten, exactly as given, e.g. 0-2"),
    rewritten: z.string().describe("The new bullet text"),
    targetSkills: z.array(z.string()).describe("Job skills this rewrite makes clearer").default([]),
    reason: z.string().describe("One short sentence on why this reads better for the job"),
  })).describe(`At most ${MAX_REWRITES}, most useful first`).default([]),
});

type WorkEntry = ParsedResume["workHistory"][number];

const bulletId = (work: number, highlight: number): string => `${work}-${highlight}`;

const findBullet = (resume: ParsedResume, id: string): { work: WorkEntry; text: string } | null => {
  const match = /^(\d+)-(\d+)$/.exec(id.trim());
  if (!match) return null;
  const work = resume.workHistory[Number(match[1])];
  const text = work?.highlights[Number(match[2])];
  return text === undefined ? null : { work, text };
};

/** Everything the resume says about one role, which is what a rewrite of one of its bullets may draw on. */
const roleText = (work: WorkEntry): string => [work.role, work.company, work.duration, ...work.highlights].join("\n");

/** Falls back to the parsed fields when the PDF text isn't available. */
const wholeResumeText = (resume: ParsedResume, rawText: string): string => rawText.trim() || [
  ...resume.skills, ...resume.tools,
  ...resume.workHistory.map(roleText),
  ...resume.projects.map(p => [p.name, p.description, ...p.techStack].join(" ")),
].join("\n");

/** The skills a rewrite is likely to name: the job's, which the model is asked to bring out, and the resume's own. */
const skillVocabulary = (jd: ParsedJD, resume: ParsedResume): string[] =>
  [...new Set([...jd.requiredSkills, ...jd.niceToHaveSkills, ...jd.tools, ...resume.skills, ...resume.tools]
    .map(s => s.trim().toLowerCase()).filter(Boolean))];

const NUMBER = /\d+(?:[.,]\d+)*/g;
const numbersIn = (text: string): Set<string> => new Set((text.match(NUMBER) ?? []).map(n => n.replace(/,/g, "")));

const sameSkill = (a: string, b: string): boolean => skillsMatch(a, b) === "matched" || skillsMatch(b, a) === "matched";

// Verbs that claim ownership or leadership. A rewrite may use one only if the original bullet does.
const SCOPE_VERBS = ["led", "owned", "managed", "architected", "spearheaded", "headed", "directed", "oversaw", "mentored", "designed"];
// Benefits a rewrite can claim without stating anything checkable, as in "improving reliability". The optional
// second pattern is concrete evidence in the original that backs the benefit, such as a latency drop for performance.
const OUTCOMES: [string, RegExp, RegExp?][] = [
  ["reliability", /\breliab(?:le|ility)\b/i, /\buptime\b|\bincidents?\b|\boutages?\b|\bfailover\b|\berror rates?\b|\bdowntime\b/i],
  ["scalability", /\bscalab(?:le|ility)\b/i, /\bscal(?:e|ed|ing)\b|\b\d[\d,.]*\s*(?:k|m|million|billion)?\s*(?:requests|users|transactions|events)\b/i],
  ["performance", /\bperformance\b|\bperformant\b/i, /\blatency\b|\bfaster\b|\bspeed\b|\bthroughput\b|\bload times?\b|\bp\d{2}\b/i],
  ["efficiency", /\befficien(?:t|tly|cy)\b/i, /\bcut\b|\breduc(?:e|ed|ing)\b|\bsav(?:e|ed|ing)\b/i],
  ["productivity", /\bproductiv(?:e|ity)\b/i],
  ["maintainability", /\bmaintainab(?:le|ility)\b/i],
  ["availability", /\b(?:high|highly)[ -]availab(?:le|ility)\b|\buptime\b/i],
  ["stability", /\bstab(?:le|ility)\b/i],
  ["security", /\bsecur(?:e|ity)\b/i],
  ["user experience", /\buser experience\b|\bux\b/i],
  ["customer satisfaction", /\bcustomer satisfaction\b/i],
  ["quality", /\b(?:code|software|product) quality\b/i],
];

const wordsIn = (text: string): Set<string> => new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);

/**
 * Compares what a rewrite claims with its original bullet, its role and the rest of the resume. The model is told
 * to add nothing and drop nothing, but it is never trusted to report its own changes, the same way it never vouches
 * for its own quotes.
 */
export const checkClaims = (
  original: string, rewritten: string, work: WorkEntry, resume: ParsedResume, resumeText: string, vocabulary: string[],
): ClaimFlag[] => {
  const role = roleText(work);
  const everywhere = wholeResumeText(resume, resumeText);
  const flags: ClaimFlag[] = [];

  const rewrittenNumbers = numbersIn(rewritten);
  const roleNumbers = numbersIn(role);
  const resumeNumbers = numbersIn(everywhere);
  for (const number of rewrittenNumbers) {
    if (roleNumbers.has(number)) continue;
    flags.push(resumeNumbers.has(number)
      ? { kind: "number", claim: number, severity: "check", detail: `${number} appears elsewhere on your resume, not in this role. Keep it only if it describes this work.` }
      : { kind: "number", claim: number, severity: "unsupported", detail: `${number} isn't on your resume. Add a number only if it's real.` });
  }

  const candidateSkills = [...resume.skills, ...resume.tools];
  const skillFlags = vocabulary
    .filter(skill => mentionsSkill(rewritten, skill) && !mentionsSkill(role, skill))
    .map((skill): ClaimFlag => {
      const elsewhere = candidateSkills.some(s => skillsMatch(skill, s) === "matched") || mentionsSkill(everywhere, skill);
      return elsewhere
        ? { kind: "skill", claim: skill, severity: "check", detail: `Your resume shows ${skill} elsewhere, not in this role. Keep it only if you used it here.` }
        : { kind: "skill", claim: skill, severity: "unsupported", detail: `${skill} isn't on your resume, so this claims something it can't back up.` };
    })
    .sort((a, b) => Number(b.severity === "unsupported") - Number(a.severity === "unsupported"));
  // "MySQL" also counts as "sql", which would raise the same problem twice. Keep the more serious of the two.
  for (const flag of skillFlags) if (!flags.some(f => f.kind === "skill" && sameSkill(f.claim, flag.claim))) flags.push(flag);

  const originalWords = wordsIn(original);
  const rewrittenWords = wordsIn(rewritten);
  for (const verb of SCOPE_VERBS) {
    if (rewrittenWords.has(verb) && !originalWords.has(verb)) {
      flags.push({ kind: "scope", claim: verb, severity: "check", detail: `"${verb[0].toUpperCase()}${verb.slice(1)}" claims more responsibility than the original. Keep it only if it's accurate.` });
    }
  }

  for (const [outcome, pattern, evidence] of OUTCOMES) {
    if (pattern.test(rewritten) && !pattern.test(original) && !evidence?.test(original)) {
      flags.push({ kind: "outcome", claim: outcome, severity: "check", detail: `This says the work improved ${outcome}, which the original doesn't. Keep it only if you can back it up.` });
    }
  }

  for (const number of numbersIn(original)) {
    if (!rewrittenNumbers.has(number)) flags.push({ kind: "number", claim: number, severity: "dropped", detail: `The original shows ${number}, and this rewrite leaves it out.` });
  }
  // Longest first, so dropping "React Testing Library" is reported once rather than again as "react".
  const droppedSkills: string[] = [];
  for (const skill of [...vocabulary].sort((a, b) => b.length - a.length)) {
    if (!mentionsSkill(original, skill) || mentionsSkill(rewritten, skill) || droppedSkills.some(d => skillsMatch(d, skill))) continue;
    droppedSkills.push(skill);
    flags.push({ kind: "skill", claim: skill, severity: "dropped", detail: `The original shows ${skill}, and this rewrite leaves it out.` });
  }
  return flags;
};

const buildRewritePrompt = (jd: ParsedJD, resume: ParsedResume): string => {
  const bullets = resume.workHistory.map((w, wi) => [
    `ROLE: ${w.role} at ${w.company}${w.duration ? ` (${w.duration})` : ""}`,
    ...w.highlights.map((h, hi) => `[${bulletId(wi, hi)}] ${h}`),
  ].join("\n")).join("\n\n");

  return `You are a resume editor. Rewrite up to ${MAX_REWRITES} work bullets so they show this job's requirements more clearly.
Rules:
- Refer to each bullet by its id in square brackets.
- Use only facts this role's bullets state. Never add a number, skill, tool, team size, title or result they don't state.
- Keep every number, skill and tool the original bullet names. Reword around them, never drop them.
- Keep the original's level of responsibility. Don't turn "built" or "worked on" into "led", "owned" or "designed".
- Use the job's wording for a skill the bullet already shows, e.g. "PostgreSQL" where the bullet says "Postgres".
- Start with a strong action verb, put the most relevant part first, and keep each bullet under 30 words.
- Skip bullets that already read well for this job. Fewer good rewrites beat many weak ones.

JOB: ${JSON.stringify({ title: jd.title, requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills, tools: jd.tools, responsibilities: jd.responsibilities })}

WORK HISTORY:
${bullets}

OTHER RESUME FACTS: ${JSON.stringify({ skills: resume.skills, tools: resume.tools, projects: resume.projects })}`;
};

export const suggestRewrites = async (jd: ParsedJD, resume: ParsedResume, resumeText: string): Promise<TailoringSuggestions> => {
  if (!resume.workHistory.some(w => w.highlights.length)) return { rewrites: [], discarded: 0 };
  const data = await generateStructured(RewriteSchema, [{ text: buildRewritePrompt(jd, resume) }]);

  const vocabulary = skillVocabulary(jd, resume);
  const rewrites: BulletRewrite[] = [];
  let discarded = 0;
  for (const item of data.rewrites) {
    const id = item.bulletId.trim();
    const bullet = findBullet(resume, id);
    const rewritten = item.rewritten.trim();
    if (!bullet || rewrites.some(r => r.id === id) || !rewritten || rewritten.length > MAX_BULLET_CHARS
      || toComparable(rewritten) === toComparable(bullet.text)) {
      discarded++;
      continue;
    }
    rewrites.push({
      id, company: bullet.work.company, role: bullet.work.role, original: bullet.text, rewritten,
      targetSkills: item.targetSkills, reason: item.reason,
      flags: checkClaims(bullet.text, rewritten, bullet.work, resume, resumeText, vocabulary),
    });
  }
  return { rewrites: rewrites.slice(0, MAX_REWRITES), discarded };
};

export interface BulletEdit { id: string; rewritten: string }

/** Rejects edits to bullets that don't exist, or to the same bullet twice. */
export const assertValidEdits = (resume: ParsedResume, edits: BulletEdit[]): void => {
  for (const edit of edits) {
    if (!findBullet(resume, edit.id)) throw new AppError(`No bullet with id ${edit.id}`, 400);
    if (edits.filter(e => e.id === edit.id).length > 1) throw new AppError(`Bullet ${edit.id} is edited more than once`, 400);
  }
};

/** Copies the resume with the given bullets replaced. */
export const applyEdits = (resume: ParsedResume, edits: BulletEdit[]): ParsedResume => ({
  ...resume,
  workHistory: resume.workHistory.map((w, wi) => ({
    ...w,
    highlights: w.highlights.map((h, hi) => edits.find(e => e.id === bulletId(wi, hi))?.rewritten ?? h),
  })),
});

/**
 * Scores the resume with the accepted rewrites. Claims are checked again here because the candidate can edit the
 * text, and a rewrite with an unsupported claim doesn't count towards the score, so inventing things can't raise it.
 * Both versions are embedded the same way, so the change reflects the edits and nothing else.
 */
export const scoreTailored = async (
  jd: ParsedJD, jdEmbedding: number[], resume: ParsedResume, resumeText: string, edits: BulletEdit[],
): Promise<TailoredScore> => {
  const vocabulary = skillVocabulary(jd, resume);
  assertValidEdits(resume, edits);
  const checked = edits.map(edit => {
    const bullet = findBullet(resume, edit.id)!;
    const flags = checkClaims(bullet.text, edit.rewritten, bullet.work, resume, resumeText, vocabulary);
    return { ...edit, flags, counted: !flags.some(f => f.severity === "unsupported") };
  });
  const counted = checked.filter(e => e.counted);

  const beforeText = resumeEmbeddingText(resume);
  const tailored = applyEdits(resume, counted);
  const afterText = resumeEmbeddingText(tailored);
  const [beforeEmbedding, afterEmbedding] = await Promise.all([
    generateEmbedding(beforeText),
    afterText === beforeText ? null : generateEmbedding(afterText),
  ]);

  const before = computeScore(jd, resume, jdEmbedding, beforeEmbedding);
  const after = afterEmbedding ? computeScore(jd, tailored, jdEmbedding, afterEmbedding) : before;
  const evidenceUpgrades = before.matchedSkills
    .filter(m => m.status !== "missing" && m.evidence !== "demonstrated" && counted.some(e => mentionsSkill(e.rewritten, m.skill)))
    .map(m => m.skill);

  return { before, after, edits: checked.map(({ id, flags, counted: c }) => ({ id, flags, counted: c })), evidenceUpgrades };
};
