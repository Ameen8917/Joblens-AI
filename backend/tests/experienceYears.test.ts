import { describe, expect, it } from "vitest";
import { parseDuration, yearsFromWorkHistory } from "../src/services/experienceYears";

const TODAY = new Date(2026, 9, 15); // October 2026
const work = (...items: [string, string][]) => items.map(([role, duration]) => ({ company: "", role, duration, highlights: [] }));

describe("parseDuration", () => {
  it.each([
    ["Feb 2022 - Oct 2026", 57],
    ["January 2019 – January 2022", 37],
    ["03/2020 - 02/2021", 12],
    ["2019-03 - 2021-04", 26],
    ["2018 - 2020", 36],
    ["Sept 2025 to Present", 14],
  ])("reads %j as %d months", (duration, months) => {
    const range = parseDuration(duration, TODAY);
    expect(range && range[1] - range[0]).toBe(months);
  });

  it.each(["", "3 years", "Summer 2024", "Oct 2026 - Feb 2022"])("can't read %j", duration => {
    expect(parseDuration(duration, TODAY)).toBeNull();
  });
});

describe("yearsFromWorkHistory", () => {
  it("adds up the roles on the two-column resume the model read as 5 years", () => {
    expect(yearsFromWorkHistory(work(["Senior ML Engineer", "Feb 2022 - Oct 2026"], ["Data Scientist", "Jan 2019 - Jan 2022"]), TODAY)).toBe(7.8);
  });

  it("counts overlapping roles once", () => {
    expect(yearsFromWorkHistory(work(["Engineer", "Jan 2020 - Dec 2021"], ["Consultant", "Jan 2021 - Dec 2022"]), TODAY)).toBe(3);
  });

  it("leaves out internships", () => {
    expect(yearsFromWorkHistory(work(["Software Engineering Intern", "May 2025 - Aug 2025"]), TODAY)).toBe(0);
    expect(yearsFromWorkHistory(work(["Intern", "Jan 2020 - Dec 2020"], ["Engineer", "Jan 2021 - Dec 2021"]), TODAY)).toBe(1);
  });

  it("gives up rather than undercount when any role's dates can't be read", () => {
    expect(yearsFromWorkHistory(work(["Engineer", "Jan 2021 - Dec 2021"], ["Developer", "a few years"]), TODAY)).toBeNull();
    expect(yearsFromWorkHistory([], TODAY)).toBeNull();
  });
});
