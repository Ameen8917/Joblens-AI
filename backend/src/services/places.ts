/**
 * Just enough geography to tell that "Austin, TX" is in the US and "Warsaw, Poland" is in Europe. It covers
 * US states, Canadian provinces, countries and the regions job posts name. A city outside this list still
 * matches by name in the location check; it just can't be placed inside a larger area.
 */

const US_STATES: [string, string][] = [
  ["al", "alabama"], ["ak", "alaska"], ["az", "arizona"], ["ar", "arkansas"], ["ca", "california"], ["co", "colorado"],
  ["ct", "connecticut"], ["de", "delaware"], ["dc", "district of columbia"], ["fl", "florida"], ["ga", "georgia"],
  ["hi", "hawaii"], ["id", "idaho"], ["il", "illinois"], ["in", "indiana"], ["ia", "iowa"], ["ks", "kansas"],
  ["ky", "kentucky"], ["la", "louisiana"], ["me", "maine"], ["md", "maryland"], ["ma", "massachusetts"],
  ["mi", "michigan"], ["mn", "minnesota"], ["ms", "mississippi"], ["mo", "missouri"], ["mt", "montana"],
  ["ne", "nebraska"], ["nv", "nevada"], ["nh", "new hampshire"], ["nj", "new jersey"], ["nm", "new mexico"],
  ["ny", "new york"], ["nc", "north carolina"], ["nd", "north dakota"], ["oh", "ohio"], ["ok", "oklahoma"],
  ["or", "oregon"], ["pa", "pennsylvania"], ["ri", "rhode island"], ["sc", "south carolina"], ["sd", "south dakota"],
  ["tn", "tennessee"], ["tx", "texas"], ["ut", "utah"], ["vt", "vermont"], ["va", "virginia"], ["wa", "washington"],
  ["wv", "west virginia"], ["wi", "wisconsin"], ["wy", "wyoming"],
];

const CA_PROVINCES: [string, string][] = [
  ["ab", "alberta"], ["bc", "british columbia"], ["mb", "manitoba"], ["nb", "new brunswick"],
  ["nl", "newfoundland and labrador"], ["ns", "nova scotia"], ["nt", "northwest territories"], ["nu", "nunavut"],
  ["on", "ontario"], ["pe", "prince edward island"], ["qc", "quebec"], ["sk", "saskatchewan"], ["yt", "yukon"],
];

const COUNTRY_ALIASES: Record<string, string[]> = {
  "united states": ["us", "usa", "united states of america", "america"],
  "united kingdom": ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland"],
  "netherlands": ["the netherlands", "holland"],
  "czechia": ["czech republic"],
  "united arab emirates": ["uae"],
  "south korea": ["korea"],
};

// Nationalities, as in "German citizen" or "Canadian permanent resident".
const DEMONYMS: Record<string, string> = {
  american: "united states", canadian: "canada", mexican: "mexico", british: "united kingdom", irish: "ireland",
  german: "germany", french: "france", spanish: "spain", italian: "italy", dutch: "netherlands", polish: "poland",
  portuguese: "portugal", swedish: "sweden", danish: "denmark", finnish: "finland", norwegian: "norway",
  swiss: "switzerland", austrian: "austria", belgian: "belgium", czech: "czechia", greek: "greece",
  romanian: "romania", hungarian: "hungary", ukrainian: "ukraine", indian: "india", chinese: "china",
  japanese: "japan", korean: "south korea", singaporean: "singapore", australian: "australia",
  "new zealander": "new zealand", brazilian: "brazil", argentine: "argentina", israeli: "israel",
  emirati: "united arab emirates", nigerian: "nigeria", "south african": "south africa", pakistani: "pakistan",
  filipino: "philippines", vietnamese: "vietnam",
};

const EU = [
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "denmark", "estonia", "finland", "france",
  "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands",
  "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
];
const OTHER_EUROPE = [
  "united kingdom", "norway", "switzerland", "iceland", "liechtenstein", "ukraine", "serbia", "albania",
  "bosnia and herzegovina", "montenegro", "north macedonia", "moldova",
];
const NORTH_AMERICA = ["united states", "canada", "mexico"];
const LATIN_AMERICA = ["mexico", "brazil", "argentina", "chile", "colombia", "peru", "uruguay", "costa rica"];
const APAC = [
  "india", "china", "japan", "south korea", "singapore", "australia", "new zealand", "indonesia", "philippines",
  "vietnam", "thailand", "malaysia", "pakistan", "bangladesh",
];
const MIDDLE_EAST_AFRICA = ["united arab emirates", "israel", "saudi arabia", "turkey", "egypt", "south africa", "nigeria", "kenya", "morocco"];

/** Each region and the countries in it. "eea" and "schengen" are close enough to treat like the EU plus neighbours. */
const REGIONS: Record<string, string[]> = {
  eu: EU,
  "european union": EU,
  eea: [...EU, "norway", "iceland", "liechtenstein"],
  europe: [...EU, ...OTHER_EUROPE],
  "north america": NORTH_AMERICA,
  "latin america": LATIN_AMERICA,
  latam: LATIN_AMERICA,
  apac: APAC,
  "asia pacific": APAC,
  emea: [...EU, ...OTHER_EUROPE, ...MIDDLE_EAST_AFRICA],
};

const COUNTRIES = [...new Set([...Object.keys(COUNTRY_ALIASES), ...Object.values(REGIONS).flat()])];

/** Every recognised name, mapped to the canonical area it means. Two-letter codes are kept apart, since "in" and "de" are also words. */
const NAMES = new Map<string, string>();
const CODES = new Map<string, string>();
for (const country of COUNTRIES) NAMES.set(country, country);
for (const [country, aliases] of Object.entries(COUNTRY_ALIASES)) for (const alias of aliases) NAMES.set(alias, country);
for (const region of Object.keys(REGIONS)) NAMES.set(region, region);
for (const [demonym, country] of Object.entries(DEMONYMS)) NAMES.set(demonym, country);
for (const [code, state] of US_STATES) { NAMES.set(state, state); CODES.set(code, state); }
for (const [code, province] of CA_PROVINCES) { NAMES.set(province, province); CODES.set(code, province); }
// "us" is safe as a code, and the US is often written that way.
CODES.set("us", "united states");

const PARENT_COUNTRY = new Map<string, string>([
  ...US_STATES.map(([, state]): [string, string] => [state, "united states"]),
  ...CA_PROVINCES.map(([, province]): [string, string] => [province, "canada"]),
]);

const MAX_NAME_WORDS = 4;

/** Lowercases and drops the dots in abbreviations, so "U.S." reads as "us". */
const words = (text: string): string[] => text.toLowerCase().replace(/\./g, "").match(/[\p{L}\p{N}]+/gu) ?? [];

/** The areas a piece of text names, as written: "Austin, TX" gives texas, "EU citizen" gives eu. */
export const namedAreas = (text: string): Set<string> => {
  const found = new Set<string>();
  for (const part of text.split(/[,;/|()]/)) {
    const partWords = words(part);
    // A part that is only a code, as in "Austin, TX", is a state or province. Inside a sentence it's probably a word.
    if (partWords.length === 1 && CODES.has(partWords[0])) found.add(CODES.get(partWords[0])!);
    for (let length = MAX_NAME_WORDS; length >= 1; length--) {
      for (let start = 0; start + length <= partWords.length; start++) {
        const name = NAMES.get(partWords.slice(start, start + length).join(" "));
        if (name) found.add(name);
      }
    }
  }
  return found;
};

/** An area with everything that contains it: texas gives texas, united states and north america. */
export const enclosingAreas = (area: string): Set<string> => {
  const result = new Set([area]);
  const country = PARENT_COUNTRY.get(area) ?? area;
  result.add(country);
  for (const [region, members] of Object.entries(REGIONS)) if (members.includes(country)) result.add(region);
  return result;
};

/** Country level or broader: a state is replaced by its country. */
export const toCountryLevel = (area: string): string => PARENT_COUNTRY.get(area) ?? area;

const FILLER = new Set(["remote", "within", "in", "anywhere", "only", "based", "the", "or", "and", "across", "hybrid", "onsite", "on", "site"]);

/**
 * The areas a job location means when it names nothing smaller, as in "US", "Remote within Canada" or
 * "Remote (US or Canada)". Null when any of it is a city or not recognised, which must then match by name.
 */
export const wholeAreas = (place: string): string[] | null => {
  const meaningful = words(place).filter(word => !FILLER.has(word));
  if (meaningful.length === 0) return null;
  if (meaningful.length === 1 && CODES.has(meaningful[0])) return [CODES.get(meaningful[0])!];
  const areas: string[] = [];
  for (let start = 0; start < meaningful.length;) {
    const length = [...Array(Math.min(MAX_NAME_WORDS, meaningful.length - start)).keys()].map(i => i + 1).reverse()
      .find(n => NAMES.has(meaningful.slice(start, start + n).join(" ")));
    if (!length) return null;
    areas.push(NAMES.get(meaningful.slice(start, start + length).join(" "))!);
    start += length;
  }
  return areas;
};

/** Whether a place is within an area, as Warsaw, Poland is within Europe. */
export const isWithin = (place: string, area: string): boolean =>
  [...namedAreas(place)].some(found => enclosingAreas(found).has(area));

/**
 * Whether a right to work in `held` covers `needed`. Either side can be broader: an EU citizen can work in
 * Germany, and a German citizen can work anywhere in the EU. Compared at country level, since a US work permit
 * isn't limited to one state.
 */
export const authorizationCovers = (held: Set<string>, needed: Set<string>): boolean => {
  const heldCountries = [...held].map(toCountryLevel);
  const neededCountries = [...needed].map(toCountryLevel);
  return heldCountries.some(h => neededCountries.some(n => enclosingAreas(n).has(h) || enclosingAreas(h).has(n)));
};
