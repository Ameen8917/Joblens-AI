import { z } from "zod";
import { generateJSON } from "../config/gemini";
import { ParsedJD, ParsedResume, ScoreBreakdown, FitAnalysisOutput, GapAnalysisOutput, CoverLetterOutput, InterviewPrepOutput } from "../types";

const ctx = (jd: ParsedJD, resume: ParsedResume, score?: ScoreBreakdown) => `
JOB: ${JSON.stringify({ title: jd.title, company: jd.company, requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills, yearsOfExperience: jd.yearsOfExperience, tools: jd.tools, responsibilities: jd.responsibilities })}
RESUME: ${JSON.stringify({ name: resume.name, skills: resume.skills, tools: resume.tools, yearsOfExperience: resume.yearsOfExperience, workHistory: resume.workHistory, projects: resume.projects })}
${score ? `SCORE: ${score.finalScore}% | Missing: ${score.missingRequired.join(", ")}` : ""}`;

export const runFitAnalysis = async (jd: ParsedJD, resume: ParsedResume, score: ScoreBreakdown): Promise<FitAnalysisOutput> => {
  const Schema = z.object({ strengths: z.array(z.string()).length(3), gaps: z.array(z.string()).length(3), verdict: z.string() });
  const raw = await generateJSON<unknown>(`You are a senior recruiter. Analyze candidate fit.\n${ctx(jd, resume, score)}\nReturn JSON: { "strengths": ["3 specific strengths citing resume content"], "gaps": ["3 specific gaps relevant to JD"], "verdict": "one-line honest summary" }`);
  const result = Schema.safeParse(raw);
  if (!result.success) throw new Error(`Fit analysis failed: ${result.error.message}`);
  return { scoreBreakdown: score, ...result.data };
};

export const runGapAnalysis = async (jd: ParsedJD, resume: ParsedResume, score: ScoreBreakdown): Promise<GapAnalysisOutput> => {
  const Schema = z.object({ gaps: z.array(z.object({ skill: z.string(), priority: z.enum(["high", "medium", "low"]), reason: z.string(), suggestion: z.string() })) });
  const raw = await generateJSON<unknown>(`You are a career coach. Identify skill gaps and actionable fixes.\n${ctx(jd, resume, score)}\nMissing required: ${score.missingRequired.join(", ")}. Missing nice-to-have: ${score.missingNiceToHave.join(", ")}.\nReturn JSON: { "gaps": [{ "skill": "", "priority": "high|medium|low", "reason": "why it matters", "suggestion": "specific actionable fix" }] } ordered by priority.`);
  const result = Schema.safeParse(raw);
  if (!result.success) throw new Error(`Gap analysis failed: ${result.error.message}`);
  return result.data;
};

export const runCoverLetter = async (jd: ParsedJD, resume: ParsedResume): Promise<CoverLetterOutput> => {
  const Schema = z.object({ subject: z.string(), body: z.string() });
  const raw = await generateJSON<unknown>(`Write a 3-paragraph cover letter (200-280 words). Cite actual projects and skills. No generic phrases.\n${ctx(jd, resume)}\nReturn JSON: { "subject": "Application for [title] — [name]", "body": "full letter text" }`);
  const result = Schema.safeParse(raw);
  if (!result.success) throw new Error(`Cover letter failed: ${result.error.message}`);
  return { ...result.data, wordCount: result.data.body.split(/\s+/).length };
};

export const runInterviewPrep = async (jd: ParsedJD, resume: ParsedResume): Promise<InterviewPrepOutput> => {
  const Schema = z.object({ questions: z.array(z.object({ type: z.enum(["behavioral", "technical", "role-specific"]), question: z.string(), answerFramework: z.array(z.string()) })).min(8).max(10) });
  const raw = await generateJSON<unknown>(`Generate 9 interview questions (3 behavioral, 3 technical, 3 role-specific) with resume-specific answer frameworks.\n${ctx(jd, resume)}\nReturn JSON: { "questions": [{ "type": "", "question": "", "answerFramework": ["3-4 specific bullet tips"] }] }`);
  const result = Schema.safeParse(raw);
  if (!result.success) throw new Error(`Interview prep failed: ${result.error.message}`);
  return result.data;
};
