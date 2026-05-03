// ─── Parsed structures ────────────────────────────────────────────────────────
export interface ParsedJD {
  title: string;
  company: string;
  roleType: 'IC' | 'Manager' | 'Lead' | 'Unknown';
  requiredSkills: string[];
  niceToHaveSkills: string[];
  yearsOfExperience: number;
  educationRequired: string;
  tools: string[];
  culturalSignals: string[];
  responsibilities: string[];
}

export interface ParsedResume {
  name: string;
  email: string;
  skills: string[];
  tools: string[];
  yearsOfExperience: number;
  workHistory: { company: string; role: string; duration: string; highlights: string[] }[];
  projects: { name: string; description: string; techStack: string[] }[];
  education: { degree: string; field: string; institution: string }[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
export interface SkillMatch {
  skill: string;
  status: 'matched' | 'missing' | 'partial';
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

// ─── Mode outputs ─────────────────────────────────────────────────────────────
export interface FitAnalysisData {
  scoreBreakdown: ScoreBreakdown;
  strengths: string[];
  gaps: string[];
  verdict: string;
}

export interface GapItem {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestion: string;
}
export interface GapAnalysisData { gaps: GapItem[]; }

export interface CoverLetterData {
  subject: string;
  body: string;
  wordCount: number;
}

export interface InterviewQuestion {
  type: 'behavioral' | 'technical' | 'role-specific';
  question: string;
  answerFramework: string[];
}
export interface InterviewPrepData { questions: InterviewQuestion[]; }

export type AnalysisMode = 'fit' | 'gaps' | 'cover-letter' | 'interview';

// ─── Saved job (for sidebar tracker) ─────────────────────────────────────────
export interface SavedJob {
  id: string;
  jobId: string;
  resumeId: string;
  title: string;
  company: string;
  score: number | null;
  savedAt: string;
}