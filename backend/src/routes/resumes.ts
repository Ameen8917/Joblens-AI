import { Router, Request, Response } from "express";
import { parseResume, getResumeById } from "../services/resumeParser";
import { upload } from "../middleware/upload";
import { asyncHandler, AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/parse", upload.single("resume"), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new AppError("No PDF file uploaded. Use field name 'resume'", 400);
  const { resumeId, parsed } = await parseResume(req.file.buffer);
  res.status(201).json({ success: true, resumeId, parsed });
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const resume = await getResumeById(req.params.id);
  res.json({ success: true, resumeId: resume._id, parsed: resume.parsed });
}));

export default router;
