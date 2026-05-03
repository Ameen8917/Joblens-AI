// import pdfParse from "pdf-parse";
import { z } from "zod";
import { generateJSON, generateEmbedding, generateJSONFromPDF } from "../config/gemini";
import { Resume, IResume } from "../models/Resume";
import { ParsedResume } from "../types";

const ParsedResumeSchema = z.object({
  name: z.string().default("Unknown"),
  email: z.string().default(""),
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  yearsOfExperience: z.number().default(0),
  experienceByDomain: z.array(z.object({ domain: z.string(), years: z.number() })).default([]),
  education: z.array(z.object({ degree: z.string(), field: z.string(), institution: z.string() })).default([]),
  projects: z.array(z.object({ name: z.string(), description: z.string(), techStack: z.array(z.string()) })).default([]),
  workHistory: z.array(z.object({ company: z.string().default(""), role: z.string().default(""), duration: z.string().default(""), highlights: z.array(z.string()).default([]) })).default([]),
});

const buildResumePrompt = (): string => `
You are a resume parser. Extract structured data from this resume PDF.
Return ONLY valid JSON with no markdown, no explanation:
{
  "name": "string",
  "email": "string",
  "skills": ["array of technical skills"],
  "tools": ["array of tools and technologies"],
  "yearsOfExperience": number,
  "workHistory": [
    { "company": "string", "role": "string", "years": number }
  ],
  "education": [
    { "degree": "string", "field": "string", "year": number }
  ],
  "projects": ["array of project descriptions"]
}
`;

// export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
//   const data = await pdfParse(buffer);
//   const text = data.text.trim();
//   if (!text || text.length < 100)
//     throw new Error("PDF appears empty or unreadable (scanned PDFs not supported)");
//   return text;
// };

// services/resume.service.ts

export const parseResume = async (pdfBuffer: Buffer): Promise<{ resumeId: string; parsed: ParsedResume }> => {
  const raw = await generateJSONFromPDF<unknown>(pdfBuffer, buildResumePrompt());
  
  const result = ParsedResumeSchema.safeParse(raw);
  if (!result.success) throw new Error(`Resume parsing failed: ${result.error.message}`);
  
  const parsed: ParsedResume = { ...result.data, rawText: "" };
  
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
  if (!resume) throw new Error(`Resume not found: ${resumeId}`);
  return resume;
};
