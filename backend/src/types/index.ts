export interface ParsedJD {
  title: string;
  company: string;
  roleType: "IC" | "Manager" | "Lead" | "Unknown";
  requiredSkills: string[];
  niceToHaveSkills: string[];
  yearsOfExperience: number;
  educationRequired: string;
  tools: string[];
  culturalSignals: string[];
  responsibilities: string[];
  rawText: string;
}

export interface ParsedResume {
  name: string;
  email: string;
  skills: string[];
  tools: string[];
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
}

export interface ScoreBreakdown {
  programmaticScore: number;
  semanticScore: number;
  finalScore: number;
  matchedSkills: SkillMatch[];
  missingRequired: string[];
  missingNiceToHave: string[];
  yearsOfExperienceDelta: number;
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

export type AnalysisMode = "fit" | "gaps" | "cover-letter" | "interview";

export interface AnalyzeRequest {
  mode: AnalysisMode;
  jobId: string;
  resumeId: string;
}

export interface AnalyzeResponse<T> {
  success: boolean;
  mode: AnalysisMode;
  data: T;
}

export interface ParseJDResponse {
  success: boolean;
  jobId: string;
  parsed: ParsedJD;
}

export interface ParseResumeResponse {
  success: boolean;
  resumeId: string;
  parsed: ParsedResume;
}

export interface ApiError {
  success: false;
  error: string;
  details?: string;
}
