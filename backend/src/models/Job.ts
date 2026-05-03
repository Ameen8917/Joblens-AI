import mongoose, { Document, Schema } from "mongoose";
import { ParsedJD } from "../types";

export interface IJob extends Document {
  rawText: string;
  parsed: ParsedJD;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    rawText: { type: String, required: true },
    parsed: {
      title: { type: String, default: "" },
      company: { type: String, default: "" },
      roleType: { type: String, enum: ["IC", "Manager", "Lead", "Unknown"], default: "Unknown" },
      requiredSkills: [String],
      niceToHaveSkills: [String],
      yearsOfExperience: { type: Number, default: 0 },
      educationRequired: { type: String, default: "" },
      tools: [String],
      culturalSignals: [String],
      responsibilities: [String],
      rawText: { type: String, default: "" },
    },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJob>("Job", JobSchema);
