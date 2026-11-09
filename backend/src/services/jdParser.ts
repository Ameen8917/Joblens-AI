import { createHash } from "crypto";
import { z } from "zod";
import { generateStructured, generateEmbedding } from "../config/gemini";
import { AppError } from "../middleware/errorHandler";
import { Job, IJob } from "../models/Job";
import { ParsedJD } from "../types";

export const ParsedJDSchema = z.object({
  title: z.string().default("Unknown"),
  company: z.string().describe("Company name, or Unknown").default("Unknown"),
  roleType: z.enum(["IC", "Manager", "Lead", "Unknown"]).default("Unknown"),
  requiredSkills: z.array(z.string()).describe("Must-have skills, lowercase").default([]),
  niceToHaveSkills: z.array(z.string()).describe("Nice-to-have skills, lowercase").default([]),
  yearsOfExperience: z.number().describe("Minimum years required, or 0 if not stated").default(0),
  educationRequired: z.string().describe("Degree requirement, or empty string").default(""),
  tools: z.array(z.string()).describe("Specific tools and software, lowercase").default([]),
  culturalSignals: z.array(z.string()).describe("Culture and soft-skill signals").default([]),
  responsibilities: z.array(z.string()).describe("3-6 key responsibilities as action-verb phrases").default([]),
});

const buildJDPrompt = (rawText: string): string => `
You are a recruitment data extraction specialist. Extract structured information from the job description below.
JOB DESCRIPTION:
${rawText}
`;

const MONGO_DUPLICATE_KEY = 11000;

/** Ignores whitespace differences, so pasting the same job again counts as the same job. */
export const hashJobText = (rawText: string): string =>
  createHash("sha256").update(rawText.replace(/\s+/g, " ").trim()).digest("hex");

const toResult = (job: IJob): { jobId: string; parsed: ParsedJD } => ({ jobId: String(job._id), parsed: job.parsed });

export const parseJD = async (rawText: string): Promise<{ jobId: string; parsed: ParsedJD }> => {
  if (!rawText || rawText.trim().length < 50)
    throw new AppError("Job description too short (minimum 50 characters)", 400);
  const contentHash = hashJobText(rawText);
  const existing = await Job.findOne({ contentHash });
  if (existing) return toResult(existing);

  const data = await generateStructured(ParsedJDSchema, [{ text: buildJDPrompt(rawText) }]);
  const parsed: ParsedJD = { ...data, rawText };
  const embeddingText = [
    `Role: ${parsed.title}`,
    `Required skills: ${parsed.requiredSkills.join(", ")}`,
    `Tools: ${parsed.tools.join(", ")}`,
    `Responsibilities: ${parsed.responsibilities.join(". ")}`,
  ].join("\n");
  const embedding = await generateEmbedding(embeddingText);
  const job = new Job({ rawText, contentHash, parsed, embedding });
  try {
    await job.save();
  } catch (error) {
    // Two requests for the same text can both miss the lookup above. The unique index lets only one insert.
    if ((error as { code?: number }).code !== MONGO_DUPLICATE_KEY) throw error;
    const winner = await Job.findOne({ contentHash });
    if (!winner) throw error;
    return toResult(winner);
  }
  return { jobId: String(job._id), parsed };
};

export const getJobById = async (jobId: string): Promise<IJob> => {
  const job = await Job.findById(jobId);
  if (!job) throw new AppError(`Job not found: ${jobId}`, 404);
  return job;
};
