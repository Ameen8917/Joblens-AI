import { describe, expect, it } from "vitest";
import { gradeEvidence, quoteExists } from "../src/services/evidence";
import { mentionsSkill } from "../src/services/scorer";

const RESUME = `Riley Candidate
Experience
• Built payment APIs with Node.js and PostgreSQL, cutting checkout
errors by 30% across the plat-
form
Skills: React, Docker, Kubernetes, Terraform`;

describe("quoteExists", () => {
  it("finds a line that the PDF wrapped and hyphenated", () => {
    expect(quoteExists("Built payment APIs with Node.js and PostgreSQL, cutting checkout errors by 30% across the platform", RESUME)).toBe(true);
  });

  it("ignores ligatures, curly punctuation and case", () => {
    expect(quoteExists("Oﬃce automation – “reports”", "office automation - \"REPORTS\"")).toBe(true);
  });

  it("rejects a line that isn't in the resume", () => {
    expect(quoteExists("Led a team of ten engineers building payment APIs", RESUME)).toBe(false);
  });

  it("rejects a reworded line", () => {
    expect(quoteExists("Built payment services with Node.js and PostgreSQL", RESUME)).toBe(false);
  });

  it("rejects quotes too short to be meaningful", () => {
    expect(quoteExists("Node", RESUME)).toBe(false);
  });

  it("rejects everything when the PDF had no text", () => {
    expect(quoteExists("Built payment APIs with Node.js", "")).toBe(false);
  });
});

describe("mentionsSkill", () => {
  it.each([
    ["Built services in Node.js", "node"],
    ["Deployed on k8s clusters", "kubernetes"],
    ["Hosted on Amazon Web Services", "aws"],
    ["Styled with HTML and CSS", "html/css"],
    ["Tuned Postgres queries", "sql"],
  ])("finds the skill in %s", (line, skill) => {
    expect(mentionsSkill(line, skill)).toBe(true);
  });

  it.each([
    ["Migrated data into MongoDB", "go"],
    ["Wrote JavaScript widgets", "java"],
    ["Tuned SQL queries", "postgresql"],
  ])("doesn't find the skill in %s", (line, skill) => {
    expect(mentionsSkill(line, skill)).toBe(false);
  });
});

describe("gradeEvidence", () => {
  const LINE = "Built payment APIs with Node.js and PostgreSQL";
  const grade = (skill: string, quote: string, section: "experience" | "project" | "skills_list" | "education") =>
    gradeEvidence([{ skill, quote, section }], RESUME)[0].level;

  it("treats a confirmed work line as demonstrated", () => {
    expect(grade("node.js", LINE, "experience")).toBe("demonstrated");
  });

  it("treats a confirmed skills line as listed", () => {
    expect(grade("docker", "Skills: React, Docker, Kubernetes, Terraform", "skills_list")).toBe("listed");
  });

  it("treats a confirmed line from elsewhere as listed", () => {
    expect(grade("node.js", LINE, "education")).toBe("listed");
  });

  it("doesn't let a bare list labelled as work count as demonstrated", () => {
    expect(grade("docker", "Skills: React, Docker, Kubernetes, Terraform", "experience")).toBe("listed");
  });

  it("marks an invented line unverified", () => {
    expect(grade("rust", "Rewrote the billing engine in Rust", "experience")).toBe("unverified");
  });

  it("marks a real line that doesn't name the skill unverified", () => {
    expect(grade("python", LINE, "experience")).toBe("unverified");
  });
});
