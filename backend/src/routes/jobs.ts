import { Router, Request, Response } from "express";
import { z } from "zod";
import { parseJD, getJobById } from "../services/jdParser";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/parse", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = z.object({ text: z.string().min(50) }).safeParse(req.body);
  if (!result.success) throw new AppError(result.error.errors[0].message, 400);
  const { jobId, parsed } = await parseJD(result.data.text);
  res.status(201).json({ success: true, jobId, parsed });
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const job = await getJobById(req.params.id);
  res.json({ success: true, jobId: job._id, parsed: job.parsed });
}));

export default router;
