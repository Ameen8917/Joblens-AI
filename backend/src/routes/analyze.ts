import { Router, Request, Response } from "express";
import { z } from "zod";
import { getJobById } from "../services/jdParser";
import { getResumeById } from "../services/resumeParser";
import { computeScore } from "../services/scorer";
import { runFitAnalysis, runGapAnalysis, runCoverLetter, runInterviewPrep } from "../services/modePrompts";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({ mode: z.enum(["fit", "gaps", "cover-letter", "interview"]), jobId: z.string().min(1), resumeId: z.string().min(1) }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.errors[0].message, 400);
  const { mode, jobId, resumeId } = body.data;
  const [job, resume] = await Promise.all([getJobById(jobId), getResumeById(resumeId)]);
  const score = computeScore(job.parsed, resume.parsed, job.embedding, resume.embedding);
  let data: unknown;
  if (mode === "fit") data = await runFitAnalysis(job.parsed, resume.parsed, score);
  else if (mode === "gaps") data = await runGapAnalysis(job.parsed, resume.parsed, score);
  else if (mode === "cover-letter") data = await runCoverLetter(job.parsed, resume.parsed);
  else if (mode === "interview") data = await runInterviewPrep(job.parsed, resume.parsed);
  else throw new AppError(`Unknown mode: ${mode}`, 400);
  res.json({ success: true, mode, data });
}));

router.post("/score-only", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({ jobId: z.string().min(1), resumeId: z.string().min(1) }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.errors[0].message, 400);
  const [job, resume] = await Promise.all([getJobById(body.data.jobId), getResumeById(body.data.resumeId)]);
  const scoreBreakdown = computeScore(job.parsed, resume.parsed, job.embedding, resume.embedding);
  res.json({ success: true, scoreBreakdown });
}));

export default router;
