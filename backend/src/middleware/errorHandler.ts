import { Request, Response, NextFunction } from "express";
import { ApiError } from "../types";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (err.name === "MulterError") { res.status(400).json({ success: false, error: "File upload error", details: err.message } as ApiError); return; }
  if (err instanceof AppError) { res.status(err.statusCode).json({ success: false, error: err.message } as ApiError); return; }
  if (err.name === "CastError") { res.status(400).json({ success: false, error: "Invalid ID format" } as ApiError); return; }
  res.status(500).json({ success: false, error: "Internal server error", details: process.env.NODE_ENV === "development" ? err.message : undefined } as ApiError);
};
