import { ParsedJD, ParsedResume, ScoreBreakdown, SkillMatch } from "../types";

const cosineSimilarity = (a: number[], b: number[]): number => {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
};

const normalizeSkill = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").trim();

const skillsMatch = (jdSkill: string, resumeSkill: string): "matched" | "partial" | null => {
  const jd = normalizeSkill(jdSkill);
  const rs = normalizeSkill(resumeSkill);
  if (jd === rs || jd.includes(rs) || rs.includes(jd)) return "matched";
  const aliases: Record<string, string[]> = {
    javascript: ["js", "es6"], typescript: ["ts"], "node.js": ["node", "nodejs"],
    "react.js": ["react", "reactjs"], "next.js": ["next", "nextjs"],
    postgresql: ["postgres", "pg"], mongodb: ["mongo"], kubernetes: ["k8s"],
    "amazon web services": ["aws"], "google cloud platform": ["gcp"],
  };
  for (const [canonical, alts] of Object.entries(aliases)) {
    if ([canonical, ...alts].includes(jd) && [canonical, ...alts].includes(rs)) return "matched";
  }
  const jdWords = jd.split(" ").filter(w => w.length > 2);
  const rsWords = rs.split(" ").filter(w => w.length > 2);
  if (jdWords.some(w => rsWords.includes(w))) return "partial";
  return null;
};

export const computeScore = (
  jd: ParsedJD, resume: ParsedResume, jdEmbedding: number[], resumeEmbedding: number[]
): ScoreBreakdown => {
  const candidateSkills = [...resume.skills, ...resume.tools];
  const matchedSkills: SkillMatch[] = [];
  const missingRequired: string[] = [];
  const missingNiceToHave: string[] = [];

  for (const jdSkill of jd.requiredSkills) {
    let best: "matched" | "partial" | null = null;
    for (const rs of candidateSkills) {
      const m = skillsMatch(jdSkill, rs);
      if (m === "matched") { best = "matched"; break; }
      if (m === "partial" && best == null) best = "partial";
    }
    matchedSkills.push({ skill: jdSkill, status: best ?? "missing" });
    if (!best) missingRequired.push(jdSkill);
  }

  for (const jdSkill of jd.niceToHaveSkills) {
    if (!candidateSkills.some(rs => skillsMatch(jdSkill, rs))) missingNiceToHave.push(jdSkill);
  }

  const totalRequired = jd.requiredSkills.length;
  const programmaticScore = totalRequired === 0 ? 75 :
    Math.min(Math.round(matchedSkills.reduce((s, m) =>
      s + (m.status === "matched" ? 1 : m.status === "partial" ? 0.5 : 0), 0) / totalRequired * 100), 100);

  const similarity = cosineSimilarity(jdEmbedding, resumeEmbedding);
  const semanticScore = Math.round(((similarity + 1) / 2) * 100);
  const finalScore = Math.min(Math.round(semanticScore * 0.6 + programmaticScore * 0.4), 100);

  return {
    programmaticScore, semanticScore, finalScore, matchedSkills,
    missingRequired, missingNiceToHave,
    yearsOfExperienceDelta: resume.yearsOfExperience - jd.yearsOfExperience,
  };
};
