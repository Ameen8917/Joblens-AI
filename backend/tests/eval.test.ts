import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { JOBS, PAIRS, RESUMES } from "../eval/cases";
import {
  compareSkills, findRegressions, fitFromScore, fitLine, rankingAccuracy, ratio, suggestCalibration,
} from "../eval/metrics";
import { textToPdf, wrapLine } from "../eval/textPdf";
import { extractPdfText } from "../src/utils/pdfText";
import { toSemanticScore } from "../src/services/scorer";

describe("compareSkills", () => {
  it("matches aliases and counts only unexpected extras", () => {
    expect(compareSkills(["node.js", "postgresql", "go"], ["node", "postgres", "rest", "fintech"], ["rest"])).toEqual({
      found: ["node.js", "postgresql"], missed: ["go"], extra: ["fintech"],
    });
  });

  it("doesn't count a partial overlap as the same skill", () => {
    expect(compareSkills(["react"], ["react native"]).missed).toEqual(["react"]);
  });
});

describe("rankingAccuracy", () => {
  it("is 1 when every stronger fit scores higher, and 0 when every one scores lower", () => {
    expect(rankingAccuracy([{ fit: "strong", value: 3 }, { fit: "moderate", value: 2 }, { fit: "weak", value: 1 }])).toBe(1);
    expect(rankingAccuracy([{ fit: "strong", value: 1 }, { fit: "weak", value: 3 }])).toBe(0);
  });

  it("counts ties as half and ignores pairs with the same label", () => {
    expect(rankingAccuracy([{ fit: "strong", value: 2 }, { fit: "weak", value: 2 }, { fit: "weak", value: 9 }])).toBe(0.25);
    expect(rankingAccuracy([{ fit: "weak", value: 1 }, { fit: "weak", value: 2 }])).toBeNull();
  });
});

describe("calibration", () => {
  it("fits a straight line", () => {
    expect(fitLine([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toEqual({ slope: 2, intercept: 1 });
    expect(fitLine([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });

  it("puts each label near its target score", () => {
    const calibration = suggestCalibration([
      { fit: "weak", similarity: 0.6 }, { fit: "moderate", similarity: 0.7 }, { fit: "strong", similarity: 0.8 },
    ])!;
    expect(toSemanticScore(0.6, calibration)).toBeLessThan(35);
    expect(toSemanticScore(0.8, calibration)).toBeGreaterThan(80);
  });

  it("refuses to suggest a calibration when similarity runs the wrong way", () => {
    expect(suggestCalibration([{ fit: "weak", similarity: 0.9 }, { fit: "strong", similarity: 0.5 }])).toBeNull();
  });

  it("clamps scores to 0 to 100, and keeps the old mapping by default", () => {
    expect(toSemanticScore(0.2, { floor: 0.5, ceiling: 0.9 })).toBe(0);
    expect(toSemanticScore(0.95, { floor: 0.5, ceiling: 0.9 })).toBe(100);
    expect(fitFromScore(75)).toBe("strong");
    expect(fitFromScore(49)).toBe("weak");
  });
});

describe("findRegressions", () => {
  it("flags only drops beyond the tolerance", () => {
    expect(findRegressions({ a: 0.9, b: 0.9, c: null }, { a: 0.86, b: 0.8, c: 0.5 }, 0.05)).toEqual([
      { metric: "b", baseline: 0.9, current: 0.8 },
    ]);
  });

  it("treats nothing to measure as unknown, not perfect", () => {
    expect(ratio(0, 0)).toBeNull();
  });
});

describe("textToPdf", () => {
  it("wraps bullets with a hanging indent", () => {
    expect(wrapLine("- one two three four", 10)).toEqual(["- one two", "  three", "  four"]);
  });

  it("writes text that the PDF extractor can read back", async () => {
    const text = await extractPdfText(textToPdf("Jordan Avery\n- Built APIs in Node.js (and Go)"));
    expect(text).toContain("Built APIs in Node.js (and Go)");
  });

  it("interleaves the two columns row by row", async () => {
    const text = await extractPdfText(textToPdf("LEFT ONE\nLEFT TWO\n---\nRIGHT ONE\nRIGHT TWO", 2));
    expect(text.indexOf("RIGHT ONE")).toBeLessThan(text.indexOf("LEFT TWO"));
  });

  it("rejects characters the built-in font can't encode", () => {
    expect(() => textToPdf("café")).toThrow(/ASCII/);
  });
});

describe("eval cases", () => {
  it("only pair up resumes and jobs that exist", () => {
    for (const pair of PAIRS) {
      expect(RESUMES.map(r => r.id)).toContain(pair.resume);
      expect(JOBS.map(j => j.id)).toContain(pair.job);
    }
  });

  it("only claim skills the job requires", () => {
    for (const pair of PAIRS) {
      const required = JOBS.find(j => j.id === pair.job)!.expected.requiredSkills;
      expect(compareSkills(pair.has, required).missed).toEqual([]);
    }
  });

  it("render every resume fixture as a PDF", () => {
    for (const r of RESUMES) {
      expect(() => textToPdf(readFileSync(join(__dirname, "../eval/fixtures/resumes", `${r.id}.txt`), "utf8"), r.columns)).not.toThrow();
    }
  });
});
