import mongoose, { Document, Schema } from "mongoose";
import { ParsedJD } from "../types";

export interface IJob extends Document {
  rawText: string;
  contentHash?: string;
  parsed: ParsedJD;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    rawText: { type: String, required: true },
    // Sparse so jobs stored before this field existed don't collide on a missing value.
    contentHash: { type: String, unique: true, sparse: true },
    parsed: {
      title: { type: String, default: "" },
      company: { type: String, default: "" },
      roleType: { type: String, enum: ["IC", "Manager", "Lead", "Unknown"], default: "Unknown" },
      seniority: { type: String, default: "unknown" },
      workMode: { type: String, default: "unknown" },
      locations: [String],
      visaSponsorship: { type: String, default: "unknown" },
      workAuthorizationRequired: { type: String, default: "" },
      requiredSkills: [String],
      niceToHaveSkills: [String],
      yearsOfExperience: { type: Number, default: 0 },
      educationRequired: { type: String, default: "" },
      educationLevel: { type: String, default: "none" },
      educationEquivalentAccepted: { type: Boolean, default: false },
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
