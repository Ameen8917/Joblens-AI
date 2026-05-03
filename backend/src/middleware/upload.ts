import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("Only PDF files are accepted"));
};

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
