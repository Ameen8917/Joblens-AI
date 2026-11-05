import { z } from "zod";
import { generateStructured } from "../config/gemini";
import { ParsedJD, ParsedResume, ScoreBreakdown, FitAnalysisOutput, GapAnalysisOutput, CoverLetterOutput, InterviewPrepOutput } from "../types";

const ctx = (jd: ParsedJD, resume: ParsedResume, score?: ScoreBreakdown) => `
JOB: ${JSON.stringify({ title: jd.title, company: jd.company, requiredSkills: jd.requiredSkills, niceToHaveSkills: jd.niceToHaveSkills, yearsOfExperience: jd.yearsOfExperience, tools: jd.tools, responsibilities: jd.responsibilities })}
RESUME: ${JSON.stringify({ name: resume.name, skills: resume.skills, tools: resume.tools, yearsOfExperience: resume.yearsOfExperience, workHistory: resume.workHistory, projects: resume.projects })}
${score ? `SCORE: ${score.finalScore}% | Missing: ${score.missingRequired.join(", ")}` : ""}`;

export const FitSchema = z.object({
  strengths: z.array(z.string()).length(3).describe("Exactly 3 specific strengths citing resume content"),
  gaps: z.array(z.string()).length(3).describe("Exactly 3 specific gaps relevant to the job"),
  verdict: z.string().describe("One-line honest summary"),
});

export const GapSchema = z.object({
  gaps: z.array(z.object({
    skill: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    reason: z.string().describe("Why it matters"),
    suggestion: z.string().describe("Specific actionable fix"),
  })).describe("Ordered by priority, highest first"),
});

export const CoverLetterSchema = z.object({
  subject: z.string().describe("Application for [title] — [name]"),
  body: z.string().describe("Full letter text"),
});

export const InterviewSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(["behavioral", "technical", "role-specific"]),
    question: z.string(),
    answerFramework: z.array(z.string()).describe("3-4 specific bullet tips"),
  })).min(8).max(10).describe("Exactly 9 questions"),
});

export const runFitAnalysis = async (jd: ParsedJD, resume: ParsedResume, score: ScoreBreakdown): Promise<FitAnalysisOutput> => {
  const data = await generateStructured(FitSchema, [{ text: `You are a senior recruiter. Analyze candidate fit.\n${ctx(jd, resume, score)}` }]);
  return { scoreBreakdown: score, ...data };
};

export const runGapAnalysis = async (jd: ParsedJD, resume: ParsedResume, score: ScoreBreakdown): Promise<GapAnalysisOutput> =>
  generateStructured(GapSchema, [{ text: `You are a career coach. Identify skill gaps and actionable fixes.\n${ctx(jd, resume, score)}\nMissing required: ${score.missingRequired.join(", ")}. Missing nice-to-have: ${score.missingNiceToHave.join(", ")}.` }]);

export const runCoverLetter = async (jd: ParsedJD, resume: ParsedResume): Promise<CoverLetterOutput> => {
  const data = await generateStructured(CoverLetterSchema, [{ text: `Write a 3-paragraph cover letter (200-280 words). Cite actual projects and skills. No generic phrases.\n${ctx(jd, resume)}` }]);
  return { ...data, wordCount: data.body.split(/\s+/).length };
};

export const runInterviewPrep = async (jd: ParsedJD, resume: ParsedResume): Promise<InterviewPrepOutput> =>
  generateStructured(InterviewSchema, [{ text: `Generate 9 interview questions (3 behavioral, 3 technical, 3 role-specific) with resume-specific answer frameworks.\n${ctx(jd, resume)}` }]);
