import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { AppError } from "./errorHandler";

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  file.mimetype === "application/pdf" ? cb(null, true) : cb(new AppError("Only PDF files are accepted", 400));
};

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
