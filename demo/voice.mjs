/**
 * Turns narration.json into one voice clip per scene: output/voice/<scene>.wav and durations.json.
 *
 * Uses Gemini text-to-speech (male voice "Charon") with the backend's GEMINI_API_KEY. If Gemini can't voice every
 * scene, all scenes fall back to Microsoft's neural voice "Andrew", so the narration never switches voice midway.
 *   node voice.mjs            Gemini first, Microsoft as fallback
 *   node voice.mjs --edge     Microsoft only
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'output', 'voice');
const SCENES = JSON.parse(readFileSync(join(HERE, 'narration.json'), 'utf8'));
const RATE = 24000;

const GEMINI_TTS = 'gemini-2.5-flash-preview-tts';
const GEMINI_VOICE = 'Charon';
const EDGE_VOICE = 'en-US-AndrewNeural';
const STYLE = 'Read this as the narrator of a polished product demo: warm, clear, confident and unhurried.';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const apiKey = () => {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = readFileSync(join(HERE, '..', 'backend', '.env'), 'utf8');
  return env.match(/^GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
};

/** Writes 16-bit mono PCM as a WAV file. */
const writeWav = (path, pcm) => {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([header, pcm]));
};

/** Reads the PCM samples out of a WAV file, whatever chunks precede them. */
export const readWavPcm = path => {
  const buf = readFileSync(path);
  for (let at = 12; at < buf.length;) {
    const id = buf.toString('ascii', at, at + 4), size = buf.readUInt32LE(at + 4);
    if (id === 'data') return buf.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  throw new Error(`No audio data in ${path}`);
};

const geminiClip = async (text, key) => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\n\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } } },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const audio = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (!audio) throw new Error('Gemini returned no audio');
      return Buffer.from(audio, 'base64'); // 24 kHz 16-bit mono PCM
    }
    const body = await res.text();
    // A per-minute limit clears after a short wait; a daily one doesn't.
    if (res.status === 429 && !/PerDay/i.test(body) && attempt < 4) { console.log('  rate limited, waiting 25s'); await sleep(25_000); continue; }
    throw new Error(`Gemini TTS ${res.status}: ${body.slice(0, 200)}`);
  }
};

const edgeClip = async (text, id) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(EDGE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const dir = join(OUT, `tmp-${id}`);
  mkdirSync(dir, { recursive: true });
  const { audioFilePath } = await tts.toFile(dir, text, { rate: '-4%' });
  const wav = join(dir, 'clip.wav');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', audioFilePath, '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', wav]);
  const pcm = readWavPcm(wav);
  rmSync(dir, { recursive: true, force: true });
  tts.close?.();
  return pcm;
};

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const clips = {};
  let engine = process.argv.includes('--edge') ? 'edge' : 'gemini';

  if (engine === 'gemini') {
    const key = apiKey();
    try {
      if (!key) throw new Error('GEMINI_API_KEY not found');
      for (const { id, text } of SCENES) {
        console.log(`Gemini voice: ${id}`);
        clips[id] = await geminiClip(text, key);
      }
    } catch (error) {
      console.log(`Gemini voice unavailable (${error.message}), using Microsoft ${EDGE_VOICE} for every scene.`);
      engine = 'edge';
    }
  }
  if (engine === 'edge') {
    for (const { id, text } of SCENES) {
      console.log(`Microsoft voice: ${id}`);
      clips[id] = await edgeClip(text, id);
    }
  }

  const durations = {};
  for (const { id } of SCENES) {
    writeWav(join(OUT, `${id}.wav`), clips[id]);
    durations[id] = clips[id].length / 2 / RATE;
  }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify(durations, null, 2));
  writeFileSync(join(OUT, 'engine.json'), JSON.stringify({ engine, voice: engine === 'gemini' ? `${GEMINI_TTS} / ${GEMINI_VOICE}` : EDGE_VOICE }));
  const total = Object.values(durations).reduce((a, b) => a + b, 0);
  console.log(`\n${SCENES.length} clips, ${total.toFixed(1)}s of narration, voice: ${engine}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
