import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { getJobById } from "../services/jdParser";
import { getResumeById } from "../services/resumeParser";
import { exportResume } from "../services/resumeExport";
import { applyEdits, assertValidEdits, MAX_BULLET_CHARS, scoreTailored, suggestRewrites } from "../services/tailor";
import { ParsedResume } from "../types";

const router = Router();

const ids = { jobId: z.string().min(1), resumeId: z.string().min(1) };

const load = async (jobId: string, resumeId: string) => {
  const [job, resume] = await Promise.all([getJobById(jobId), getResumeById(resumeId)]);
  // A plain copy, so the tailored version can be built by spreading it without touching the stored document.
  return { job, resume, parsed: resume.toObject().parsed as ParsedResume };
};

router.post("/suggest", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object(ids).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.issues[0].message, 400);
  const { job, resume, parsed } = await load(body.data.jobId, body.data.resumeId);
  res.json({ success: true, ...(await suggestRewrites(job.parsed, parsed, resume.rawText)) });
}));

const editsSchema = z.array(z.object({
  id: z.string().min(1),
  rewritten: z.string().trim().min(1, "A rewritten bullet can't be empty").max(MAX_BULLET_CHARS, `Keep each bullet under ${MAX_BULLET_CHARS} characters`),
})).max(50);

router.post("/score", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({ ...ids, edits: editsSchema }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.issues[0].message, 400);
  const { job, resume, parsed } = await load(body.data.jobId, body.data.resumeId);
  res.json({ success: true, ...(await scoreTailored(job.parsed, job.embedding, parsed, resume.rawText, body.data.edits)) });
}));

/**
 * Downloads the resume with the accepted rewrites. Unlike the score, the export includes rewrites with flagged
 * claims: the document is the candidate's, and the screen warns them before they download it.
 */
router.post("/export", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({ resumeId: ids.resumeId, edits: editsSchema, format: z.enum(["pdf", "docx"]) }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.issues[0].message, 400);
  const resume = await getResumeById(body.data.resumeId);
  const parsed = resume.toObject().parsed as ParsedResume;
  assertValidEdits(parsed, body.data.edits);
  const { buffer, fileName, contentType } = await exportResume(applyEdits(parsed, body.data.edits), body.data.format);
  res.set({ "Content-Type": contentType, "Content-Disposition": `attachment; filename="${fileName}"`, "Content-Length": String(buffer.length) });
  res.send(buffer);
}));

export default router;
