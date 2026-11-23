import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateStructured: vi.fn(), streamText: vi.fn() }));
vi.mock("../src/config/gemini", () => ({ generateStructured: mocks.generateStructured, streamText: mocks.streamText }));

import {
  buildFollowUpPrompt, buildReport, checkAnswerAgainstResume, EvaluationSchema, evaluateExchange, groundCriterion, measuresIn,
  planInterview, PlanSchema, streamFollowUp,
} from "../src/services/interview";
import { AnswerEvaluation, InterviewExchange, InterviewFocus, ParsedJD, ParsedResume } from "../src/types";
import { zodToGeminiSchema } from "../src/utils/zodToGeminiSchema";

const JD = {
  title: "Senior Backend Engineer", seniority: "senior", requiredSkills: ["node.js", "postgresql", "kubernetes"],
  niceToHaveSkills: [], tools: [], responsibilities: [],
} as unknown as ParsedJD;

const BULLET = "Cut PostgreSQL p95 latency from 900ms to 120ms, reducing database load by 40%";
const RESUME = {
  skills: ["Node.js", "PostgreSQL"], tools: ["Docker"], projects: [],
  workHistory: [{ company: "Shipfast", role: "Backend Engineer", duration: "2021 - 2024", highlights: ["Built order APIs in Node.js", BULLET] }],
} as unknown as ParsedResume;
const RAW_TEXT = `Skills: Node.js, PostgreSQL, Docker\nBuilt order APIs in Node.js\n${BULLET}`;

const CLAIM: InterviewFocus = { kind: "resume_claim", requirement: "postgresql", bulletId: "0-1", bullet: BULLET };

const exchange = (answers: string[], focus = CLAIM, followUpAsked = false): InterviewExchange => ({
  focus, followUpAsked, done: false, evaluation: null,
  turns: [
    { role: "interviewer", kind: "question", text: "Walk me through how you cut that latency." },
    ...answers.map(text => ({ role: "candidate" as const, kind: "answer" as const, text })),
  ],
});

const raw = (score: number, quotes: string[] = []) => ({ score, quotes, note: "Because." });
const modelEvaluation = (scores: [number, number, number], quotes: string[], followUp = false) => ({
  structure: raw(scores[0], quotes), specifics: raw(scores[1], quotes), relevance: raw(scores[2], quotes),
  followUp: { needed: followUp, reason: followUp ? "vague" : "none", focus: "" }, tip: "Name the index you added.",
});

describe("schemas", () => {
  it("convert to Gemini's response schema", () => {
    expect(() => zodToGeminiSchema(PlanSchema)).not.toThrow();
    expect(() => zodToGeminiSchema(EvaluationSchema)).not.toThrow();
  });
});

describe("measuresIn", () => {
  it("reads numbers with what they measure", () => {
    expect(measuresIn("from 900ms to 120 milliseconds, by 40 percent, 3x faster, 2 million users").map(m => `${m.value}${m.unit}`))
      .toEqual(["900ms", "120ms", "40%", "3x", "2million"]);
  });

  it("ignores numbers without a recognised measure", () => {
    expect(measuresIn("p95 latency on 1,200 retail stores in 2021")).toEqual([]);
  });
});

describe("checkAnswerAgainstResume", () => {
  const check = (answer: string, focus = CLAIM) => checkAnswerAgainstResume(answer, focus, JD, RESUME, RAW_TEXT);

  it("flags a different number for something the resume line measures", () => {
    expect(check("We brought p95 down to about 200ms.")).toEqual([
      expect.objectContaining({ kind: "contradiction", claim: "200ms" }),
    ]);
  });

  it("flags a differing figure even when another one matches", () => {
    expect(check("p95 was around 900ms and we got it down to 300ms.")).toEqual([
      expect.objectContaining({ kind: "contradiction", claim: "300ms" }),
    ]);
  });

  it("accepts an answer that repeats any of the resume's figures", () => {
    expect(check("Latency went from 900ms to 120ms, and load fell 40%.")).toEqual([]);
    expect(check("It ended at 120ms.")).toEqual([]);
  });

  it("ignores measures the resume line doesn't mention", () => {
    expect(check("It took 3 weeks.")).toEqual([]);
  });

  it("needs a resume line to compare numbers with", () => {
    expect(check("We cut it by 60%.", { kind: "behavioral", requirement: "", bulletId: null, bullet: null })).toEqual([]);
  });

  it("flags a skill the resume doesn't show", () => {
    expect(check("We ran it on Kubernetes with Docker.")).toEqual([
      expect.objectContaining({ kind: "not_on_resume", claim: "kubernetes" }),
    ]);
  });
});

describe("groundCriterion", () => {
  const answer = "I added a covering index on orders, which cut p95 latency to 120ms.";

  it("keeps quotes that are in the answer and drops invented ones", () => {
    const result = groundCriterion(raw(5, ["covering index on orders", "migrated to Aurora"]), answer);
    expect(result).toMatchObject({ score: 5, quotes: ["covering index on orders"], capped: false });
  });

  it("lowers a score above 3 to 3 when no quote can be confirmed", () => {
    expect(groundCriterion(raw(5, ["migrated to Aurora"]), answer)).toMatchObject({ score: 3, quotes: [], capped: true });
    expect(groundCriterion(raw(2), answer)).toMatchObject({ score: 2, capped: false });
  });
});

describe("evaluateExchange", () => {
  beforeEach(() => vi.resetAllMocks());

  it("combines the checked scores into an overall score", async () => {
    mocks.generateStructured.mockResolvedValue(modelEvaluation([5, 5, 5], ["covering index"]));
    const result = await evaluateExchange(JD, RESUME, RAW_TEXT, exchange(["I added a covering index and p95 hit 120ms."]));
    expect(result.overall).toBe(100);
    expect(result.followUp).toEqual({ needed: false, reason: "none" });
  });

  it("always follows up on a contradiction with the resume", async () => {
    mocks.generateStructured.mockResolvedValue(modelEvaluation([4, 4, 4], ["covering index"]));
    const result = await evaluateExchange(JD, RESUME, RAW_TEXT, exchange(["A covering index got p95 to 300ms."]));
    expect(result.followUp).toEqual({ needed: true, reason: "inconsistent" });
  });

  it("doesn't follow up on a strong answer, even when the model wants to", async () => {
    mocks.generateStructured.mockResolvedValue(modelEvaluation([5, 4, 5], ["covering index"], true));
    const result = await evaluateExchange(JD, RESUME, RAW_TEXT, exchange(["I added a covering index and p95 hit 120ms."]));
    expect(result.followUp).toEqual({ needed: false, reason: "none" });
  });

  it("follows up only once per question", async () => {
    mocks.generateStructured.mockResolvedValue(modelEvaluation([2, 1, 2], [], true));
    const result = await evaluateExchange(JD, RESUME, RAW_TEXT, exchange(["It was faster.", "Yes, much faster."], CLAIM, true));
    expect(result.followUp.needed).toBe(false);
  });

  it("caps a high score the model couldn't back with the candidate's words", async () => {
    mocks.generateStructured.mockResolvedValue(modelEvaluation([5, 5, 5], ["something they never said"]));
    const result = await evaluateExchange(JD, RESUME, RAW_TEXT, exchange(["It went well."]));
    expect([result.structure.score, result.specifics.score, result.relevance.score]).toEqual([3, 3, 3]);
    expect(result.overall).toBe(50);
  });
});

describe("planInterview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("takes the bullet text from the resume and checks bullet ids", async () => {
    mocks.generateStructured.mockResolvedValue({ questions: [
      { question: "How did you cut that latency?", kind: "resume_claim", requirement: "postgresql", bulletId: "0-1" },
      { question: "Tell me about the billing rewrite.", kind: "resume_claim", requirement: "", bulletId: "4-2" },
      { question: "How would you run this on Kubernetes?", kind: "job_requirement", requirement: "kubernetes", bulletId: "" },
      { question: "how would you run this on kubernetes?", kind: "job_requirement", requirement: "kubernetes", bulletId: "" },
    ] });
    const plan = await planInterview(JD, RESUME, 4);
    expect(plan.map(e => e.focus)).toEqual([
      { kind: "resume_claim", requirement: "postgresql", bulletId: "0-1", bullet: BULLET },
      { kind: "behavioral", requirement: "", bulletId: null, bullet: null },
      { kind: "job_requirement", requirement: "kubernetes", bulletId: null, bullet: null },
    ]);
    expect(plan[0].turns).toEqual([{ role: "interviewer", kind: "question", text: "How did you cut that latency?" }]);
  });

  it("stops at the requested number of questions and fails with none", async () => {
    mocks.generateStructured.mockResolvedValue({ questions: ["A?", "B?", "C?"].map(question => ({ question, kind: "behavioral", requirement: "", bulletId: "" })) });
    expect(await planInterview(JD, RESUME, 2)).toHaveLength(2);
    mocks.generateStructured.mockResolvedValue({ questions: [] });
    await expect(planInterview(JD, RESUME, 2)).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("follow-up", () => {
  const evaluation = (reason: AnswerEvaluation["followUp"]["reason"], consistency: AnswerEvaluation["consistency"] = []) =>
    ({ followUp: { needed: true, reason }, consistency } as unknown as AnswerEvaluation);

  it("tells the model about the resume line when the answer contradicts it", () => {
    const prompt = buildFollowUpPrompt(JD, exchange(["We got to 300ms."]), evaluation("inconsistent", [{ kind: "contradiction", claim: "300ms", detail: "" }]), "");
    expect(prompt).toContain(BULLET);
    expect(prompt).toContain("300ms");
  });

  it("returns the streamed question without surrounding quotes", async () => {
    mocks.streamText.mockImplementation(async (_prompt: string, onChunk: (t: string) => void) => {
      onChunk("\"What index"); onChunk(" did you add?\" ");
      return "\"What index did you add?\" ";
    });
    const chunks: string[] = [];
    expect(await streamFollowUp(JD, exchange(["It was faster."]), evaluation("vague"), "", c => chunks.push(c))).toBe("What index did you add?");
    expect(chunks).toHaveLength(2);
  });
});

describe("buildReport", () => {
  const scored = (overall: number, score: number, tip: string, consistency: AnswerEvaluation["consistency"] = []): InterviewExchange => ({
    ...exchange(["x"]), done: true,
    evaluation: {
      structure: { score, quotes: [], note: "", capped: false }, specifics: { score, quotes: [], note: "", capped: false },
      relevance: { score, quotes: [], note: "", capped: false }, overall, tip, consistency, followUp: { needed: false, reason: "none" },
    },
  });

  it("averages answered questions, ranks them, and leads with the weakest answers' tips", () => {
    const skipped = { ...exchange([]), done: true };
    const report = buildReport([scored(75, 4, "Tip A"), skipped, scored(25, 2, "Tip B", [{ kind: "contradiction", claim: "300ms", detail: "d" }])]);
    expect(report).toMatchObject({
      overall: 50, answered: 2, strongest: 0, weakest: 2,
      byCriterion: { structure: 50, specifics: 50, relevance: 50 },
      tips: ["Tip B", "Tip A"],
      consistency: [{ kind: "contradiction", claim: "300ms", detail: "d", question: 2 }],
    });
  });
});
