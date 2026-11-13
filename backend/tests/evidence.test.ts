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

  // How a two-column PDF reads: each row runs across both columns, so the left column interrupts wrapped lines.
  const TWO_COLUMNS = [
    "SKILLS - Trained PyTorch ranking models that lifted click-through rate",
    "Python, PyTorch, SQL, Spark by 11% across 30 million daily recommendations",
    "Airflow, AWS, scikit-learn - Built Spark feature pipelines over 4TB of event data,",
    "XGBoost, Docker, TensorFlow scheduled with Airflow",
  ].join("\n");

  it("finds a wrapped line that the other column interrupts", () => {
    expect(quoteExists("Trained PyTorch ranking models that lifted click-through rate by 11% across 30 million daily recommendations", TWO_COLUMNS)).toBe(true);
    expect(quoteExists("Built Spark feature pipelines over 4TB of event data, scheduled with Airflow", TWO_COLUMNS)).toBe(true);
  });

  it("only skips words at the start of the next line, never mid-line", () => {
    expect(quoteExists("Trained PyTorch models that lifted click-through rate", TWO_COLUMNS)).toBe(false);
    expect(quoteExists("Trained PyTorch ranking models that lifted click-through rate by 11% 30 million", TWO_COLUMNS)).toBe(false);
  });

  it("doesn't skip more than a column's worth of words", () => {
    const far = "Led the migration of\none two three four five six seven eight nine ten the billing service";
    expect(quoteExists("Led the migration of the billing service", far)).toBe(false);
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

  it("confirms a skills-list quote of just the name as listed when the name is in the PDF", () => {
    expect(grade("docker", "Docker", "skills_list")).toBe("listed");
    expect(grade("rust", "Rust", "skills_list")).toBe("unverified");
  });

  it("never treats a bare name as demonstrated work", () => {
    expect(grade("docker", "Docker", "experience")).toBe("unverified");
  });
});
