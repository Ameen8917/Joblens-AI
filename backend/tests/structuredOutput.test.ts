import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InvalidStructuredOutputError, parseStructuredOutput, requestStructuredOutput } from "../src/utils/structuredOutput";
import { withRetry } from "../src/utils/retry";
import { isRetryableGeminiError, toAppError } from "../src/config/gemini";
import { ParsedResumeSchema } from "../src/services/resumeParser";
import { FitSchema } from "../src/services/modePrompts";

const noSleep = async () => {};
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("parseStructuredOutput", () => {
  it("accepts a resume with education and projects", () => {
    const parsed = parseStructuredOutput(JSON.stringify({
      name: "A",
      education: [{ degree: "BS", field: "CS", institution: "MIT" }],
      projects: [{ name: "P", description: "D", techStack: ["react"] }],
      workHistory: [{ company: "X", role: "Dev", duration: "2020-2022", highlights: ["Shipped"] }],
    }), ParsedResumeSchema);
    expect(parsed.education[0].institution).toBe("MIT");
    expect(parsed.projects[0].techStack).toEqual(["react"]);
    expect(parsed.workHistory[0].highlights).toEqual(["Shipped"]);
  });

  it("applies defaults when the model returns nulls", () => {
    const parsed = parseStructuredOutput(
      JSON.stringify({ name: "A", email: null, yearsOfExperience: null, skills: ["go", null], education: [{ degree: null }] }),
      ParsedResumeSchema
    );
    expect(parsed.email).toBe("");
    expect(parsed.yearsOfExperience).toBe(0);
    expect(parsed.skills).toEqual(["go"]);
    expect(parsed.education[0].degree).toBe("");
  });

  it("rejects invalid JSON without repeating the output in the error", () => {
    expect(() => parseStructuredOutput("secret resume text", ParsedResumeSchema)).toThrow(InvalidStructuredOutputError);
    expect(() => parseStructuredOutput("secret resume text", ParsedResumeSchema)).not.toThrow(/secret/);
  });

  it("rejects output that breaks the schema, naming the field", () => {
    const output = JSON.stringify({ strengths: ["a"], gaps: ["a", "b", "c"], verdict: "v" });
    expect(() => parseStructuredOutput(output, FitSchema)).toThrow(/strengths/);
  });
});

describe("requestStructuredOutput", () => {
  const schema = z.object({ ok: z.boolean() });

  it("retries when the output is invalid, then succeeds", async () => {
    const generate = vi.fn().mockResolvedValueOnce("not json").mockResolvedValueOnce('{"ok":true}');
    await expect(requestStructuredOutput(generate, schema, { sleep: noSleep })).resolves.toEqual({ ok: true });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts", async () => {
    const generate = vi.fn().mockResolvedValue("not json");
    await expect(requestStructuredOutput(generate, schema, { sleep: noSleep })).rejects.toThrow(InvalidStructuredOutputError);
    expect(generate).toHaveBeenCalledTimes(3);
  });
});

describe("Gemini error handling", () => {
  it.each([429, 500, 503])("retries HTTP %i", (status) => {
    expect(isRetryableGeminiError(httpError(status))).toBe(true);
  });

  it.each([400, 403, 404])("does not retry HTTP %i", (status) => {
    expect(isRetryableGeminiError(httpError(status))).toBe(false);
  });

  it("retries network failures and invalid output", () => {
    expect(isRetryableGeminiError(new Error("[GoogleGenerativeAI Error]: Error fetching from https://x: fetch failed"))).toBe(true);
    expect(isRetryableGeminiError(new InvalidStructuredOutputError("bad"))).toBe(true);
  });

  it("stops immediately on a permanent failure", async () => {
    const fn = vi.fn().mockRejectedValue(httpError(403));
    await expect(withRetry(fn, { isRetryable: isRetryableGeminiError, sleep: noSleep })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("maps failures to safe status codes and messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toAppError(httpError(429)).statusCode).toBe(503);
    expect(toAppError(new InvalidStructuredOutputError("bad")).statusCode).toBe(502);
    expect(toAppError(httpError(403)).message).not.toContain("403");
    spy.mockRestore();
  });
});
