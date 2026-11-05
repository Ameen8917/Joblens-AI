import { describe, expect, it } from "vitest";
import { SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { zodToGeminiSchema } from "../src/utils/zodToGeminiSchema";
import { ParsedResumeSchema } from "../src/services/resumeParser";
import { ParsedJDSchema } from "../src/services/jdParser";
import { CoverLetterSchema, FitSchema, GapSchema, InterviewSchema } from "../src/services/modePrompts";

describe("zodToGeminiSchema", () => {
  it("converts nested objects, arrays, enums, defaults and descriptions", () => {
    const schema = z.object({
      name: z.string().describe("Full name").default("Unknown"),
      level: z.enum(["a", "b"]),
      items: z.array(z.object({ n: z.number() })).default([]),
    });
    expect(zodToGeminiSchema(schema)).toEqual({
      type: SchemaType.OBJECT,
      required: ["name", "level", "items"],
      properties: {
        name: { type: SchemaType.STRING, description: "Full name" },
        level: { type: SchemaType.STRING, format: "enum", enum: ["a", "b"] },
        items: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.OBJECT, required: ["n"], properties: { n: { type: SchemaType.NUMBER } } },
        },
      },
    });
  });

  it("requests the fields the resume schema validates", () => {
    const resume = zodToGeminiSchema(ParsedResumeSchema);
    expect(resume.properties?.education.items?.required).toEqual(["degree", "field", "institution"]);
    expect(resume.properties?.projects.items?.type).toBe(SchemaType.OBJECT);
    expect(resume.properties?.workHistory.items?.required).toContain("highlights");
  });

  it.each([
    ["resume", ParsedResumeSchema],
    ["job", ParsedJDSchema],
    ["fit", FitSchema],
    ["gaps", GapSchema],
    ["cover letter", CoverLetterSchema],
    ["interview", InterviewSchema],
  ])("can convert the %s schema", (_name, schema) => {
    expect(() => zodToGeminiSchema(schema)).not.toThrow();
  });

  it("rejects types it can't represent", () => {
    expect(() => zodToGeminiSchema(z.date())).toThrow(/Unsupported/);
  });
});
