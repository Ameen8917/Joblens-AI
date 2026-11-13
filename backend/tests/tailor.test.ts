import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateStructured: vi.fn(), generateEmbedding: vi.fn() }));

vi.mock("../src/config/gemini", () => ({
  generateStructured: mocks.generateStructured,
  generateEmbedding: mocks.generateEmbedding,
}));

import { applyEdits, checkClaims, scoreTailored, suggestRewrites } from "../src/services/tailor";
import { ParsedJD, ParsedResume } from "../src/types";

const JD = {
  title: "Senior Backend Engineer", company: "Acme", roleType: "IC", seniority: "senior", workMode: "remote",
  locations: [], visaSponsorship: "unknown", workAuthorizationRequired: "",
  requiredSkills: ["node.js", "postgresql", "kubernetes"], niceToHaveSkills: ["terraform"], tools: [],
  yearsOfExperience: 3, educationRequired: "", educationLevel: "none", educationEquivalentAccepted: false,
  culturalSignals: [], responsibilities: [], rawText: "",
} as ParsedJD;

const RESUME = {
  name: "Sam Lee", email: "", location: "", workAuthorization: "",
  skills: ["Node.js", "PostgreSQL", "Docker"], tools: [], yearsOfExperience: 5, experienceByDomain: [],
  education: [], projects: [],
  skillEvidence: [{ skill: "PostgreSQL", quote: "Skills: Node.js, PostgreSQL, Docker", section: "skills_list", level: "listed" }],
  workHistory: [
    { company: "Shipfast", role: "Backend Engineer", duration: "2021 - 2024",
      highlights: ["Built order APIs in Node serving 2 million requests a day", "Cut database load by 40% with Postgres indexes"] },
    { company: "Webco", role: "Developer", duration: "2019 - 2021",
      highlights: ["Packaged services with Docker for a team of 6"] },
  ],
  rawText: "",
} as ParsedResume;

const RAW_TEXT = [
  "Sam Lee", "Skills: Node.js, PostgreSQL, Docker",
  "Backend Engineer, Shipfast, 2021 - 2024",
  "Built order APIs in Node serving 2 million requests a day",
  "Cut database load by 40% with Postgres indexes",
  "Developer, Webco, 2019 - 2021", "Packaged services with Docker for a team of 6",
].join("\n");

const VOCABULARY = ["node.js", "postgresql", "kubernetes", "terraform", "docker"];
const [shipfast] = RESUME.workHistory;
// An empty original isolates the checks for added claims. The tests for dropped claims pass a real one.
const check = (rewritten: string, original = "") => checkClaims(original, rewritten, shipfast, RESUME, RAW_TEXT, VOCABULARY);

describe("checkClaims", () => {
  it("accepts a rewrite that only rewords facts from its own role", () => {
    expect(check("Reduced PostgreSQL load 40% by adding indexes to order APIs built in Node.js", shipfast.highlights[1])).toEqual([]);
  });

  it("flags a number or skill the original showed and the rewrite leaves out", () => {
    expect(check("Cut database load with indexes", shipfast.highlights[1])).toEqual([
      expect.objectContaining({ kind: "number", claim: "40", severity: "dropped" }),
      expect.objectContaining({ kind: "skill", claim: "postgresql", severity: "dropped" }),
    ]);
  });

  it("asks the candidate to check a verb that claims more responsibility", () => {
    expect(check("Led the build of order APIs in Node serving 2 million requests a day", shipfast.highlights[0])).toEqual([
      expect.objectContaining({ kind: "scope", claim: "led", severity: "check" }),
    ]);
  });

  it("asks the candidate to check a benefit the original doesn't state", () => {
    expect(check("Cut database load by 40% with Postgres indexes, improving reliability", shipfast.highlights[1])).toEqual([
      expect.objectContaining({ kind: "outcome", claim: "reliability", severity: "check" }),
    ]);
  });

  it("allows a benefit the original backs with something concrete", () => {
    expect(checkClaims("Cut Node API latency by 40%", "Improved Node API performance, cutting latency by 40%",
      shipfast, RESUME, RAW_TEXT, VOCABULARY)).toEqual([]);
  });

  it("allows a benefit the original already states", () => {
    expect(checkClaims("Made checkout more reliable", "Improved checkout reliability", shipfast, RESUME, RAW_TEXT, VOCABULARY)).toEqual([]);
  });

  it("allows a responsibility verb the original already uses", () => {
    expect(checkClaims("Led a Node migration", "Led the Node.js migration", shipfast, RESUME, RAW_TEXT, VOCABULARY)).toEqual([]);
  });

  it("flags a number that isn't on the resume as unsupported", () => {
    expect(check("Cut database load by 65% with Postgres indexes")).toEqual([
      expect.objectContaining({ kind: "number", claim: "65", severity: "unsupported" }),
    ]);
  });

  it("asks the candidate to check a number taken from another role", () => {
    expect(check("Worked with a team of 6 building order APIs in Node")).toEqual([
      expect.objectContaining({ kind: "number", claim: "6", severity: "check" }),
    ]);
  });

  it("flags a job skill the resume never mentions as unsupported", () => {
    expect(check("Built order APIs in Node on Kubernetes")).toEqual([
      expect.objectContaining({ kind: "skill", claim: "kubernetes", severity: "unsupported" }),
    ]);
  });

  it("asks the candidate to check a skill the resume shows only in another role", () => {
    expect(check("Built order APIs in Node, packaged with Docker")).toEqual([
      expect.objectContaining({ kind: "skill", claim: "docker", severity: "check" }),
    ]);
  });

  it("raises one flag, the more serious, when a skill also counts as a broader one", () => {
    // "sql" alone would only need checking, since PostgreSQL is on the resume. MySQL isn't.
    const flags = checkClaims("", "Shipped MySQL migrations", RESUME.workHistory[1], RESUME, RAW_TEXT, ["sql", "mysql"]);
    expect(flags).toEqual([expect.objectContaining({ kind: "skill", claim: "mysql", severity: "unsupported" })]);
  });

  it("checks against the parsed resume when the PDF text is missing", () => {
    expect(checkClaims("", "Built order APIs in Node, packaged with Docker", shipfast, RESUME, "", VOCABULARY))
      .toEqual([expect.objectContaining({ claim: "docker", severity: "check" })]);
  });
});

describe("suggestRewrites", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps rewrites of real bullets and attaches the claim check", async () => {
    mocks.generateStructured.mockResolvedValue({ rewrites: [
      { bulletId: "0-1", rewritten: "Cut PostgreSQL load by 60% with indexes", targetSkills: ["postgresql"], reason: "Names the job's database" },
      { bulletId: "1-0", rewritten: "Containerized services with Docker for a team of 6", targetSkills: [], reason: "Stronger verb" },
    ] });
    const { rewrites, discarded } = await suggestRewrites(JD, RESUME, RAW_TEXT);
    expect(discarded).toBe(0);
    expect(rewrites.map(r => [r.id, r.company, r.original])).toEqual([
      ["0-1", "Shipfast", "Cut database load by 40% with Postgres indexes"],
      ["1-0", "Webco", "Packaged services with Docker for a team of 6"],
    ]);
    expect(rewrites[0].flags).toEqual([
      expect.objectContaining({ claim: "60", severity: "unsupported" }),
      expect.objectContaining({ claim: "40", severity: "dropped" }),
    ]);
    expect(rewrites[1].flags).toEqual([]);
  });

  it("discards rewrites of bullets that don't exist, repeats, and rewrites that change nothing", async () => {
    mocks.generateStructured.mockResolvedValue({ rewrites: [
      { bulletId: "3-0", rewritten: "Invented bullet", targetSkills: [], reason: "" },
      { bulletId: "0-0", rewritten: "built order APIs in Node serving 2 million requests a day.", targetSkills: [], reason: "" },
      { bulletId: "0-1", rewritten: "Cut PostgreSQL load by 40% with indexes", targetSkills: [], reason: "" },
      { bulletId: "0-1", rewritten: "Cut PostgreSQL load 40%", targetSkills: [], reason: "" },
    ] });
    const { rewrites, discarded } = await suggestRewrites(JD, RESUME, RAW_TEXT);
    expect(rewrites.map(r => r.id)).toEqual(["0-1"]);
    expect(discarded).toBe(3);
  });

  it("doesn't call the model for a resume without work bullets", async () => {
    const result = await suggestRewrites(JD, { ...RESUME, workHistory: [] }, RAW_TEXT);
    expect(result).toEqual({ rewrites: [], discarded: 0 });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
  });
});

describe("applyEdits", () => {
  it("replaces only the edited bullets and leaves the original resume alone", () => {
    const tailored = applyEdits(RESUME, [{ id: "1-0", rewritten: "New text" }]);
    expect(tailored.workHistory[1].highlights).toEqual(["New text"]);
    expect(tailored.workHistory[0].highlights).toEqual(shipfast.highlights);
    expect(RESUME.workHistory[1].highlights).toEqual(["Packaged services with Docker for a team of 6"]);
  });
});

describe("scoreTailored", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The tailored text embeds closer to the job than the original.
    mocks.generateEmbedding.mockImplementation(async (text: string) => (text.includes("PostgreSQL load") ? [1, 0] : [0.7, 0.71]));
  });

  it("scores the accepted rewrites and reports skills that moved from a list into work", async () => {
    const result = await scoreTailored(JD, [1, 0], RESUME, RAW_TEXT, [{ id: "0-1", rewritten: "Cut PostgreSQL load by 40% with indexes" }]);
    expect(result.edits).toEqual([{ id: "0-1", flags: [], counted: true }]);
    expect(result.after.semanticScore).toBeGreaterThan(result.before.semanticScore);
    expect(result.evidenceUpgrades).toEqual(["postgresql"]);
  });

  it("leaves rewrites with unsupported claims out of the score", async () => {
    const result = await scoreTailored(JD, [1, 0], RESUME, RAW_TEXT, [{ id: "0-1", rewritten: "Cut PostgreSQL load by 90% with indexes" }]);
    expect(result.edits[0].counted).toBe(false);
    expect(result.edits[0].flags).toContainEqual(expect.objectContaining({ claim: "90", severity: "unsupported" }));
    expect(result.after).toEqual(result.before);
    expect(result.evidenceUpgrades).toEqual([]);
    expect(mocks.generateEmbedding).toHaveBeenCalledTimes(1);
  });

  it("rejects an edit to a bullet that doesn't exist", async () => {
    await expect(scoreTailored(JD, [1, 0], RESUME, RAW_TEXT, [{ id: "9-9", rewritten: "x" }]))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
