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
export type EvidenceLevel = 'demonstrated' | 'listed' | 'unverified';

export interface SkillMatch {
  skill: string;
  status: 'matched' | 'missing' | 'partial';
  evidence: EvidenceLevel | null;
  quote: string | null;
  /** For a broad requirement such as "backend development", the concrete resume skills that show it. */
  shownBy?: string[];
}

export interface HardCheck {
  id: 'experience' | 'seniority' | 'location' | 'visa' | 'education';
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown' | 'not_required';
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

// ─── Result tabs that load their own data ────────────────────────────────────
export type SelfLoadingTab = 'tailor' | 'mock';
export type ResultTab = AnalysisMode | SelfLoadingTab;

// ─── Resume tailoring ────────────────────────────────────────────────────────
export interface ClaimFlag {
  kind: 'number' | 'skill' | 'scope' | 'outcome';
  claim: string;
  /** unsupported: not on the resume. check: from elsewhere on it, or a bigger role. dropped: left out of the rewrite. */
  severity: 'unsupported' | 'check' | 'dropped';
  detail: string;
}

export interface BulletRewrite {
  id: string;
  company: string;
  role: string;
  original: string;
  rewritten: string;
  targetSkills: string[];
  reason: string;
  flags: ClaimFlag[];
}

export interface TailoringSuggestions { rewrites: BulletRewrite[]; discarded: number; }

export interface BulletEdit { id: string; rewritten: string; }

export interface TailoredScore {
  before: ScoreBreakdown;
  after: ScoreBreakdown;
  edits: { id: string; flags: ClaimFlag[]; counted: boolean }[];
  evidenceUpgrades: string[];
}

export interface MockFeedback {
  overall: number;
  structure: number;
  content: number;
  relevance: number;
  tips: string[];
}
