export type Seniority = "intern" | "junior" | "mid" | "senior" | "staff" | "unknown";
export type EducationLevel = "none" | "high_school" | "associate" | "bachelor" | "master" | "phd";

export interface ParsedJD {
  title: string;
  company: string;
  roleType: "IC" | "Manager" | "Lead" | "Unknown";
  seniority: Seniority;
  workMode: "remote" | "hybrid" | "onsite" | "unknown";
  locations: string[];
  visaSponsorship: "offered" | "not_offered" | "unknown";
  workAuthorizationRequired: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  yearsOfExperience: number;
  educationRequired: string;
  educationLevel: EducationLevel;
  educationEquivalentAccepted: boolean;
  tools: string[];
  culturalSignals: string[];
  responsibilities: string[];
  rawText: string;
}

export type EvidenceSection = "experience" | "project" | "education" | "skills_list" | "summary" | "other";

/** demonstrated: a confirmed line from work or a project. listed: confirmed, but only named. unverified: no confirmed line. */
export type EvidenceLevel = "demonstrated" | "listed" | "unverified";

export interface SkillEvidence {
  skill: string;
  quote: string;
  section: EvidenceSection;
  level: EvidenceLevel;
}

export interface ParsedResume {
  name: string;
  email: string;
  location: string;
  workAuthorization: string;
  skills: string[];
  tools: string[];
  skillEvidence: SkillEvidence[];
  yearsOfExperience: number;
  experienceByDomain: { domain: string; years: number }[];
  education: { degree: string; field: string; institution: string }[];
  projects: { name: string; description: string; techStack: string[] }[];
  workHistory: { company: string; role: string; duration: string; highlights: string[] }[];
  rawText: string;
}

export interface SkillMatch {
  skill: string;
  status: "matched" | "missing" | "partial";
  /** Null for missing skills, which have nothing on the resume to grade. */
  evidence: EvidenceLevel | null;
  /** The confirmed resume line. Null unless the line was found in the PDF text. */
  quote: string | null;
}

export interface HardCheck {
  id: "experience" | "seniority" | "location" | "visa" | "education";
  label: string;
  status: "pass" | "warn" | "fail" | "unknown" | "not_required";
  detail: string;
}

export interface ScoreBreakdown {
  programmaticScore: number;
  semanticScore: number;
  finalScore: number;
  matchedSkills: SkillMatch[];
  missingRequired: string[];
  missingNiceToHave: string[];
  yearsOfExperienceDelta: number;
  hardChecks: HardCheck[];
}

export interface FitAnalysisOutput {
  scoreBreakdown: ScoreBreakdown;
  strengths: string[];
  gaps: string[];
  verdict: string;
}

export interface GapAnalysisOutput {
  gaps: {
    skill: string;
    priority: "high" | "medium" | "low";
    reason: string;
    suggestion: string;
  }[];
}

export interface CoverLetterOutput {
  subject: string;
  body: string;
  wordCount: number;
}

export interface InterviewPrepOutput {
  questions: {
    type: "behavioral" | "technical" | "role-specific";
    question: string;
    answerFramework: string[];
  }[];
}

/**
 * Something a rewrite changes about what the bullet claims.
 * unsupported: a number or skill that's nowhere on the resume.
 * check: a number or skill from elsewhere on the resume, a verb claiming more responsibility, or a vague benefit such as
 * "improving reliability" that the original doesn't state, for the candidate to confirm.
 * dropped: a number or skill the original showed and the rewrite leaves out.
 */
export interface ClaimFlag {
  kind: "number" | "skill" | "scope" | "outcome";
  claim: string;
  severity: "unsupported" | "check" | "dropped";
  detail: string;
}

export interface BulletRewrite {
  /** "work index-highlight index" into resume.workHistory. */
  id: string;
  company: string;
  role: string;
  original: string;
  rewritten: string;
  targetSkills: string[];
  reason: string;
  flags: ClaimFlag[];
}

export interface TailoringSuggestions {
  rewrites: BulletRewrite[];
  /** Rewrites dropped because they pointed at a bullet that doesn't exist or changed nothing. */
  discarded: number;
}

export interface TailoredScore {
  before: ScoreBreakdown;
  after: ScoreBreakdown;
  edits: { id: string; flags: ClaimFlag[]; counted: boolean }[];
  /** Required skills that were only listed and now appear in an accepted work bullet. */
  evidenceUpgrades: string[];
}

export interface ApiError {
  success: false;
  error: string;
  details?: string;
}
