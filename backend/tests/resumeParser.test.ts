import { beforeEach, describe, expect, it, vi } from "vitest";
import { textToPdf } from "../eval/textPdf";
import { extractPdfText } from "../src/utils/pdfText";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  saved: [] as Record<string, unknown>[],
  generateStructured: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("../src/config/gemini", () => ({
  generateStructured: mocks.generateStructured,
  generateEmbedding: mocks.generateEmbedding,
}));

vi.mock("../src/models/Resume", () => ({
  Resume: function (this: Record<string, unknown>, doc: Record<string, unknown>) {
    mocks.saved.push(doc);
    Object.assign(this, doc, { _id: "resume-id", save: mocks.save });
  },
}));

import { parseResume } from "../src/services/resumeParser";

const pdfWithText = (text: string): Buffer => textToPdf(text);

const LINE = "Built payment APIs with Node.js and PostgreSQL";

describe("extractPdfText", () => {
  it("reads the text layer of a real PDF", async () => {
    expect(await extractPdfText(pdfWithText(LINE))).toContain(LINE);
  });

  it("returns an empty string for an unreadable file", async () => {
    expect(await extractPdfText(Buffer.from("not a pdf"))).toBe("");
  });
});

describe("parseResume", () => {
  const modelOutput = {
    name: "Riley", email: "", location: "", workAuthorization: "", skills: ["node.js", "rust"], tools: [],
    yearsOfExperience: 4, experienceByDomain: [], education: [], projects: [], workHistory: [],
    skillEvidence: [
      { skill: "node.js", quote: LINE, section: "experience" },
      { skill: "rust", quote: "Rewrote the billing engine in Rust", section: "experience" },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.saved.length = 0;
    mocks.generateStructured.mockResolvedValue(modelOutput);
    mocks.generateEmbedding.mockResolvedValue([0.1]);
  });

  it("checks the model's quotes against the PDF, not against its own output", async () => {
    const { parsed } = await parseResume(pdfWithText(LINE));
    expect(parsed.skillEvidence.map(e => [e.skill, e.level])).toEqual([["node.js", "demonstrated"], ["rust", "unverified"]]);
  });

  it("stores the extracted text for later checks", async () => {
    await parseResume(pdfWithText(LINE));
    expect(mocks.saved[0].rawText).toContain(LINE);
  });

  it("confirms nothing when the PDF has no readable text", async () => {
    const { parsed } = await parseResume(Buffer.from("not a pdf"));
    expect(parsed.skillEvidence.every(e => e.level === "unverified")).toBe(true);
  });
});
