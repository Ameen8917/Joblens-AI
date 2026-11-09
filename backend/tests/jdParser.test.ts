import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  save: vi.fn(),
  generateStructured: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("../src/config/gemini", () => ({
  generateStructured: mocks.generateStructured,
  generateEmbedding: mocks.generateEmbedding,
}));

vi.mock("../src/models/Job", () => ({
  Job: Object.assign(
    function (this: Record<string, unknown>, doc: Record<string, unknown>) {
      Object.assign(this, doc, { _id: "new-id", save: mocks.save });
    },
    { findOne: mocks.findOne }
  ),
}));

import { hashJobText, parseJD } from "../src/services/jdParser";

const TEXT = "We are hiring a senior React developer with five years of production experience.";
const PARSED = { title: "Senior React Developer", company: "Acme", requiredSkills: ["react"], tools: [], responsibilities: [] };

describe("hashJobText", () => {
  it("treats whitespace-only differences as the same job", () => {
    expect(hashJobText(`  ${TEXT.replace(/ /g, "\n  ")}\n`)).toBe(hashJobText(TEXT));
  });

  it("gives different jobs different hashes", () => {
    expect(hashJobText(`${TEXT} Remote.`)).not.toBe(hashJobText(TEXT));
  });
});

describe("parseJD", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.generateStructured.mockResolvedValue(PARSED);
    mocks.generateEmbedding.mockResolvedValue([0.1, 0.2]);
  });

  it("stores a new job with its content hash", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.save.mockResolvedValue(undefined);

    const result = await parseJD(TEXT);

    expect(result.jobId).toBe("new-id");
    expect(mocks.findOne).toHaveBeenCalledWith({ contentHash: hashJobText(TEXT) });
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("returns the existing job without calling Gemini or inserting", async () => {
    mocks.findOne.mockResolvedValue({ _id: "existing-id", parsed: PARSED });

    const result = await parseJD(TEXT);

    expect(result).toEqual({ jobId: "existing-id", parsed: PARSED });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
    expect(mocks.generateEmbedding).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("returns the winning job when a concurrent request inserts first", async () => {
    mocks.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "winner-id", parsed: PARSED });
    mocks.save.mockRejectedValue(Object.assign(new Error("E11000"), { code: 11000 }));

    await expect(parseJD(TEXT)).resolves.toEqual({ jobId: "winner-id", parsed: PARSED });
  });

  it("rethrows other database errors", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.save.mockRejectedValue(new Error("connection lost"));

    await expect(parseJD(TEXT)).rejects.toThrow("connection lost");
  });
});
