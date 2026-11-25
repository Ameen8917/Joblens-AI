import { existsSync, readFileSync, writeFileSync } from "fs";
import { ResponseCache, setResponseCache } from "./gemini";

/**
 * For recording demos: with DEMO_CACHE set to a JSON file path, every Gemini response is saved there and replayed
 * on the next identical request. The first take calls Gemini for real; retakes show the same real responses
 * without using quota. Off unless the variable is set.
 */
export const initDemoCache = (): void => {
  const file = process.env.DEMO_CACHE;
  if (!file) return;
  const entries: Record<string, unknown> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const cache: ResponseCache = {
    get: key => entries[key],
    set: (key, value) => { entries[key] = value; writeFileSync(file, JSON.stringify(entries)); },
    // A replayed follow-up is shown word by word, as it was when Gemini streamed it.
    streamReplayDelayMs: 45,
  };
  setResponseCache(cache);
  console.log(`🎬 Demo cache on: ${file} (${Object.keys(entries).length} saved responses)`);
};
