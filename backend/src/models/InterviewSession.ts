import mongoose, { Document, Schema } from "mongoose";
import { InterviewExchange, InterviewReport } from "../types";

export interface IInterviewSession extends Document {
  jobId: string;
  resumeId: string;
  status: "active" | "finished";
  exchanges: InterviewExchange[];
  report: InterviewReport | null;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSessionSchema = new Schema<IInterviewSession>(
  {
    jobId: { type: String, required: true },
    resumeId: { type: String, required: true },
    status: { type: String, enum: ["active", "finished"], default: "active" },
    // Stored whole and validated by the service that builds them. Call markModified("exchanges") after changing one.
    exchanges: { type: Schema.Types.Mixed, default: [] },
    report: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const InterviewSession = mongoose.model<IInterviewSession>("InterviewSession", InterviewSessionSchema);
