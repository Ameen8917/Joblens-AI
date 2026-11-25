/**
 * Drives the running JobLens app through a full walkthrough and records it.
 *
 *   node record.mjs --live    First take. Waits on real Gemini responses (the backend's DEMO_CACHE saves them).
 *   node record.mjs --paced   Retake. Responses replay from the cache, and each scene lasts as long as its narration
 *                             (output/voice/durations.json), so the voice lines up with the screen.
 *
 * Writes output/<mode>/video.webm, timeline.json (scene start and end seconds) and screenshots.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODE = process.argv.includes('--paced') ? 'paced' : 'live';
const PACED = MODE === 'paced';
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const OUT = join(HERE, 'output', MODE);
const SHOTS = join(OUT, 'shots');
const WAIT = PACED ? 60_000 : 240_000; // a live take waits on Gemini, retries included
const GAP_AFTER_NARRATION = 0.7;
const W = 1440, H = 900;

const RESUME = join(HERE, 'fixtures', 'jordan-avery-resume.pdf');
const JOB = readFileSync(join(HERE, '..', 'backend', 'eval', 'fixtures', 'jobs', 'backend-senior.txt'), 'utf8').trim();
const JOB_2 = readFileSync(join(HERE, '..', 'backend', 'eval', 'fixtures', 'jobs', 'frontend.txt'), 'utf8').trim();

const durations = PACED ? JSON.parse(readFileSync(join(HERE, 'output', 'voice', 'durations.json'), 'utf8')) : {};

// ---------- A visible cursor, since recorded video has none ----------
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l6.8 18.2 2.5-7.6 7.7-2.4z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-100px,-100px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))' });
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 18 + 'px', top: e.clientY - 18 + 'px', width: '36px', height: '36px', borderRadius: '50%',
        background: 'rgba(16,185,129,.35)', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out' });
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();`;

// ---------- Setup ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: W, height: H }, colorScheme: 'light', acceptDownloads: true,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
await context.addInitScript(CURSOR);
const page = await context.newPage();
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const mouse = { x: W / 2, y: H / 2 };
const timeline = [];
let sceneStart = 0, sceneId = '';

// ---------- Helpers ----------
const pause = ms => page.waitForTimeout(ms);

/** Waits until a share of the current scene's narration has played (paced), or briefly (live). */
const beat = async (share, liveMs = 700) => {
  if (!PACED) return pause(liveMs);
  const target = sceneStart + (durations[sceneId] ?? 0) * share;
  if (target > now()) await pause((target - now()) * 1000);
};

const scene = async (id, run) => {
  sceneId = id; sceneStart = now();
  console.log(`▶ ${id} at ${sceneStart.toFixed(1)}s`);
  await run();
  await beat(1, 400);
  if (PACED && durations[id]) await pause(GAP_AFTER_NARRATION * 1000);
  timeline.push({ id: sceneId, start: sceneStart, end: now() }); // a scene can hand over to a follow-up scene
};

const failIfError = async () => {
  const alert = page.getByRole('alert');
  if (await alert.count()) throw new Error(`App error: ${await alert.first().innerText()}`);
  const aiError = page.getByText(/The AI service|follow-up question failed/);
  if (await aiError.count()) throw new Error(`App error: ${await aiError.first().innerText()}`);
};

const waitFor = async (locator, timeout = WAIT) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await locator.first().isVisible().catch(() => false)) return locator.first();
    await failIfError();
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${locator}`);
};

const moveTo = async locator => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Not on screen: ${locator}`);
  const x = box.x + box.width / 2, y = box.y + Math.min(box.height / 2, 24);
  const steps = Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 18));
  await page.mouse.move(x, y, { steps });
  Object.assign(mouse, { x, y });
};

const click = async locator => {
  const el = locator.first();
  await reveal(el, 'center');
  await moveTo(el);
  await pause(250);
  await el.click();
  await pause(300);
};

/** Smoothly scrolls the app's scroll area so the element sits near the top (or centre) of the screen. */
const reveal = async (locator, block = 'top', ms = 900) => {
  const el = locator.first();
  await el.waitFor({ state: 'attached' });
  await el.evaluate((node, { block, ms }) => new Promise(resolve => {
    const main = document.querySelector('main');
    if (!main.contains(node)) return resolve(); // the sidebar doesn't scroll with the page
    const r = node.getBoundingClientRect(), m = main.getBoundingClientRect();
    const offset = block === 'center' ? (m.height - Math.min(r.height, m.height)) / 2 : 24;
    const target = Math.max(0, Math.min(main.scrollHeight - main.clientHeight, main.scrollTop + r.top - m.top - offset));
    const from = main.scrollTop, dist = target - from;
    if (Math.abs(dist) < 4) return resolve();
    const start = performance.now();
    const step = t => {
      const p = Math.min(1, (t - start) / ms), ease = p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      main.scrollTop = from + dist * ease;
      p < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  }), { block, ms });
  await pause(150);
};

const scrollTop = async (ms = 900) => reveal(page.locator('main > header'), 'top', ms);

const shot = async name => {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`  📸 ${name}`);
};

const typeInto = async (locator, text, delay = 14) => {
  await click(locator);
  await locator.first().pressSequentially(text, { delay });
};

const uploadResume = async () => {
  const zone = page.getByText('Drop your resume here or click to upload');
  await reveal(zone, 'center');
  await moveTo(zone);
  await pause(300);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), zone.click()]);
  await chooser.setFiles(RESUME);
  await waitFor(page.getByText('Resume parsed successfully'));
};

const parseJob = async text => {
  const box = page.getByLabel('Job description');
  await click(box);
  await box.fill(text); // pasted, as a user would
  await pause(500);
  await click(page.getByRole('button', { name: /Parse JD/ }));
};

const openTab = async name => click(page.getByRole('tab', { name, exact: true }));

// ---------- Mock interview answers ----------
// Chosen from the resume line a question is about. The first numbered line gets a figure that differs from the
// resume, on purpose, to show the consistency check and the follow-up it triggers.
const ANSWERS = [
  { match: /900ms|query latency|indexes/i,
    wrong: 'Our reconciliation reports were timing out, so I pulled the slowest queries from pg_stat_statements and ran EXPLAIN ANALYZE on them. Most were sequential scans on the transactions table. I added a composite index on account and settlement date and a partial index for unsettled rows, and p95 latency dropped from 900ms to about 300ms.',
    fix: "You're right to check that, I misspoke. The resume figure is correct: p95 went from 900ms to 120ms. The composite index got us part of the way, and the partial index on unsettled transactions did the rest. I confirmed it with a week of production metrics before and after.",
    good: 'Our reconciliation reports were timing out, so I pulled the slowest queries from pg_stat_statements and ran EXPLAIN ANALYZE on them. Most were sequential scans on the transactions table. I added a composite index on account and settlement date and a partial index for unsettled rows. p95 latency went from 900ms to 120ms, and I verified it with a week of production metrics.' },
  { match: /2 million|reconciliation APIs/i,
    wrong: 'I built the reconciliation APIs in Node.js and TypeScript. Each payment provider sends settlement files, and the API matches them against our ledger in batches, with idempotency keys so retries never double count. Today it handles about 5 million transactions a day.',
    fix: "Sorry, that was wrong. It's 2 million transactions a day, as on my resume. The 5 million was a load test we ran to check headroom before peak season.",
    good: 'I built the reconciliation APIs in Node.js and TypeScript. Each payment provider sends settlement files, and the API matches them against our ledger in batches, with idempotency keys so retries never double count. It handles 2 million transactions a day, and I added alerts for any batch that fails to match.' },
  { match: /40%|Redis/i,
    wrong: 'Account balance reads were hitting PostgreSQL on every request. I added a Redis cache in front of balance lookups with a short TTL and invalidated the key whenever a transaction settled. That cut database load by about 60%.',
    fix: "I overstated it, it was 40%, as the resume says. 60% was the drop in read queries alone, but overall database load fell by 40%.",
    good: 'Account balance reads were hitting PostgreSQL on every request. I added a Redis cache in front of balance lookups with a short TTL and invalidated the key whenever a transaction settled. Database load fell by 40%, and balance reads got noticeably faster for users.' },
  { match: /Docker|ECS|AWS/i,
    good: 'At Ledgerly I containerized our Node.js services with Docker and deployed them to AWS ECS. I wrote the task definitions and health checks, set up autoscaling on CPU, and added a GitHub Actions pipeline so every merge built an image and rolled it out. Deploys went from a manual half-day job to a few minutes.' },
];
const BEHAVIORAL = 'On the reconciliation project, a teammate and I disagreed about caching account balances in Redis versus adding read replicas. I wrote a short comparison with real load numbers from production, and we reviewed it together with our lead. We agreed to try Redis behind a feature flag for two weeks. Database load fell by 40%, so we kept it, and I documented the invalidation rules so the whole team could work on it.';

const answerFor = (question, bullet, wantContradiction) => {
  const about = `${bullet ?? ''} ${question}`;
  const set = ANSWERS.find(a => a.match.test(bullet ?? '')) ?? ANSWERS.find(a => a.match.test(about));
  if (!set) return { text: BEHAVIORAL, contradiction: false, set: null };
  if (wantContradiction && bullet && set.wrong) return { text: set.wrong, contradiction: true, set };
  return { text: set.good, contradiction: false, set };
};

const answerBox = () => page.getByLabel('Your answer');

/** Waits for an answer to be scored and any follow-up to finish streaming. Returns true if a follow-up is waiting. */
const waitForAnswerDone = async () => {
  await pause(500);
  const end = Date.now() + WAIT;
  while (Date.now() < end) {
    await failIfError();
    const state = await page.evaluate(() => {
      const box = document.querySelector('textarea[aria-label="Your answer"]');
      const labels = [...document.querySelectorAll('button')].map(b => b.textContent ?? '');
      if (labels.some(t => /Next question|Back to current question|See your report/.test(t))) return 'done';
      if (box && !box.disabled && box.value === '') return 'follow-up';
      return 'busy';
    });
    if (state !== 'busy') return state === 'follow-up';
    await pause(250);
  }
  throw new Error('Timed out waiting for the answer to be scored');
};

const questionInfo = async () => {
  const bulletLine = page.getByText(/This question is about your resume line:/);
  const bullet = (await bulletLine.count()) ? (await bulletLine.first().innerText()).replace(/^.*?“|”\s*$/g, '') : null;
  const bubbles = page.locator('[aria-live="polite"] .bg-info-soft');
  const question = await bubbles.last().innerText();
  return { bullet, question };
};

// ---------- The walkthrough ----------
try {
  await scene('intro', async () => {
    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.mouse.move(mouse.x, mouse.y);
    await shot('01-home');
    await beat(0.9, 1500);
  });

  await scene('upload', async () => {
    await beat(0.15);
    await uploadResume();
    await beat(0.85);
  });

  await scene('job', async () => {
    await parseJob(JOB);
    await waitFor(page.getByText('Score Breakdown'));
    await pause(1200);
    await shot('02-score-card');
  });

  await scene('score', async () => {
    await beat(0.25);
    await reveal(page.getByText('Requirement Checks'), 'top', 1400);
    await beat(0.55);
    await reveal(page.getByText('Skill Evidence'), 'top', 1400);
    await shot('03-skill-evidence');
    await beat(0.95);
  });

  await scene('fit', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await click(page.getByRole('button', { name: /Run Fit Analysis/ }));
    await waitFor(page.getByText('Overall Fit'));
    await reveal(page.getByRole('tablist').first(), 'top');
    await shot('04-fit-analysis');
    await beat(0.6);
    await reveal(page.getByText('Key Strengths'), 'top', 1400);
  });

  await scene('gaps', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await openTab('Gap Analysis');
    await waitFor(page.getByText('Requirements Check', { exact: true }));
    await pause(600);
    await shot('05-gap-analysis');
    await beat(0.7);
    await reveal(page.getByText('Tip:'), 'center', 1400);
  });

  await scene('tailor', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await openTab('Resume Tailoring');
    await click(page.getByRole('button', { name: /Suggest rewrites/ }));
    await waitFor(page.getByText('Score Change'));
    await pause(500);
    await beat(0.3);
    const accept = page.getByRole('button', { name: 'Accept', exact: true });
    await click(accept.first());
    await beat(0.45);
    if (await accept.count()) await click(accept.first());
    await waitFor(page.getByText('Semantic match'));
    await pause(800);
    await shot('06-resume-tailoring');
    await beat(0.75);
    const [download] = await Promise.all([page.waitForEvent('download'), click(page.getByRole('button', { name: 'DOCX' }))]);
    await download.saveAs(join(OUT, download.suggestedFilename()));
  });

  await scene('cover', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await openTab('Cover Letter');
    await waitFor(page.getByText('Your cover letter is ready!'));
    await pause(600);
    await shot('07-cover-letter');
    await beat(0.5);
    await reveal(page.locator('article'), 'top', 1600);
  });

  await scene('prep', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await openTab('Interview Prep');
    await waitFor(page.getByText('Top Interview Questions'));
    await pause(600);
    await shot('08-interview-prep');
    await beat(0.7);
    await reveal(page.getByText('Answer Framework'), 'top', 1400);
  });

  await scene('mock-start', async () => {
    await reveal(page.getByRole('tablist').first(), 'top');
    await openTab('Mock Interview');
    await click(page.getByRole('button', { name: '3', exact: true }));
    await beat(0.4);
    await click(page.getByRole('button', { name: /Start interview/ }));
    await waitFor(answerBox());
    await reveal(page.getByRole('tablist').first(), 'top');
  });

  // Up to two questions, the first numbered resume line answered with a wrong figure, then finish early.
  let contradictionShown = false;
  for (let q = 1; q <= 2; q++) {
    const { bullet, question } = await questionInfo();
    const wantContradiction = !contradictionShown && !!bullet && /\d/.test(bullet);
    const answer = answerFor(question, bullet, wantContradiction);
    console.log(`  Q${q}: ${question}\n    line: ${bullet ?? '(none)'}\n    contradiction: ${answer.contradiction}`);

    await scene(`mock-q${q}`, async () => {
      await beat(0.1);
      await typeInto(answerBox(), answer.text);
      await click(page.getByRole('button', { name: /Submit answer/ }));
      const followUp = await waitForAnswerDone();
      await pause(800);
      if (answer.contradiction) await shot('09-mock-interview');
      await beat(0.95);
      // One answered follow-up is enough to show; a later one is left open and the interview finishes early.
      if (!followUp || q > 1) return;

      timeline.push({ id: `mock-q${q}`, start: sceneStart, end: now() });
      sceneId = `mock-q${q}-followup`; sceneStart = now();
      console.log(`▶ ${sceneId} at ${sceneStart.toFixed(1)}s`);
      const reply = answer.contradiction ? answer.set.fix : answer.set?.good ?? BEHAVIORAL;
      await typeInto(answerBox(), reply);
      await click(page.getByRole('button', { name: /Submit answer/ }));
      await waitForAnswerDone();
      await pause(800);
    });
    if (answer.contradiction) contradictionShown = true;

    const next = page.getByRole('button', { name: /Next question|Back to current question/ });
    if (q < 2 && await next.count()) { await click(next); await pause(500); }
  }

  await scene('mock-report', async () => {
    // A finished question stays on screen; move on to the open one, then end the interview there.
    const next = page.getByRole('button', { name: /Next question|Back to current question/ });
    if (await next.count()) { await click(next); await pause(400); }
    await click(page.getByRole('button', { name: /See your report|Finish early/ }));
    await waitFor(page.getByText('Interview Score'));
    await pause(1000);
    await shot('10-interview-report');
    await beat(0.6);
    await reveal(page.getByText('What to practise'), 'top', 1400);
  });

  await scene('second-job', async () => {
    await scrollTop();
    await click(page.getByRole('button', { name: /New analysis/ }));
    await uploadResume();
    await parseJob(JOB_2);
    await waitFor(page.getByText('Score Breakdown'));
    await pause(1200);
    await beat(0.9);
  });

  await scene('history', async () => {
    await click(page.getByRole('link', { name: 'History' }));
    await waitFor(page.getByRole('heading', { name: 'History' }));
    await pause(800);
    await shot('11-history');
  });

  await scene('outro', async () => {
    await click(page.getByRole('link', { name: 'Settings' }));
    await beat(0.25);
    await click(page.getByRole('radio', { name: 'Dark' }));
    await beat(0.4);
    await click(page.locator('aside li').filter({ hasText: /Backend Engineer/ }).first());
    await waitFor(page.getByText('Score Breakdown'));
    await pause(1000);
    await shot('12-dark-mode');
  });
} catch (error) {
  await page.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {});
  console.error(`\n✖ ${sceneId}: ${error.message}`);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) renameSync(await video.path(), join(OUT, 'video.webm'));
  writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ total: now(), scenes: timeline }, null, 2));
  console.log(`\nSaved ${join(OUT, 'video.webm')} (${now().toFixed(1)}s, ${timeline.length} scenes)`);
}
