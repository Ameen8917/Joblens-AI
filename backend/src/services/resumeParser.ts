import { z } from "zod";
import { generateStructured, generateEmbedding } from "../config/gemini";
import { AppError } from "../middleware/errorHandler";
import { Resume, IResume } from "../models/Resume";
import { ParsedResume } from "../types";
import { extractPdfText } from "../utils/pdfText";
import { gradeEvidence } from "./evidence";

export const ParsedResumeSchema = z.object({
  name: z.string().default("Unknown"),
  email: z.string().describe("Empty string if not present").default(""),
  location: z.string().describe("Where the candidate is based, as written. Empty string if not present").default(""),
  workAuthorization: z.string().describe("Visa or work-authorization status, as written. Empty string if not present").default(""),
  skills: z.array(z.string()).describe("Technical skills").default([]),
  tools: z.array(z.string()).describe("Tools and technologies").default([]),
  skillEvidence: z.array(z.object({
    skill: z.string().describe("One entry from skills or tools"),
    quote: z.string().describe("One complete line copied character for character from the resume that names this skill"),
    section: z.enum(["experience", "project", "education", "skills_list", "summary", "other"]).describe("The part of the resume the line comes from"),
  })).describe("One entry per skill and tool").default([]),
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

const RESUME_PROMPT = `You are a resume parser. Extract structured data from this resume PDF. Only include what the resume states.
For skillEvidence, cite the line that best proves each skill. Prefer a line describing work or a project over a skills list. Copy the line exactly, without shortening, paraphrasing or merging lines. Never invent a line. Leave out any skill you can't cite.`;

export const parseResume = async (pdfBuffer: Buffer): Promise<{ resumeId: string; parsed: ParsedResume }> => {
  const [data, rawText] = await Promise.all([
    generateStructured(ParsedResumeSchema, [
      { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } },
      { text: RESUME_PROMPT },
    ]),
    extractPdfText(pdfBuffer),
  ]);
  const parsed: ParsedResume = { ...data, skillEvidence: gradeEvidence(data.skillEvidence, rawText), rawText: "" };

  const embeddingText = [
    `Skills: ${parsed.skills.join(", ")}`,
    `Tools: ${parsed.tools.join(", ")}`,
    `Experience: ${parsed.yearsOfExperience} years`,
    `Work: ${parsed.workHistory.map(w => `${w.role} at ${w.company}`).join(", ")}`,
  ].join("\n");

  const embedding = await generateEmbedding(embeddingText);
  const resume = new Resume({ rawText, parsed, embedding });
  await resume.save();

  return { resumeId: (resume._id as unknown as string).toString(), parsed };
};

export const getResumeById = async (resumeId: string): Promise<IResume> => {
  const resume = await Resume.findById(resumeId);
  if (!resume) throw new AppError(`Resume not found: ${resumeId}`, 404);
  return resume;
};
