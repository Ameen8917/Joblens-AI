import { z } from "zod";
import { generateStructured, generateEmbedding } from "../config/gemini";
import { AppError } from "../middleware/errorHandler";
import { Resume, IResume } from "../models/Resume";
import { ParsedResume } from "../types";

export const ParsedResumeSchema = z.object({
  name: z.string().default("Unknown"),
  email: z.string().describe("Empty string if not present").default(""),
  skills: z.array(z.string()).describe("Technical skills").default([]),
  tools: z.array(z.string()).describe("Tools and technologies").default([]),
  yearsOfExperience: z.number().describe("Total years of professional experience").default(0),
  experienceByDomain: z.array(z.object({
    domain: z.string().default(""),
    years: z.number().default(0),
  })).default([]),
  education: z.array(z.object({
    degree: z.string().default(""),
    field: z.string().default(""),
    institution: z.string().default(""),
  })).default([]),
  projects: z.array(z.object({
    name: z.string().default(""),
    description: z.string().default(""),
    techStack: z.array(z.string()).default([]),
  })).default([]),
  workHistory: z.array(z.object({
    company: z.string().default(""),
    role: z.string().default(""),
    duration: z.string().describe("As written on the resume, e.g. Jan 2021 - Mar 2023").default(""),
    highlights: z.array(z.string()).describe("Achievements and responsibilities, close to the resume's wording").default([]),
  })).default([]),
});

const RESUME_PROMPT = "You are a resume parser. Extract structured data from this resume PDF. Only include what the resume states.";

export const parseResume = async (pdfBuffer: Buffer): Promise<{ resumeId: string; parsed: ParsedResume }> => {
  const data = await generateStructured(ParsedResumeSchema, [
    { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } },
    { text: RESUME_PROMPT },
  ]);
  const parsed: ParsedResume = { ...data, rawText: "" };

  const embeddingText = [
    `Skills: ${parsed.skills.join(", ")}`,
    `Tools: ${parsed.tools.join(", ")}`,
    `Experience: ${parsed.yearsOfExperience} years`,
    `Work: ${parsed.workHistory.map(w => `${w.role} at ${w.company}`).join(", ")}`,
  ].join("\n");

  const embedding = await generateEmbedding(embeddingText);
  const resume = new Resume({ parsed, embedding });
  await resume.save();

  return { resumeId: (resume._id as unknown as string).toString(), parsed };
};

export const getResumeById = async (resumeId: string): Promise<IResume> => {
  const resume = await Resume.findById(resumeId);
  if (!resume) throw new AppError(`Resume not found: ${resumeId}`, 404);
  return resume;
};
