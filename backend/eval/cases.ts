/**
 * Hand-labelled expected results for the fixtures. Labels record what a careful recruiter would say,
 * not what the code currently does, so a disagreement is a finding to fix, not a label to change.
 * An array means any of those answers is acceptable.
 */
import { EducationLevel, HardCheck, ParsedJD, Seniority } from "../src/types";

export type Fit = "strong" | "moderate" | "weak";
type OneOf<T> = T | T[];

export interface JobCase {
  id: string;
  expected: {
    requiredSkills: string[];
    niceToHaveSkills: string[];
    /** Extra required skills that aren't wrong, so they don't count against precision. */
    acceptableExtras: string[];
    yearsOfExperience: number;
    seniority: OneOf<Seniority>;
    workMode: OneOf<ParsedJD["workMode"]>;
    visaSponsorship: OneOf<ParsedJD["visaSponsorship"]>;
    educationLevel: OneOf<EducationLevel>;
    educationEquivalentAccepted?: boolean;
  };
}

export interface ResumeCase {
  id: string;
  columns: 1 | 2;
  expected: {
    /** Every skill the resume names. Extra skills aren't penalized, because the model may reasonably infer more. */
    skills: string[];
    yearsOfExperience: [min: number, max: number];
    /** A word the extracted location must contain. */
    location: string;
    statesWorkAuthorization: boolean;
    /** Skills used in a work or project line. */
    demonstrated: string[];
    /** Skills that only appear in a skills list. */
    listedOnly: string[];
  };
}

export interface PairCase {
  resume: string;
  job: string;
  fit: Fit;
  /** The job's required skills that the candidate has. */
  has: string[];
  /** Required skills where the candidate has a related skill, so half credit is as fair as none. */
  partialOk?: string[];
  checks: Partial<Record<HardCheck["id"], OneOf<HardCheck["status"]>>>;
}

export const JOBS: JobCase[] = [
  {
    id: "backend-senior",
    expected: {
      requiredSkills: ["node.js", "typescript", "postgresql", "aws"],
      niceToHaveSkills: ["kubernetes", "graphql"],
      acceptableExtras: ["sql", "rest", "api design", "backend development"],
      yearsOfExperience: 5, seniority: "senior", workMode: "hybrid", visaSponsorship: "not_offered",
      educationLevel: "bachelor", educationEquivalentAccepted: true,
    },
  },
  {
    id: "frontend",
    expected: {
      requiredSkills: ["react", "typescript", "next.js", "css", "jest"],
      niceToHaveSkills: ["graphql", "design systems"],
      acceptableExtras: ["javascript", "html", "accessibility", "testing"],
      yearsOfExperience: 2, seniority: ["mid", "unknown"], workMode: "remote", visaSponsorship: "unknown",
      educationLevel: "none",
    },
  },
  {
    id: "ml-senior",
    expected: {
      requiredSkills: ["python", "pytorch", "sql", "spark"],
      niceToHaveSkills: ["airflow", "aws sagemaker"],
      acceptableExtras: ["machine learning", "recommendation systems"],
      yearsOfExperience: 5, seniority: "senior", workMode: "onsite", visaSponsorship: "offered",
      educationLevel: "master", educationEquivalentAccepted: false,
    },
  },
  {
    id: "platform-staff",
    expected: {
      requiredSkills: ["kubernetes", "terraform", "go", "aws"],
      niceToHaveSkills: ["gcp", "prometheus"],
      acceptableExtras: ["infrastructure as code", "sre"],
      yearsOfExperience: 8, seniority: "staff", workMode: "remote", visaSponsorship: ["unknown", "not_offered"],
      educationLevel: "bachelor", educationEquivalentAccepted: false,
    },
  },
  {
    id: "junior-java",
    expected: {
      requiredSkills: ["java", "sql"],
      niceToHaveSkills: ["spring boot", "docker"],
      acceptableExtras: [],
      yearsOfExperience: 0, seniority: "junior", workMode: "onsite", visaSponsorship: "not_offered",
      educationLevel: "bachelor", educationEquivalentAccepted: false,
    },
  },
  {
    id: "fullstack",
    expected: {
      requiredSkills: ["react", "node.js", "typescript", "postgresql"],
      niceToHaveSkills: ["aws", "docker", "graphql"],
      acceptableExtras: ["rest", "javascript"],
      yearsOfExperience: 3, seniority: ["mid", "unknown"], workMode: ["hybrid", "remote"], visaSponsorship: "unknown",
      educationLevel: "none",
    },
  },
];

export const RESUMES: ResumeCase[] = [
  {
    id: "backend-mid",
    columns: 1,
    expected: {
      skills: ["typescript", "javascript", "java", "sql", "node.js", "express", "postgresql", "redis", "graphql",
        "docker", "aws", "kubernetes", "github actions", "jest", "spring boot"],
      yearsOfExperience: [3.4, 4.2], location: "austin", statesWorkAuthorization: true,
      demonstrated: ["node.js", "typescript", "postgresql", "redis", "docker", "aws", "java", "jest"],
      listedOnly: ["graphql", "kubernetes", "express", "github actions"],
    },
  },
  {
    id: "frontend-junior",
    columns: 1,
    expected: {
      skills: ["react", "typescript", "javascript", "next.js", "css", "tailwind css", "jest", "vue", "git", "graphql", "node.js"],
      yearsOfExperience: [1, 1.8], location: "toronto", statesWorkAuthorization: false,
      demonstrated: ["react", "typescript", "next.js", "jest", "css", "tailwind css", "graphql", "node.js"],
      listedOnly: ["vue", "git"],
    },
  },
  {
    id: "ml-senior-two-column",
    columns: 2,
    expected: {
      skills: ["python", "pytorch", "sql", "spark", "airflow", "aws", "scikit-learn", "xgboost", "docker", "tensorflow"],
      yearsOfExperience: [7.4, 8.2], location: "warsaw", statesWorkAuthorization: true,
      demonstrated: ["pytorch", "spark", "airflow", "aws", "sql", "python", "scikit-learn", "xgboost"],
      listedOnly: ["docker", "tensorflow"],
    },
  },
  {
    id: "sre-staff",
    columns: 1,
    expected: {
      skills: ["kubernetes", "terraform", "aws", "gcp", "go", "python", "prometheus", "grafana", "docker", "jenkins", "ansible", "helm"],
      yearsOfExperience: [10, 10.8], location: "berlin", statesWorkAuthorization: true,
      demonstrated: ["kubernetes", "terraform", "aws", "gcp", "go", "prometheus", "grafana", "docker", "jenkins", "ansible"],
      listedOnly: ["python", "helm"],
    },
  },
  {
    id: "new-grad",
    columns: 1,
    expected: {
      skills: ["java", "python", "c++", "sql", "postgresql", "flask", "junit", "git", "linux"],
      yearsOfExperience: [0, 0.5], location: "chicago", statesWorkAuthorization: true,
      demonstrated: ["java", "junit", "sql", "python", "flask", "postgresql", "c++"],
      listedOnly: ["git", "linux"],
    },
  },
];

const NOT_STATED = { visa: "not_required", education: "not_required" } as const;

export const PAIRS: PairCase[] = [
  { resume: "backend-mid", job: "backend-senior", fit: "strong", has: ["node.js", "typescript", "postgresql", "aws"],
    checks: { experience: "fail", seniority: "warn", location: "pass", visa: "pass", education: "pass" } },
  { resume: "backend-mid", job: "frontend", fit: "weak", has: ["typescript", "jest"],
    checks: { experience: "pass", seniority: ["pass", "not_required"], location: "pass", ...NOT_STATED } },
  { resume: "backend-mid", job: "platform-staff", fit: "weak", has: ["kubernetes", "aws"],
    // US work authorization says nothing about the EU.
    checks: { experience: "fail", seniority: "fail", location: ["warn", "fail"], visa: ["fail", "unknown"], education: "pass" } },
  { resume: "backend-mid", job: "junior-java", fit: "moderate", has: ["java", "sql"],
    checks: { experience: "not_required", seniority: "pass", location: "warn", visa: "pass", education: "pass" } },
  { resume: "backend-mid", job: "fullstack", fit: "moderate", has: ["node.js", "typescript", "postgresql"],
    checks: { experience: "pass", seniority: ["pass", "not_required"], location: "warn", ...NOT_STATED } },

  { resume: "frontend-junior", job: "frontend", fit: "strong", has: ["react", "typescript", "next.js", "css", "jest"],
    // Toronto is in Canada, which the job allows.
    checks: { experience: "fail", seniority: ["warn", "not_required"], location: "pass", ...NOT_STATED } },
  { resume: "frontend-junior", job: "backend-senior", fit: "weak", has: ["typescript", "node.js"],
    checks: { experience: "fail", seniority: "fail", location: "warn", visa: "unknown", education: ["pass", "warn"] } },
  { resume: "frontend-junior", job: "junior-java", fit: "weak", has: [],
    checks: { experience: "not_required", seniority: "pass", location: "warn", visa: "unknown" } },
  { resume: "frontend-junior", job: "fullstack", fit: "moderate", has: ["react", "typescript", "node.js"],
    checks: { experience: "fail", seniority: ["warn", "not_required"], location: "pass", ...NOT_STATED } },

  { resume: "ml-senior-two-column", job: "ml-senior", fit: "strong", has: ["python", "pytorch", "sql", "spark"],
    checks: { experience: "pass", seniority: "pass", location: "warn", visa: "pass", education: "pass" } },
  { resume: "ml-senior-two-column", job: "backend-senior", fit: "weak", has: ["aws"], partialOk: ["postgresql"],
    checks: { experience: "pass", seniority: "pass", location: "warn", visa: "fail", education: "pass" } },
  { resume: "ml-senior-two-column", job: "platform-staff", fit: "weak", has: ["aws"],
    // Warsaw is in Europe, which the job allows.
    checks: { experience: "fail", seniority: "warn", location: "pass", education: "pass" } },

  { resume: "sre-staff", job: "platform-staff", fit: "strong", has: ["kubernetes", "terraform", "go", "aws"],
    // Berlin is in Europe, and an EU citizen is eligible to work in the EU.
    checks: { experience: "pass", seniority: "pass", location: "pass", visa: "pass", education: "pass" } },
  { resume: "sre-staff", job: "backend-senior", fit: "weak", has: ["aws"],
    // EU citizenship says nothing about the US.
    checks: { experience: "pass", seniority: "pass", location: "warn", visa: ["fail", "unknown"], education: "pass" } },
  { resume: "sre-staff", job: "ml-senior", fit: "weak", has: ["python"],
    checks: { experience: "pass", seniority: "pass", location: "warn", visa: "pass", education: "fail" } },

  { resume: "new-grad", job: "junior-java", fit: "strong", has: ["java", "sql"],
    // A graduating intern is exactly who a junior role is for.
    checks: { experience: "not_required", seniority: "pass", location: "pass", visa: "pass", education: "pass" } },
  { resume: "new-grad", job: "ml-senior", fit: "weak", has: ["python", "sql"],
    checks: { experience: "fail", seniority: "fail", location: "warn", visa: "pass", education: "fail" } },
  { resume: "new-grad", job: "fullstack", fit: "weak", has: ["postgresql"],
    checks: { experience: "fail", seniority: ["warn", "fail", "not_required"], location: "warn", ...NOT_STATED } },
];
