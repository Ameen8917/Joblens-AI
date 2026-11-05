import { describe, expect, it } from "vitest";
import { computeScore, skillsMatch } from "../src/services/scorer";
import { ParsedJD, ParsedResume } from "../src/types";

describe("skillsMatch", () => {
  it.each([
    ["javascript", "java"],
    ["java", "javascript"],
    ["mongodb", "go"],
    ["django", "go"],
    ["kubernetes", "r"],
    ["machine learning", "c"],
    ["c++", "c"],
    ["c#", "c"],
    ["objective c", "c"],
    ["software testing", "software sales"],
  ])("does not match %s with %s", (jd, resume) => {
    expect(skillsMatch(jd, resume)).toBeNull();
  });

  it.each([
    ["node.js", "Node"],
    ["React", "reactjs"],
    ["kubernetes", "k8s"],
    ["amazon web services", "AWS"],
    ["golang", "go"],
    ["typescript", "ts"],
    ["CI/CD", "cicd"],
    ["rest apis", "RESTful API"],
    ["python programming", "python"],
    ["c++", "C++"],
    ["sql", "postgresql"],
    ["nosql", "mongodb"],
  ])("fully matches %s with %s", (jd, resume) => {
    expect(skillsMatch(jd, resume)).toBe("matched");
  });

  it.each([
    ["react native", "react"],
    ["react", "react native"],
    ["aws lambda", "aws"],
    ["unit testing", "testing"],
    ["html/css", "css"],
    ["postgresql", "sql"],
  ])("partially matches %s with %s", (jd, resume) => {
    expect(skillsMatch(jd, resume)).toBe("partial");
  });
});

describe("computeScore", () => {
  const jd = (requiredSkills: string[], niceToHaveSkills: string[] = []) =>
    ({ requiredSkills, niceToHaveSkills, yearsOfExperience: 5 }) as ParsedJD;
  const resume = (skills: string[], tools: string[] = []) =>
    ({ skills, tools, yearsOfExperience: 3 }) as ParsedResume;
  const sameDirection = [1, 0];

  it("gives half credit for partial matches and reports what's missing", () => {
    const score = computeScore(jd(["react", "aws lambda", "docker", "kafka"], ["figma"]), resume(["react"], ["aws"]), sameDirection, sameDirection);
    expect(score.programmaticScore).toBe(38);
    expect(score.matchedSkills.map((m) => m.status)).toEqual(["matched", "partial", "missing", "missing"]);
    expect(score.missingRequired).toEqual(["docker", "kafka"]);
    expect(score.missingNiceToHave).toEqual(["figma"]);
    expect(score.yearsOfExperienceDelta).toBe(-2);
  });

  it("rounds the experience difference to one decimal place", () => {
    const score = computeScore(jd([]), { ...resume([]), yearsOfExperience: 5.17 }, sameDirection, sameDirection);
    expect(score.yearsOfExperienceDelta).toBe(0.2);
  });

  it("prefers a full match over an earlier partial match", () => {
    const score = computeScore(jd(["react"]), resume(["react native", "react"]), sameDirection, sameDirection);
    expect(score.matchedSkills[0].status).toBe("matched");
  });

  it("weights the final score 60% semantic and 40% programmatic", () => {
    const score = computeScore(jd(["kafka"]), resume(["react"]), [1, 0], [0, 1]);
    expect(score.programmaticScore).toBe(0);
    expect(score.semanticScore).toBe(50);
    expect(score.finalScore).toBe(30);
  });
});
