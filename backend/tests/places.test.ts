import { describe, expect, it } from "vitest";
import { authorizationCovers, isWithin, namedAreas, wholeAreas } from "../src/services/places";

describe("namedAreas", () => {
  it.each([
    ["Austin, TX", ["texas"]],
    ["Toronto, ON", ["ontario"]],
    ["U.S. citizen", ["united states"]],
    ["EU citizen", ["eu"]],
    ["Berlin, Germany (open to remote work across the EU)", ["germany", "eu"]],
    ["London, UK", ["united kingdom"]],
  ])("finds the areas in %j", (text, areas) => {
    expect([...namedAreas(text)].sort()).toEqual([...areas].sort());
  });

  it("reads a two-letter code only when it stands alone, not as a word in a sentence", () => {
    expect(namedAreas("Fort Wayne, IN").has("indiana")).toBe(true);
    expect(namedAreas("Authorized to work in Canada").has("indiana")).toBe(false);
  });
});

describe("wholeAreas", () => {
  it.each([
    ["US", ["united states"]],
    ["Remote within Canada", ["canada"]],
    ["Remote (US or Canada)", ["united states", "canada"]],
    ["Europe", ["europe"]],
  ])("reads %j as a whole area", (place, areas) => {
    expect(wholeAreas(place)).toEqual(areas);
  });

  it("is null for a city, which must match by name", () => {
    expect(wholeAreas("Austin, TX")).toBeNull();
    expect(wholeAreas("Remote, Springfield")).toBeNull();
  });
});

describe("isWithin", () => {
  it("places states, provinces and countries inside larger areas", () => {
    expect(isWithin("Austin, TX", "united states")).toBe(true);
    expect(isWithin("Austin, TX", "north america")).toBe(true);
    expect(isWithin("Warsaw, Poland", "europe")).toBe(true);
    expect(isWithin("London, UK", "eu")).toBe(false);
    expect(isWithin("Seattle, WA", "canada")).toBe(false);
  });
});

describe("authorizationCovers", () => {
  const set = (...areas: string[]) => new Set(areas);

  it("covers the same country, and a country inside a held region or the reverse", () => {
    expect(authorizationCovers(set("united states"), set("texas"))).toBe(true);
    expect(authorizationCovers(set("eu"), set("germany"))).toBe(true);
    expect(authorizationCovers(set("germany"), set("eu"))).toBe(true);
  });

  it("doesn't cover a different country or region", () => {
    expect(authorizationCovers(set("united states"), set("eu"))).toBe(false);
    expect(authorizationCovers(set("eu"), set("united states"))).toBe(false);
    expect(authorizationCovers(set("united kingdom"), set("eu"))).toBe(false);
  });
});
