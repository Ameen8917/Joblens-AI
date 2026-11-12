/**
 * Quality eval: runs the real parsers and scorer over the labelled fixtures and reports accuracy.
 *
 *   npm run eval                     replay cached Gemini responses, calling Gemini only for new requests
 *   npm run eval -- --fresh          ignore the cache and call Gemini for everything
 *   npm run eval -- --update-baseline  save these results as the baseline to compare against
 *
 * The cache key covers the model, schema and prompt, so any change to them calls Gemini again.
 * Exits with 1 if a case fails or a metric drops more than TOLERANCE below the baseline.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import { initGemini, setResponseCache } from "../src/config/gemini";
import { MIN_QUOTE_CHARS, quoteExists } from "../src/services/evidence";
import { extractJD } from "../src/services/jdParser";
import { extractResume } from "../src/services/resumeParser";
import {
  combineScores, computeScore, cosineSimilarity, mentionsSkill, SEMANTIC_CALIBRATION, toSemanticScore,
} from "../src/services/scorer";
import { EvidenceLevel, ParsedJD, ParsedResume } from "../src/types";
import { Fit, JOBS, PAIRS, RESUMES } from "./cases";
import {
  accepts, compareSkills, findRegressions, fitFromScore, rankingAccuracy, ratio, sameSkill, suggestCalibration,
} from "./metrics";
import { textToPdf } from "./textPdf";

const EVAL_DIR = __dirname;
const CACHE_FILE = join(EVAL_DIR, "cache.json");
const BASELINE_FILE = join(EVAL_DIR, "baseline.json");
const RESULTS_FILE = join(EVAL_DIR, "results.json");
const TOLERANCE = 0.05;
const CONCURRENCY = 3;

dotenv.config({ path: join(EVAL_DIR, "..", ".env") });
const args = new Set(process.argv.slice(2));
const fresh = args.has("--fresh");

// ---------- Gemini, with a replay cache ----------

// Strips the byte-order mark some Windows editors add, which JSON.parse rejects.
const readJson = <T>(file: string, fallback: T): T =>
  (existsSync(file) ? JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) : fallback);
const stored: Record<string, unknown> = fresh ? {} : readJson(CACHE_FILE, {});
const used: Record<string, unknown> = {};
let liveCalls = 0;
setResponseCache({
  get: key => {
    if (key in stored) used[key] = stored[key];
    return stored[key];
  },
  set: (key, value) => { used[key] = value; liveCalls++; },
});

const hasKey = Boolean(process.env.GEMINI_API_KEY);
if (hasKey) initGemini();
else if (fresh) throw new Error("--fresh needs GEMINI_API_KEY in backend/.env");

const mapLimit = async <T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

// The free tier allows 5 requests a minute, which the app's own short retries don't wait out.
const RATE_LIMIT_WAIT_MS = 65_000;
const RATE_LIMIT_ATTEMPTS = 4;
const isRateLimited = (error: unknown) => (error as { statusCode?: number }).statusCode === 503;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };
const attempt = async <T>(label: string, run: () => Promise<T>): Promise<Outcome<T>> => {
  for (let tries = 1; ; tries++) {
    try {
      return { ok: true, value: await run() };
    } catch (error) {
      if (isRateLimited(error) && tries < RATE_LIMIT_ATTEMPTS) {
        console.log(`  ${label}: rate limited, waiting ${RATE_LIMIT_WAIT_MS / 1000}s`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: hasKey ? message : `${message} (no cached response, and GEMINI_API_KEY isn't set)` };
    }
  }
};

const fixture = (kind: "jobs" | "resumes", id: string) => readFileSync(join(EVAL_DIR, "fixtures", kind, `${id}.txt`), "utf8");

// ---------- Report helpers ----------

const pct = (value: number | null) => (value == null ? "  n/a" : `${(value * 100).toFixed(0).padStart(4)}%`);
const lines: string[] = [];
const say = (line = "") => { lines.push(line); console.log(line); };
const heading = (title: string) => { say(); say(title); say("-".repeat(title.length)); };
const problem = (line: string) => say(`  x ${line}`);

const EVIDENCE_RANK: Record<EvidenceLevel, number> = { demonstrated: 2, listed: 1, unverified: 0 };

const main = async () => {
  const started = Date.now();
  const jobRuns = await mapLimit(JOBS, CONCURRENCY, job => attempt(`job ${job.id}`, () => extractJD(fixture("jobs", job.id))));
  const resumeRuns = await mapLimit(RESUMES, CONCURRENCY, resume =>
    attempt(`resume ${resume.id}`, () => extractResume(textToPdf(fixture("resumes", resume.id), resume.columns))));

  const failures: string[] = [];
  const jobs = new Map<string, { parsed: ParsedJD; embedding: number[] }>();
  const resumes = new Map<string, { parsed: ParsedResume; rawText: string; embedding: number[] }>();
  JOBS.forEach((job, i) => {
    const run = jobRuns[i];
    if (run.ok) jobs.set(job.id, run.value); else failures.push(`job ${job.id}: ${run.error}`);
  });
  RESUMES.forEach((resume, i) => {
    const run = resumeRuns[i];
    if (run.ok) resumes.set(resume.id, run.value); else failures.push(`resume ${resume.id}: ${run.error}`);
  });

  // ---------- Job parsing ----------
  heading("Job parsing");
  let reqFound = 0, reqTotal = 0, reqExtra = 0, niceFound = 0, niceTotal = 0, jdFieldsOk = 0, jdFields = 0;
  for (const job of JOBS) {
    const result = jobs.get(job.id);
    if (!result) continue;
    const { parsed } = result;
    const e = job.expected;
    const req = compareSkills(e.requiredSkills, parsed.requiredSkills, e.acceptableExtras);
    const nice = compareSkills(e.niceToHaveSkills, parsed.niceToHaveSkills);
    reqFound += req.found.length; reqTotal += e.requiredSkills.length; reqExtra += req.extra.length;
    niceFound += nice.found.length; niceTotal += e.niceToHaveSkills.length;
    const fields: [string, boolean, unknown, unknown][] = [
      ["yearsOfExperience", parsed.yearsOfExperience === e.yearsOfExperience, e.yearsOfExperience, parsed.yearsOfExperience],
      ["seniority", accepts(e.seniority, parsed.seniority), e.seniority, parsed.seniority],
      ["workMode", accepts(e.workMode, parsed.workMode), e.workMode, parsed.workMode],
      ["visaSponsorship", accepts(e.visaSponsorship, parsed.visaSponsorship), e.visaSponsorship, parsed.visaSponsorship],
      ["educationLevel", accepts(e.educationLevel, parsed.educationLevel), e.educationLevel, parsed.educationLevel],
    ];
    if (e.educationEquivalentAccepted !== undefined) {
      fields.push(["educationEquivalentAccepted", parsed.educationEquivalentAccepted === e.educationEquivalentAccepted,
        e.educationEquivalentAccepted, parsed.educationEquivalentAccepted]);
    }
    jdFieldsOk += fields.filter(([, ok]) => ok).length; jdFields += fields.length;
    say(`${job.id}: required ${req.found.length}/${e.requiredSkills.length}, nice-to-have ${nice.found.length}/${e.niceToHaveSkills.length}, fields ${fields.filter(([, ok]) => ok).length}/${fields.length}`);
    if (req.missed.length) problem(`required skills not extracted: ${req.missed.join(", ")}`);
    if (req.extra.length) problem(`unexpected required skills: ${req.extra.join(", ")}`);
    if (nice.missed.length) problem(`nice-to-have skills not extracted: ${nice.missed.join(", ")}`);
    for (const [name, ok, want, got] of fields) if (!ok) problem(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }

  // ---------- Resume parsing and evidence ----------
  heading("Resume parsing and evidence");
  let skillFound = 0, skillTotal = 0, resFieldsOk = 0, resFields = 0;
  let confirmed = 0, levelOk = 0, evidenceTotal = 0;
  for (const resume of RESUMES) {
    const result = resumes.get(resume.id);
    if (!result) continue;
    const { parsed, rawText } = result;
    const e = resume.expected;
    const skills = compareSkills(e.skills, [...parsed.skills, ...parsed.tools]);
    skillFound += skills.found.length; skillTotal += e.skills.length;
    const fields: [string, boolean, unknown, unknown][] = [
      ["yearsOfExperience", parsed.yearsOfExperience >= e.yearsOfExperience[0] && parsed.yearsOfExperience <= e.yearsOfExperience[1],
        e.yearsOfExperience, parsed.yearsOfExperience],
      ["location", parsed.location.toLowerCase().includes(e.location), e.location, parsed.location],
      ["workAuthorization", Boolean(parsed.workAuthorization.trim()) === e.statesWorkAuthorization,
        e.statesWorkAuthorization ? "stated" : "empty", parsed.workAuthorization],
    ];
    resFieldsOk += fields.filter(([, ok]) => ok).length; resFields += fields.length;

    const evidenceProblems: string[] = [];
    let caseConfirmed = 0;
    const labelled: [string, EvidenceLevel][] = [
      ...e.demonstrated.map((s): [string, EvidenceLevel] => [s, "demonstrated"]),
      ...e.listedOnly.map((s): [string, EvidenceLevel] => [s, "listed"]),
    ];
    for (const [skill, want] of labelled) {
      const best = parsed.skillEvidence
        .filter(item => sameSkill(skill, item.skill))
        .sort((a, b) => EVIDENCE_RANK[b.level] - EVIDENCE_RANK[a.level])[0];
      evidenceTotal++;
      if (best && best.level !== "unverified") { confirmed++; caseConfirmed++; }
      if (best?.level === want) { levelOk++; continue; }
      if (!best) evidenceProblems.push(`${skill}: no quote given (expected ${want})`);
      else if (best.level !== "unverified") evidenceProblems.push(`${skill}: graded ${best.level}, expected ${want} (${best.section}: "${best.quote}")`);
      else {
        const reason = best.quote.replace(/[^\p{L}\p{N}+#]/gu, "").length < MIN_QUOTE_CHARS ? "quote too short to check"
          : !quoteExists(best.quote, rawText) ? "quote not found in PDF text"
          : !mentionsSkill(best.quote, skill) ? "quote doesn't name the skill" : "unknown";
        evidenceProblems.push(`${skill}: ${reason}, expected ${want} ("${best.quote}")`);
      }
    }
    const allQuotes = parsed.skillEvidence.length;
    const verifiedQuotes = parsed.skillEvidence.filter(item => item.level !== "unverified").length;
    say(`${resume.id}${resume.columns === 2 ? " (two columns)" : ""}: skills ${skills.found.length}/${e.skills.length}, fields ${fields.filter(([, ok]) => ok).length}/${fields.length}, ` +
      `labelled skills confirmed ${caseConfirmed}/${labelled.length}, all quotes confirmed ${verifiedQuotes}/${allQuotes}`);
    if (skills.missed.length) problem(`skills not extracted: ${skills.missed.join(", ")}`);
    for (const [name, ok, want, got] of fields) if (!ok) problem(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    evidenceProblems.forEach(problem);
  }

  // ---------- Pairs: matching, checks and scores ----------
  heading("Skill matching and requirement checks");
  let matchOk = 0, matchTotal = 0, checksOk = 0, checksTotal = 0;
  const scored: { pair: string; fit: Fit; similarity: number; programmatic: number; semantic: number; final: number }[] = [];
  for (const pair of PAIRS) {
    const job = jobs.get(pair.job), resume = resumes.get(pair.resume);
    if (!job || !resume) continue;
    const name = `${pair.resume} x ${pair.job}`;
    const jobCase = JOBS.find(j => j.id === pair.job)!;
    const score = computeScore(job.parsed, resume.parsed, job.embedding, resume.embedding);
    const pairProblems: string[] = [];

    for (const skill of jobCase.expected.requiredSkills) {
      const match = score.matchedSkills.find(m => sameSkill(skill, m.skill));
      if (!match) continue; // Not extracted from the job, which job parsing already reports.
      matchTotal++;
      const expectedHas = pair.has.some(h => sameSkill(h, skill));
      const predictedHas = match.status !== "missing";
      const partialOk = match.status === "partial" && (pair.partialOk ?? []).some(p => sameSkill(p, skill));
      if (expectedHas === predictedHas || partialOk) matchOk++;
      else pairProblems.push(`${skill}: expected ${expectedHas ? "a match" : "missing"}, got ${match.status}`);
    }

    for (const [id, want] of Object.entries(pair.checks)) {
      const check = score.hardChecks.find(c => c.id === id)!;
      checksTotal++;
      if (accepts(want, check.status)) checksOk++;
      else pairProblems.push(`${id} check: expected ${JSON.stringify(want)}, got "${check.status}" (${check.detail})`);
    }

    scored.push({
      pair: name, fit: pair.fit, similarity: cosineSimilarity(job.embedding, resume.embedding),
      programmatic: score.programmaticScore, semantic: score.semanticScore, final: score.finalScore,
    });
    if (pairProblems.length) { say(name); pairProblems.forEach(problem); }
  }
  say(`skill matches correct ${matchOk}/${matchTotal}, requirement checks correct ${checksOk}/${checksTotal}`);

  // ---------- Scores and calibration ----------
  heading("Scores by labelled fit");
  say("pair".padEnd(44) + "fit".padEnd(10) + "cosine  semantic  skills  final  predicted");
  for (const s of [...scored].sort((a, b) => b.similarity - a.similarity)) {
    const predicted = fitFromScore(s.final);
    say(`${s.pair.padEnd(44)}${s.fit.padEnd(10)}${s.similarity.toFixed(3).padStart(6)}  ${String(s.semantic).padStart(8)}  ${String(s.programmatic).padStart(6)}  ${String(s.final).padStart(5)}  ${predicted}${predicted === s.fit ? "" : "  x"}`);
  }
  for (const fit of ["strong", "moderate", "weak"] as Fit[]) {
    const values = scored.filter(s => s.fit === fit).map(s => s.similarity);
    if (!values.length) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    say(`${fit.padEnd(9)} cosine mean ${mean.toFixed(3)}, range ${Math.min(...values).toFixed(3)} to ${Math.max(...values).toFixed(3)} (${values.length} pairs)`);
  }

  const labelAccuracy = (finals: number[]) => ratio(scored.filter((s, i) => fitFromScore(finals[i]) === s.fit).length, scored.length);
  const suggested = suggestCalibration(scored);
  const current = SEMANTIC_CALIBRATION;
  say();
  say(`current calibration: cosine ${current.floor} scores 0 and ${current.ceiling} scores 100`);
  if (suggested) {
    const recalibrated = scored.map(s => combineScores(toSemanticScore(s.similarity, suggested), s.programmatic));
    say(`suggested calibration: { floor: ${suggested.floor.toFixed(3)}, ceiling: ${suggested.ceiling.toFixed(3)} }`);
    say(`fit labels correct: ${pct(labelAccuracy(scored.map(s => s.final)))} now, ${pct(labelAccuracy(recalibrated))} with the suggested calibration`);
    say(`  (fitted on these ${scored.length} pairs, so the second number is optimistic until there are more)`);
  }

  // ---------- Summary and baseline ----------
  const metrics: Record<string, number | null> = {
    jdRequiredRecall: ratio(reqFound, reqTotal),
    jdRequiredPrecision: ratio(reqFound, reqFound + reqExtra),
    jdNiceToHaveRecall: ratio(niceFound, niceTotal),
    jdFieldAccuracy: ratio(jdFieldsOk, jdFields),
    resumeSkillRecall: ratio(skillFound, skillTotal),
    resumeFieldAccuracy: ratio(resFieldsOk, resFields),
    quoteConfirmedRate: ratio(confirmed, evidenceTotal),
    evidenceLevelAccuracy: ratio(levelOk, evidenceTotal),
    skillMatchAccuracy: ratio(matchOk, matchTotal),
    hardCheckAccuracy: ratio(checksOk, checksTotal),
    fitLabelAccuracy: labelAccuracy(scored.map(s => s.final)),
    scoreRanking: rankingAccuracy(scored.map(s => ({ fit: s.fit, value: s.final }))),
    similarityRanking: rankingAccuracy(scored.map(s => ({ fit: s.fit, value: s.similarity }))),
  };

  const baseline = readJson<Record<string, number | null> | null>(BASELINE_FILE, null);
  heading("Summary");
  for (const [metric, value] of Object.entries(metrics)) {
    const base = baseline?.[metric];
    const change = base == null || value == null ? "" : `  (baseline ${pct(base).trim()})`;
    say(`${metric.padEnd(24)}${pct(value)}${change}`);
  }
  if (failures.length) { say(); say("Failed cases:"); failures.forEach(problem); }
  say();
  say(`${liveCalls} live Gemini calls, ${Object.keys(used).length - liveCalls} replayed from the cache, ${((Date.now() - started) / 1000).toFixed(0)}s`);

  writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(Object.keys(used).sort().map(k => [k, used[k]]))));
  writeFileSync(RESULTS_FILE, JSON.stringify({ metrics, scored, failures, report: lines }, null, 2));

  if (args.has("--update-baseline")) {
    if (failures.length) throw new Error("Not updating the baseline while cases fail");
    writeFileSync(BASELINE_FILE, `${JSON.stringify(metrics, null, 2)}\n`);
    say("Baseline updated.");
    return;
  }
  const regressions = baseline ? findRegressions(baseline, metrics, TOLERANCE) : [];
  regressions.forEach(r => problem(`${r.metric} dropped from ${pct(r.baseline).trim()} to ${pct(r.current).trim()}`));
  if (!baseline) say("No baseline yet. Run with --update-baseline to save one.");
  if (failures.length || regressions.length) process.exitCode = 1;
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
