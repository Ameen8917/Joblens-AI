import mongoose, { Document, Schema } from "mongoose";
import { ParsedResume } from "../types";

export interface IResume extends Document {
  rawText: string;
  parsed: ParsedResume;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>(
  {
    rawText: { type: String, required: false, default: "" },
    parsed: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      location: { type: String, default: "" },
      workAuthorization: { type: String, default: "" },
      skills: [String],
      tools: [String],
      skillEvidence: [{ skill: String, quote: String, section: String, level: String }],
      yearsOfExperience: { type: Number, default: 0 },
      experienceByDomain: [{ domain: String, years: Number }],
      education: [{ degree: String, field: String, institution: String }],
      projects: [{ name: String, description: String, techStack: [String] }],
      workHistory: [{ company: String, role: String, duration: String, highlights: [String] }],
      rawText: { type: String, default: "" },
    },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export const Resume = mongoose.model<IResume>("Resume", ResumeSchema);
