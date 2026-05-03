import express, { Application, Request, Response } from "express";
import cors from "cors";
import jobRoutes from "./routes/jobs";
import resumeRoutes from "./routes/resumes";
import analyzeRoutes from "./routes/analyze";
import { errorHandler } from "./middleware/errorHandler";

export const createApp = (): Application => {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok", service: "joblens-api", timestamp: new Date().toISOString() }));
  app.use("/api/jobs", jobRoutes);
  app.use("/api/resumes", resumeRoutes);
  app.use("/api/analyze", analyzeRoutes);
  app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: "Route not found" }));
  app.use(errorHandler);
  return app;
};
