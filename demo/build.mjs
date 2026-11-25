/**
 * Puts the paced take and the narration together:
 *   output/demo.mp4        H.264 video, AAC narration, soft English subtitles
 *   output/demo.srt/.vtt   subtitles timed to the voice
 *   output/TRANSCRIPT.md   narration with timestamps
 *   output/demo.gif        a short silent highlight for the README
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'ffmpeg-static';
import { readWavPcm } from './voice.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output');
const TAKE = join(OUT, 'paced');
const RATE = 24000;
const LEAD_IN = 0.3; // the voice starts just after the scene does

const narration = JSON.parse(readFileSync(join(HERE, 'narration.json'), 'utf8'));
const { scenes } = JSON.parse(readFileSync(join(TAKE, 'timeline.json'), 'utf8'));
const { voice } = JSON.parse(readFileSync(join(OUT, 'voice', 'engine.json'), 'utf8'));
const trim = scenes[0].start; // drop the blank page before the app loads
const length = scenes.at(-1).end - trim + 1.5; // end shortly after the last scene, not when the browser closed

// ---------- One narration track, each clip placed at its scene ----------
const track = Buffer.alloc(Math.ceil(length * RATE) * 2);
const cues = [];
for (const { id, text } of narration) {
  const scene = scenes.find(s => s.id === id);
  if (!scene) { console.warn(`No scene recorded for "${id}", skipping its narration`); continue; }
  const pcm = readWavPcm(join(OUT, 'voice', `${id}.wav`));
  const start = scene.start - trim + LEAD_IN;
  pcm.copy(track, Math.round(start * RATE) * 2);
  const duration = pcm.length / 2 / RATE;

  // Subtitles: sentence-sized pieces, timed by their share of the clip's characters.
  const pieces = text.match(/[^.!?:]+[.!?:]+["”]?\s*|[^.!?:]+$/g).flatMap(s => {
    s = s.trim();
    if (s.length <= 90) return [s];
    const words = s.split(' '), half = Math.ceil(words.length / 2);
    return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
  });
  const chars = pieces.reduce((n, p) => n + p.length, 0);
  let at = start;
  for (const piece of pieces) {
    const span = duration * piece.length / chars;
    cues.push({ start: at, end: at + span, text: piece });
    at += span;
  }
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + track.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(track.length, 40);
writeFileSync(join(OUT, 'narration.wav'), Buffer.concat([header, track]));

// ---------- Subtitles and transcript ----------
const stamp = (s, sep) => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
writeFileSync(join(OUT, 'demo.srt'), cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'));
writeFileSync(join(OUT, 'demo.vtt'), `WEBVTT\n\n${cues.map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`);

const TITLES = {
  intro: 'Introduction', upload: 'Resume parsing', job: 'Job description parsing', score: 'Hybrid score and evidence',
  fit: 'Fit analysis', gaps: 'Gap analysis', tailor: 'Resume tailoring', cover: 'Cover letter', prep: 'Interview prep',
  'mock-start': 'Mock interview', 'mock-q1': 'Answer scoring and resume check', 'mock-q1-followup': 'Streamed follow-up',
  'mock-q2': 'Second answer', 'mock-report': 'Interview report', 'second-job': 'A weaker match', history: 'History', outro: 'Evaluation and wrap-up',
};
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
writeFileSync(join(OUT, 'TRANSCRIPT.md'), [
  '# JobLens AI walkthrough: transcript', '',
  `Narrated walkthrough of the running app, ${mmss(length)} long. Voice: ${voice.startsWith("en-") ? `Microsoft neural voice ${voice}` : `Gemini text-to-speech, ${voice}`}, generated from the script in [demo/narration.json](../demo/narration.json).`,
  'Every result on screen is a real Gemini 2.5 Flash response, recorded once and replayed so the screen keeps time with the voice.', '',
  ...narration.filter(n => scenes.some(s => s.id === n.id)).flatMap(n => {
    const start = scenes.find(s => s.id === n.id).start - trim;
    return [`**${mmss(start)} · ${TITLES[n.id] ?? n.id}**  `, n.text, ''];
  }),
].join('\n'));

// ---------- Video ----------
const run = args => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
run([
  '-ss', trim.toFixed(3), '-i', join(TAKE, 'video.webm'), '-i', join(OUT, 'narration.wav'), '-i', join(OUT, 'demo.srt'),
  '-map', '0:v', '-map', '1:a', '-map', '2:s', '-t', length.toFixed(3),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '25',
  '-c:a', 'aac', '-b:a', '128k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
  '-movflags', '+faststart', join(OUT, 'demo.mp4'),
]);

// ---------- GIF: score reveal, tailoring and the interview's resume check, sped up ----------
const parts = ['job', 'tailor', 'mock-q1'].map(id => scenes.find(s => s.id === id)).filter(Boolean);
const SPEED = 3;
const filter = parts.map((s, i) => `[0:v]trim=${s.start.toFixed(2)}:${s.end.toFixed(2)},setpts=(PTS-STARTPTS)/${SPEED}[v${i}]`).join(';')
  + `;${parts.map((_, i) => `[v${i}]`).join('')}concat=n=${parts.length}:v=1:a=0,fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
run(['-i', join(TAKE, 'video.webm'), '-filter_complex', filter, join(OUT, 'demo.gif')]);

console.log(`Built demo.mp4 (${mmss(length)}), ${cues.length} subtitles, TRANSCRIPT.md and demo.gif`);
