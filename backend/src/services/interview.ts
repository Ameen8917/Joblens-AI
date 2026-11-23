import { z } from "zod";
import { generateStructured, streamText } from "../config/gemini";
import { AppError } from "../middleware/errorHandler";
import {
  AnswerEvaluation, ConsistencyFlag, CriterionScore, InterviewExchange, InterviewFocus, InterviewReport, ParsedJD, ParsedResume,
} from "../types";
import { toComparable } from "./evidence";
import { mentionsSkill, skillsMatch } from "./scorer";
import { bulletId, findBullet, skillVocabulary, wholeResumeText } from "./tailor";

export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 6;
export const DEFAULT_QUESTIONS = 4;
export const MAX_ANSWER_CHARS = 4000;

// ---------- Planning ----------

export const PlanSchema = z.object({
  questions: z.array(z.object({
    question: z.string().describe("What the interviewer asks, in one or two sentences"),
    kind: z.enum(["resume_claim", "job_requirement", "behavioral"]).describe("What the question probes"),
    requirement: z.string().describe("The job requirement it relates to, as the job states it, or empty string").default(""),
    bulletId: z.string().describe("For resume_claim, the id of the resume bullet it asks about, exactly as given. Otherwise empty string").default(""),
  })).describe("In the order to ask them"),
});

export const buildPlanPrompt = (jd: ParsedJD, resume: ParsedResume, count: number): string => {
  const bullets = resume.workHistory.map((w, wi) => [
    `ROLE: ${w.role} at ${w.company}${w.duration ? ` (${w.duration})` : ""}`,
    ...w.highlights.map((h, hi) => `[${bulletId(wi, hi)}] ${h}`),
  ].join("\n")).join("\n\n");
  return `You are a hiring manager planning a ${count}-question interview for this job with this candidate.
Mix the questions:
- About half ask the candidate to go deeper on a specific resume bullet that matters for the job (resume_claim). Ask how they did it, what they decided and what happened, not to repeat the bullet.
- One or two test a job requirement the resume shows least clearly (job_requirement).
- At most one is a behavioral question about working with others (behavioral).
Ask one thing per question. Don't reveal what a good answer would contain.

JOB: ${JSON.stringify({ title: jd.title, seniority: jd.seniority, requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills, responsibilities: jd.responsibilities })}

RESUME BULLETS:
${bullets || "(none)"}

OTHER RESUME FACTS: ${JSON.stringify({ skills: resume.skills, tools: resume.tools, projects: resume.projects })}`;
};

/** Plans the interview. Bullet ids are checked against the resume, and the bullet text comes from the resume itself. */
export const planInterview = async (jd: ParsedJD, resume: ParsedResume, count: number): Promise<InterviewExchange[]> => {
  const data = await generateStructured(PlanSchema, [{ text: buildPlanPrompt(jd, resume, count) }]);
  const seen = new Set<string>();
  const exchanges: InterviewExchange[] = [];
  for (const item of data.questions) {
    const text = item.question.trim();
    if (!text || seen.has(toComparable(text))) continue;
    seen.add(toComparable(text));
    const bullet = item.kind === "resume_claim" ? findBullet(resume, item.bulletId) : null;
    // A resume question pointing at a bullet that doesn't exist still works as a question, just without a line to check against.
    const kind: InterviewFocus["kind"] = item.kind === "resume_claim" && !bullet ? (item.requirement ? "job_requirement" : "behavioral") : item.kind;
    exchanges.push({
      focus: { kind, requirement: item.requirement.trim(), bulletId: bullet ? item.bulletId.trim() : null, bullet: bullet?.text ?? null },
      turns: [{ role: "interviewer", kind: "question", text }],
      evaluation: null, followUpAsked: false, done: false,
    });
  }
  if (exchanges.length === 0) throw new AppError("The AI service didn't plan any questions. Please try again.", 502);
  return exchanges.slice(0, count);
};

// ---------- Consistency with the resume ----------

const UNITS: [RegExp, string][] = [
  [/^(%|percent|per cent)$/, "%"],
  [/^(ms|milliseconds?)$/, "ms"],
  [/^(s|secs?|seconds?)$/, "s"],
  [/^(x|times)$/, "x"],
  [/^(minutes?|mins?)$/, "minutes"],
  [/^(hours?|hrs?)$/, "hours"],
  [/^(days?)$/, "days"],
  [/^(weeks?)$/, "weeks"],
  [/^(months?)$/, "months"],
  [/^(million|m)$/, "million"],
  [/^(billion|bn|b)$/, "billion"],
  [/^(k|thousand)$/, "thousand"],
  [/^(users|customers|shoppers|people|engineers|clients)$/, "people"],
  [/^(services|microservices|clusters|stores|regions)$/, "things"],
  [/^(tb|gb|pb)$/, "data"],
];

const MEASURE = /(\d+(?:[.,]\d+)?)\s*(%|[a-z]+)/gi;

/** Numbers with what they measure, as in "40%" or "900ms", so a different number for the same measure can be spotted. */
export const measuresIn = (text: string): { value: string; unit: string; raw: string }[] =>
  [...text.matchAll(MEASURE)].flatMap(match => {
    const unit = UNITS.find(([pattern]) => pattern.test(match[2].toLowerCase()))?.[1];
    return unit ? [{ value: match[1].replace(/,/g, ""), unit, raw: match[0].trim() }] : [];
  });

/**
 * Compares an answer with the resume. A number for the same measure as the resume line under discussion, but with
 * a value the line doesn't have, is a contradiction: "resume says 40%, you said 60%". A skill the resume doesn't show
 * anywhere is worth knowing about too, since an interviewer may ask for proof of it.
 */
export const checkAnswerAgainstResume = (
  answer: string, focus: InterviewFocus, jd: ParsedJD, resume: ParsedResume, resumeText: string,
): ConsistencyFlag[] => {
  const flags: ConsistencyFlag[] = [];
  if (focus.bullet) {
    const onResume = measuresIn(focus.bullet);
    const said = measuresIn(answer);
    for (const unit of new Set(onResume.map(m => m.unit))) {
      const resumeValues = onResume.filter(m => m.unit === unit);
      // Any differing figure counts: "from 900ms down to 300ms" contradicts "900ms to 120ms" even though 900ms matches.
      const differing = said.filter(m => m.unit === unit && !resumeValues.some(r => r.value === m.value));
      if (differing.length) {
        flags.push({
          kind: "contradiction", claim: differing.map(a => a.raw).join(", "),
          detail: `Your resume says ${resumeValues.map(r => r.raw).join(" and ")}, and you said ${differing.map(a => a.raw).join(" and ")}. Make sure the two agree.`,
        });
      }
    }
  }
  const everywhere = wholeResumeText(resume, resumeText);
  const candidateSkills = [...resume.skills, ...resume.tools];
  const flagged: string[] = [];
  for (const skill of skillVocabulary(jd, resume)) {
    if (!mentionsSkill(answer, skill) || flagged.some(f => skillsMatch(f, skill) || skillsMatch(skill, f))) continue;
    if (candidateSkills.some(s => skillsMatch(skill, s) === "matched") || mentionsSkill(everywhere, skill)) continue;
    flagged.push(skill);
    flags.push({ kind: "not_on_resume", claim: skill, detail: `You mentioned ${skill}, which isn't on your resume. If it's real, consider adding it. Either way, be ready for questions about it.` });
  }
  return flags;
};

// ---------- Scoring ----------

const criterion = (description: string) => z.object({
  score: z.number().int().min(1).max(5).describe(description),
  quotes: z.array(z.string()).describe("Up to 2 short phrases copied word for word from the candidate's answers that justify the score").default([]),
  note: z.string().describe("One sentence on why"),
});

export const EvaluationSchema = z.object({
  structure: criterion("1: no clear order. 3: some order, but the result or the candidate's part is unclear. 5: situation, what they did, and the result, in that order"),
  specifics: criterion("1: generic, could be anyone. 3: some detail, no numbers or tools. 5: concrete tools, decisions and numbers, clearly the candidate's own work"),
  relevance: criterion("1: doesn't answer the question. 3: partly answers it. 5: answers exactly what was asked and connects it to the job"),
  followUp: z.object({
    needed: z.boolean().describe("True if a real interviewer would ask a follow-up because the answer was vague, skipped part of the question, or raised something worth probing"),
    reason: z.enum(["vague", "incomplete", "none"]),
    focus: z.string().describe("What the follow-up should ask about, or empty string").default(""),
  }),
  tip: z.string().describe("One specific, actionable way to improve this answer"),
});

type Evaluated = z.output<typeof EvaluationSchema>;

const candidateText = (exchange: InterviewExchange): string =>
  exchange.turns.filter(t => t.role === "candidate").map(t => t.text).join("\n");

const transcript = (exchange: InterviewExchange): string =>
  exchange.turns.map(t => `${t.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE"}: ${t.text}`).join("\n");

const buildEvaluationPrompt = (jd: ParsedJD, exchange: InterviewExchange): string => `You are an experienced interviewer for the role of ${jd.title}${jd.seniority !== "unknown" ? ` (${jd.seniority} level)` : ""}. Score the candidate's answers in this exchange with the rubric. Be strict and fair: a short or generic answer can't score high on specifics.
${exchange.focus.bullet ? `The question is about this line from their resume: "${exchange.focus.bullet}"\n` : ""}${exchange.focus.requirement ? `It relates to the job requirement: ${exchange.focus.requirement}\n` : ""}
EXCHANGE:
${transcript(exchange)}

JOB REQUIREMENTS: ${JSON.stringify(jd.requiredSkills)}`;

const MIN_QUOTE_CHARS = 6;

/** Keeps only quotes that are really in the candidate's words. A score above 3 needs at least one. */
export const groundCriterion = (raw: Evaluated["structure"], answers: string): CriterionScore => {
  const said = toComparable(answers);
  const quotes = raw.quotes.map(q => q.trim()).filter(q => toComparable(q).length >= MIN_QUOTE_CHARS && said.includes(toComparable(q))).slice(0, 2);
  const capped = raw.score > 3 && quotes.length === 0;
  return { score: capped ? 3 : raw.score, quotes, note: raw.note.trim(), capped };
};

const FOLLOW_UP_BELOW = 3;

const toOverall = (scores: number[]): number => Math.round(((scores.reduce((a, b) => a + b, 0) / scores.length - 1) / 4) * 100);

/**
 * Scores an exchange. The model's quotes are checked against the candidate's own words, and the resume check is done
 * in code. A contradiction with the resume always earns a follow-up, and there's at most one follow-up per question.
 */
export const evaluateExchange = async (
  jd: ParsedJD, resume: ParsedResume, resumeText: string, exchange: InterviewExchange,
): Promise<AnswerEvaluation> => {
  const raw = await generateStructured(EvaluationSchema, [{ text: buildEvaluationPrompt(jd, exchange) }]);
  const answers = candidateText(exchange);
  const structure = groundCriterion(raw.structure, answers);
  const specifics = groundCriterion(raw.specifics, answers);
  const relevance = groundCriterion(raw.relevance, answers);
  const consistency = checkAnswerAgainstResume(answers, exchange.focus, jd, resume, resumeText);
  const contradicts = consistency.some(f => f.kind === "contradiction");
  // Follow-ups are for practice on weak spots, and each one costs a model call. The model asked one even after
  // answers it scored 5, 5, 5, so it only gets to when some criterion is 3 or below.
  const hasWeakSpot = [structure, specifics, relevance].some(c => c.score <= FOLLOW_UP_BELOW);
  const needed = !exchange.followUpAsked && (contradicts || (raw.followUp.needed && hasWeakSpot));
  return {
    structure, specifics, relevance,
    overall: toOverall([structure.score, specifics.score, relevance.score]),
    tip: raw.tip.trim(),
    consistency,
    followUp: { needed, reason: !needed ? "none" : contradicts ? "inconsistent" : raw.followUp.reason === "none" ? "vague" : raw.followUp.reason },
  };
};

// ---------- Follow-up ----------

const FOLLOW_UP_GOALS: Record<Exclude<AnswerEvaluation["followUp"]["reason"], "none">, string> = {
  vague: "The answer was vague. Ask for one concrete detail: what they personally did, a decision they made, or a number.",
  incomplete: "The answer skipped part of the question. Ask about the part they skipped.",
  inconsistent: "The answer gave a different number from their resume. Ask them, neutrally, to clarify which figure is right and how they measured it.",
};

export const buildFollowUpPrompt = (jd: ParsedJD, exchange: InterviewExchange, evaluation: AnswerEvaluation, focusHint: string): string => {
  const reason = evaluation.followUp.reason === "none" ? "vague" : evaluation.followUp.reason;
  const contradiction = evaluation.consistency.find(f => f.kind === "contradiction");
  return `You are interviewing a candidate for the role of ${jd.title}. Write the single follow-up question you'd ask next.
${FOLLOW_UP_GOALS[reason]}${focusHint ? `\nFocus on: ${focusHint}` : ""}${contradiction && exchange.focus.bullet ? `\nTheir resume says: "${exchange.focus.bullet}". They said: ${contradiction.claim}.` : ""}
Rules: one question, under 30 words, conversational. Don't praise, summarize or score the answer. Reply with the question only.

EXCHANGE SO FAR:
${transcript(exchange)}`;
};

/** Streams the follow-up question, and returns it without stray quotes or whitespace. */
export const streamFollowUp = async (
  jd: ParsedJD, exchange: InterviewExchange, evaluation: AnswerEvaluation, focusHint: string, onChunk: (text: string) => void,
): Promise<string> => {
  const text = await streamText(buildFollowUpPrompt(jd, exchange, evaluation, focusHint), onChunk);
  return text.trim().replace(/^["“]|["”]$/g, "").trim();
};

// ---------- Report ----------

const average = (values: number[]): number => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
const toPercent = (score: number): number => Math.round(((score - 1) / 4) * 100);

/** Built in code from the stored evaluations, so it costs no model call and can't disagree with them. */
export const buildReport = (exchanges: InterviewExchange[]): InterviewReport => {
  const scored = exchanges.map((e, question) => ({ e, question })).filter(({ e }) => e.evaluation);
  const evaluations = scored.map(({ e }) => e.evaluation!);
  const byOverall = [...scored].sort((a, b) => b.e.evaluation!.overall - a.e.evaluation!.overall);
  return {
    overall: average(evaluations.map(e => e.overall)),
    byCriterion: {
      structure: average(evaluations.map(e => toPercent(e.structure.score))),
      specifics: average(evaluations.map(e => toPercent(e.specifics.score))),
      relevance: average(evaluations.map(e => toPercent(e.relevance.score))),
    },
    strongest: byOverall.length > 1 ? byOverall[0].question : null,
    weakest: byOverall.length > 1 ? byOverall[byOverall.length - 1].question : null,
    answered: scored.length,
    consistency: scored.flatMap(({ e, question }) => e.evaluation!.consistency.map(flag => ({ ...flag, question }))),
    // The weakest answers' tips first, since those matter most.
    tips: [...byOverall].reverse().map(({ e }) => e.evaluation!.tip).filter(Boolean).slice(0, 3),
  };
};
