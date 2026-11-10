import { HardCheck, ParsedJD, ParsedResume, Seniority } from "../types";

const check = (id: HardCheck["id"], label: string, status: HardCheck["status"], detail: string): HardCheck =>
  ({ id, label, status, detail });

const checkExperience = (jd: ParsedJD, resume: ParsedResume): HardCheck => {
  const label = "Experience";
  const required = jd.yearsOfExperience;
  if (!required) return check("experience", label, "not_required", "The job doesn't state a minimum.");
  const summary = `Resume shows ${resume.yearsOfExperience} years, job asks for ${required}.`;
  return check("experience", label, resume.yearsOfExperience >= required ? "pass" : "fail", summary);
};

const SENIORITY_RANK: Record<Exclude<Seniority, "unknown">, number> = { intern: 0, junior: 1, mid: 2, senior: 3, staff: 4 };

const TITLE_PATTERNS: [RegExp, number][] = [
  [/\b(staff|principal|lead|architect|director|head|vp|chief)\b/, SENIORITY_RANK.staff],
  [/\b(senior|sr|manager)\b/, SENIORITY_RANK.senior],
  [/\b(junior|jr|graduate|associate|entry)\b/, SENIORITY_RANK.junior],
  [/\b(intern|trainee)\b/, SENIORITY_RANK.intern],
];

const titleRank = (role: string): number | null =>
  TITLE_PATTERNS.find(([pattern]) => pattern.test(role.toLowerCase()))?.[1] ?? null;

const candidateRank = (resume: ParsedResume): number | null => {
  const roles = resume.workHistory ?? [];
  if (roles.length === 0) return null;
  const ranks = roles.map(work => titleRank(work.role)).filter((rank): rank is number => rank !== null);
  if (ranks.length) return Math.max(...ranks);
  // A plain title like "Software Engineer" doesn't prove more than mid level, however long it was held.
  return resume.yearsOfExperience >= 2 ? SENIORITY_RANK.mid : SENIORITY_RANK.junior;
};

const checkSeniority = (jd: ParsedJD, resume: ParsedResume): HardCheck => {
  const label = "Seniority";
  if (!jd.seniority || jd.seniority === "unknown") return check("seniority", label, "not_required", "The job doesn't state a level.");
  const candidate = candidateRank(resume);
  if (candidate === null) return check("seniority", label, "unknown", `The job is ${jd.seniority} level, and the resume lists no roles to compare.`);
  const gap = SENIORITY_RANK[jd.seniority] - candidate;
  if (gap <= 0) return check("seniority", label, "pass", `Past roles meet the ${jd.seniority} level.`);
  return check("seniority", label, gap === 1 ? "warn" : "fail",
    `The job is ${jd.seniority} level, and past roles are ${gap} ${gap === 1 ? "level" : "levels"} below it.`);
};

const placeParts = (place: string): string[][] =>
  place.toLowerCase().split(/[,/]/).map(part => part.match(/[\p{L}\p{N}]+/gu) ?? []).filter(words => words.length > 0);

const samePlace = (a: string, b: string): boolean =>
  placeParts(a).some(partA => placeParts(b).some(partB => {
    const [shorter, longer] = partA.length <= partB.length ? [partA, partB] : [partB, partA];
    return shorter.every(word => longer.includes(word));
  }));

const checkLocation = (jd: ParsedJD, resume: ParsedResume): HardCheck => {
  const label = "Location";
  const places = jd.locations ?? [];
  if (places.length === 0) {
    if (jd.workMode === "remote") return check("location", label, "pass", "Remote role with no stated location limit.");
    return check("location", label, "not_required", "The job doesn't state a location.");
  }
  const wanted = places.join("; ");
  if (!resume.location) return check("location", label, "unknown", `The job is tied to ${wanted}, and the resume doesn't state a location.`);
  if (places.some(place => samePlace(place, resume.location))) return check("location", label, "pass", `${resume.location} matches ${wanted}.`);
  // Warn rather than fail: place names vary, and the candidate may be willing to move.
  return check("location", label, "warn", `Resume says ${resume.location}, and the job lists ${wanted}. Check whether this works for you.`);
};

const NEEDS_SPONSORSHIP = /\b(requires?|needs?|seeking)\b.*\bsponsorship\b/i;
const HAS_AUTHORIZATION = /\b(citizen|permanent resident|green card|authori[sz]ed to work|work permit)\b|\bno sponsorship\b/i;

const checkVisa = (jd: ParsedJD, resume: ParsedResume): HardCheck => {
  const label = "Visa";
  const requirement = jd.workAuthorizationRequired || (jd.visaSponsorship === "not_offered" ? "No visa sponsorship" : "");
  if (!requirement) {
    if (jd.visaSponsorship === "offered") return check("visa", label, "pass", "The job offers visa sponsorship.");
    return check("visa", label, "not_required", "The job doesn't mention work authorization.");
  }
  const stated = resume.workAuthorization;
  if (!stated) return check("visa", label, "unknown", `Job says: ${requirement}. The resume doesn't state work authorization, so confirm this yourself.`);
  if (NEEDS_SPONSORSHIP.test(stated)) return check("visa", label, jd.visaSponsorship === "offered" ? "pass" : "fail", `Job says: ${requirement}. Resume says: ${stated}.`);
  return check("visa", label, HAS_AUTHORIZATION.test(stated) ? "pass" : "unknown", `Job says: ${requirement}. Resume says: ${stated}.`);
};

const EDUCATION_RANK = { none: 0, high_school: 1, associate: 2, bachelor: 3, master: 4, phd: 5 } as const;

const DEGREE_PATTERNS: [RegExp, number][] = [
  [/\b(phd|doctorate|doctoral)\b/, EDUCATION_RANK.phd],
  [/\b(master|masters|ms|msc|ma|mba|meng|mtech)\b/, EDUCATION_RANK.master],
  [/\b(bachelor|bachelors|bs|bsc|ba|be|beng|btech)\b/, EDUCATION_RANK.bachelor],
  [/\b(associate|associates)\b/, EDUCATION_RANK.associate],
  [/\b(high school|secondary|ged)\b/, EDUCATION_RANK.high_school],
];

const degreeRank = (degree: string): number | null => {
  const text = degree.toLowerCase().replace(/[.']/g, "");
  return DEGREE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
};

const checkEducation = (jd: ParsedJD, resume: ParsedResume): HardCheck => {
  const label = "Education";
  if (!jd.educationLevel || jd.educationLevel === "none") return check("education", label, "not_required", "The job doesn't require a degree.");
  const wanted = jd.educationLevel.replace("_", " ");
  const ranks = (resume.education ?? []).map(entry => degreeRank(entry.degree)).filter((rank): rank is number => rank !== null);
  if (ranks.length === 0) return check("education", label, "unknown", `The job asks for ${wanted} level, and no recognizable degree is on the resume.`);
  if (Math.max(...ranks) >= EDUCATION_RANK[jd.educationLevel]) return check("education", label, "pass", `Resume meets the ${wanted} requirement.`);
  if (jd.educationEquivalentAccepted) return check("education", label, "warn", `Below the ${wanted} level, but the job accepts equivalent experience.`);
  return check("education", label, "fail", `The job requires ${wanted} level, and the resume's degree is below it.`);
};

/** Pass or fail rules that a similarity score can't capture. Deterministic, so the same inputs always give the same result. */
export const runHardChecks = (jd: ParsedJD, resume: ParsedResume): HardCheck[] =>
  [checkExperience, checkSeniority, checkLocation, checkVisa, checkEducation].map(run => run(jd, resume));
