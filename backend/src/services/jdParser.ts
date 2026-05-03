import { z } from "zod";
import { generateJSON, generateEmbedding } from "../config/gemini";
import { Job, IJob } from "../models/Job";
import { ParsedJD } from "../types";

const ParsedJDSchema = z.object({
  title: z.string().default("Unknown"),
  company: z.string().default("Unknown"),
  roleType: z.enum(["IC", "Manager", "Lead", "Unknown"]).default("Unknown"),
  requiredSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  yearsOfExperience: z.number().default(0),
  educationRequired: z.string().default(""),
  tools: z.array(z.string()).default([]),
  culturalSignals: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
});

const buildJDPrompt = (rawText: string): string => `
You are a recruitment data extraction specialist. Extract structured information from the job description below.
Return ONLY valid JSON — no markdown, no explanation:
{
  "title": "job title",
  "company": "company name or Unknown",
  "roleType": "IC | Manager | Lead | Unknown",
  "requiredSkills": ["must-have skills, lowercase"],
  "niceToHaveSkills": ["nice-to-have skills, lowercase"],
  "yearsOfExperience": 0,
  "educationRequired": "degree requirement or empty string",
  "tools": ["specific tools/software, lowercase"],
  "culturalSignals": ["culture/soft-skill signals"],
  "responsibilities": ["3-6 key responsibilities, action-verb phrases"]
}
JOB DESCRIPTION:
${rawText}
`;

export const parseJD = async (rawText: string): Promise<{ jobId: string; parsed: ParsedJD }> => {
  if (!rawText || rawText.trim().length < 50)
    throw new Error("Job description too short (minimum 50 characters)");
  const raw = await generateJSON<unknown>(buildJDPrompt(rawText));
  const result = ParsedJDSchema.safeParse(raw);
  if (!result.success) throw new Error(`JD parsing failed: ${result.error.message}`);
  const parsed: ParsedJD = { ...result.data, rawText };
  const embeddingText = [
    `Role: ${parsed.title}`,
    `Required skills: ${parsed.requiredSkills.join(", ")}`,
    `Tools: ${parsed.tools.join(", ")}`,
    `Responsibilities: ${parsed.responsibilities.join(". ")}`,
  ].join("\n");
  const embedding = await generateEmbedding(embeddingText);
  const job = new Job({ rawText, parsed, embedding });
  await job.save();
  return { jobId: (job._id as unknown as string).toString(), parsed };
};

export const getJobById = async (jobId: string): Promise<IJob> => {
  const job = await Job.findById(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  return job;
};
