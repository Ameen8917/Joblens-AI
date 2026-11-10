import { describe, expect, it } from "vitest";
import { runHardChecks } from "../src/services/hardChecks";
import { HardCheck, ParsedJD, ParsedResume } from "../src/types";

const jobWith = (fields: Partial<ParsedJD>) => fields as ParsedJD;
const resumeWith = (fields: Partial<ParsedResume>) => ({ yearsOfExperience: 5, ...fields }) as ParsedResume;
const roles = (...titles: string[]) => titles.map(role => ({ company: "", role, duration: "", highlights: [] }));
const degrees = (...names: string[]) => names.map(degree => ({ degree, field: "", institution: "" }));

const statusOf = (id: HardCheck["id"], jd: Partial<ParsedJD>, resume: Partial<ParsedResume>) =>
  runHardChecks(jobWith(jd), resumeWith(resume)).find(c => c.id === id)!.status;

describe("experience", () => {
  it.each([
    [3, 5, "pass"],
    [5, 5, "pass"],
    [6, 5, "fail"],
    [0, 5, "not_required"],
  ])("requires %d years against %d on the resume: %s", (required, actual, expected) => {
    expect(statusOf("experience", { yearsOfExperience: required }, { yearsOfExperience: actual })).toBe(expected);
  });
});

describe("seniority", () => {
  it.each([
    ["senior", ["Senior Engineer"], "pass"],
    ["senior", ["Staff Engineer", "Engineer"], "pass"],
    ["senior", ["Software Engineer"], "warn"],
    ["staff", ["Junior Developer"], "fail"],
    ["mid", ["Internal Tools Engineer"], "pass"],
    ["junior", ["Intern"], "warn"],
  ] as const)("job %s with roles %j: %s", (seniority, titles, expected) => {
    expect(statusOf("seniority", { seniority }, { workHistory: roles(...titles) })).toBe(expected);
  });

  it("needs a stated level and some roles", () => {
    expect(statusOf("seniority", { seniority: "unknown" }, { workHistory: roles("Engineer") })).toBe("not_required");
    expect(statusOf("seniority", { seniority: "senior" }, { workHistory: [] })).toBe("unknown");
  });

  it("doesn't treat a long-held plain title as senior", () => {
    expect(statusOf("seniority", { seniority: "senior" }, { workHistory: roles("Engineer"), yearsOfExperience: 12 })).toBe("warn");
  });
});

describe("location", () => {
  it.each([
    [["London"], "London, UK", "pass"],
    [["New York, NY"], "New York City", "pass"],
    [["Berlin"], "Paris, France", "warn"],
    [["Berlin"], "", "unknown"],
  ])("job in %j, candidate in %s: %s", (locations, location, expected) => {
    expect(statusOf("location", { locations, workMode: "onsite" }, { location })).toBe(expected);
  });

  it("passes an unrestricted remote job and skips jobs with no location", () => {
    expect(statusOf("location", { locations: [], workMode: "remote" }, { location: "" })).toBe("pass");
    expect(statusOf("location", { locations: [], workMode: "unknown" }, { location: "Paris" })).toBe("not_required");
  });
});

describe("visa", () => {
  it("skips jobs that don't mention it", () => {
    expect(statusOf("visa", { visaSponsorship: "unknown", workAuthorizationRequired: "" }, {})).toBe("not_required");
  });

  it("passes when sponsorship is offered", () => {
    expect(statusOf("visa", { visaSponsorship: "offered", workAuthorizationRequired: "" }, {})).toBe("pass");
  });

  it("is unknown when the resume is silent", () => {
    expect(statusOf("visa", { visaSponsorship: "not_offered", workAuthorizationRequired: "" }, { workAuthorization: "" })).toBe("unknown");
  });

  it("passes stated authorization and fails a stated need for sponsorship", () => {
    expect(statusOf("visa", { visaSponsorship: "not_offered" }, { workAuthorization: "US Citizen" })).toBe("pass");
    expect(statusOf("visa", { visaSponsorship: "not_offered" }, { workAuthorization: "Requires H-1B sponsorship" })).toBe("fail");
  });

  it("doesn't guess at wording it can't interpret", () => {
    expect(statusOf("visa", { workAuthorizationRequired: "Must hold SC clearance" }, { workAuthorization: "Stamp 4" })).toBe("unknown");
  });
});

describe("education", () => {
  it.each([
    ["bachelor", ["B.Sc. Computer Science"], "pass"],
    ["bachelor", ["Master of Science"], "pass"],
    ["master", ["BA History"], "fail"],
    ["phd", ["Ph.D. Physics"], "pass"],
    ["bachelor", ["Bootcamp Certificate"], "unknown"],
    ["none", [], "not_required"],
  ] as const)("job needs %s, resume has %j: %s", (educationLevel, names, expected) => {
    expect(statusOf("education", { educationLevel }, { education: degrees(...names) })).toBe(expected);
  });

  it("warns instead of failing when equivalent experience is accepted", () => {
    expect(statusOf("education", { educationLevel: "master", educationEquivalentAccepted: true }, { education: degrees("BS") })).toBe("warn");
  });
});
