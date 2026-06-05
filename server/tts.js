import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import axios from 'axios';
import ffmpegPath from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const RETRYABLE_TTS_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function toMs(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return Math.round(t);
  if (typeof t === 'string') {
    if (t.endsWith('s')) return Math.round(parseFloat(t) * 1000);
    return Math.round(parseFloat(t));
  }
  return 0;
}

function normalizeTimestamps(raw, script) {
  if (!Array.isArray(raw)) return [];
  const wc = wordCount(script);
  if (raw.length === 0) return [];
  const sample = raw[0];
  const keys = Object.keys(sample || {}).map(k => k.toLowerCase());
  const wordKey = keys.find(k => k.startsWith('word') || k === 'text' || k === 'token') || 'word';
  const startKey = keys.find(k => k.startsWith('start')) || 'starttime';
  const endKey = keys.find(k => k.startsWith('end')) || 'endtime';
  return raw
    .map(t => ({
      word: String(t[wordKey] ?? t.word ?? t.text ?? '').trim(),
      start_ms: toMs(t[startKey] ?? t.startTime ?? t.start_ms ?? t.start),
      end_ms: toMs(t[endKey] ?? t.endTime ?? t.end_ms ?? t.end),
    }))
    .filter(t => t.word);
}

function looksSentenceLevel(timestamps, script) {
  if (!timestamps.length) return true;
  return timestamps.length < wordCount(script) * 0.8;
}

function parsePcmFormat(mime = '') {
  const rateMatch = mime.match(/rate=(\d+)/i);
  const channelsMatch = mime.match(/channels=(\d+)/i);
  return {
    sampleRate: rateMatch ? parseInt(rateMatch[1], 10) : 24000,
    channels: channelsMatch ? parseInt(channelsMatch[1], 10) : 1,
    bitsPerSample: 16,
  };
}

export function pcmToWavBuffer(pcmBytes, options = {}) {
  const sampleRate = options.sampleRate || 24000;
  const channels = options.channels || 1;
  const bitsPerSample = options.bitsPerSample || 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBytes.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBytes.length, 40);

  return Buffer.concat([header, pcmBytes]);
}

export async function synthesizeSpeech(script, outPath) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.ttsModel}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: `Read the following script aloud in a clear, neutral tone:\n\n${script}` }] }],
    generationConfig: {
      response_modalities: ['AUDIO'],
      speech_config: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.gemini.ttsVoice },
        },
      },
    },
  };

  let resp = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      resp = await axios.post(`${url}?key=${config.geminiApiKey}`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60_000,
        responseType: 'json',
        validateStatus: () => true,
      });
      if (resp.status < 400) break;

      const errBody = resp.data?.error?.message || JSON.stringify(resp.data);
      lastError = new Error(`TTS ${resp.status}: ${errBody}`);
      if (!RETRYABLE_TTS_STATUSES.has(resp.status) || attempt === 3) throw lastError;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const retryable = status == null || RETRYABLE_TTS_STATUSES.has(status);
      if (!retryable || attempt === 3) {
        throw new Error(`TTS request failed after ${attempt} attempt(s): ${err.message}`);
      }
    }
    const delayMs = attempt * 1500;
    console.warn(`[tts] synthesis attempt ${attempt} failed; retrying in ${delayMs}ms`);
    await sleep(delayMs);
  }

  const parts = resp.data?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find(p => p.inlineData?.mimeType?.startsWith('audio/'));
  if (!audioPart) {
    const textPart = parts.find(p => p.text);
    throw new Error('TTS response had no audio inlineData' + (textPart ? ` (got text: ${textPart.text.slice(0, 200)})` : ''));
  }

  const mime = audioPart.inlineData.mimeType;
  const audioBytes = Buffer.from(audioPart.inlineData.data, 'base64');
  const isRawPcm = /audio\/(l16|pcm)|codec=pcm/i.test(mime);
  const ext = isRawPcm || /wav/i.test(mime) ? 'wav' : /mpeg|mp3/i.test(mime) ? 'mp3' : 'bin';
  const finalPath = outPath.replace(/\.[^.]+$/, '') + '.' + ext;
  const outputBytes = isRawPcm
    ? pcmToWavBuffer(audioBytes, parsePcmFormat(mime))
    : audioBytes;
  await fs.writeFile(finalPath, outputBytes);

  return {
    audioPath: finalPath,
    mime: isRawPcm ? 'audio/wav' : mime,
    sourceMime: mime,
  };
}

export async function transcribeForTimestamps(audioPath, script, mimeType = 'audio/wav') {
  const audioBytes = await fs.readFile(audioPath);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  const prompt = `You will receive an audio file. Transcribe it word-by-word and return a JSON array where each element is { "word": string, "start_ms": number, "end_ms": number }.
The original script is:
"""${script}"""
Return timestamps in milliseconds. Use the script to disambiguate words if needed. Return ONLY the JSON array, no markdown.`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: audioBytes.toString('base64') } },
  ]);
  const text = result.response.text();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('STT returned non-JSON: ' + text.slice(0, 200));
  }
  return normalizeTimestamps(parsed, script);
}

export async function getProbeDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-i', audioPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', () => {
      if (/header missing|invalid data found|could not find codec parameters/i.test(stderr)) {
        reject(new Error('audio file is not a valid, probeable media container'));
        return;
      }
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (m) {
        const h = parseInt(m[1], 10);
        const mn = parseInt(m[2], 10);
        const s = parseFloat(m[3]);
        resolve(Math.round((h * 3600 + mn * 60 + s) * 1000));
      } else {
        reject(new Error('could not parse duration from ffmpeg output'));
      }
    });
    p.on('error', err => reject(err));
  });
}

async function generateSilentAudio(outPath, durationSec) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', durationSec.toFixed(2),
      '-q:a', '9',
      outPath,
    ], { stdio: 'ignore' });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`silent audio failed: ${code}`)));
  });
}

function buildEstimatedTimestamps(script, durationMs) {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const totalSpan = Math.max(durationMs, words.length * 50);
  const weights = words.map(w => 0.5 + Math.min(w.length, 16) / 8);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const out = [];
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const end = i === words.length - 1
      ? totalSpan
      : Math.round(cursor + (totalSpan * weights[i]) / totalWeight);
    out.push({ word: words[i], start_ms: cursor, end_ms: end });
    cursor = end;
  }
  return out;
}

function timestampsFitDuration(timestamps, durationMs) {
  if (!timestamps.length) return false;
  let previousEnd = 0;
  for (const timestamp of timestamps) {
    if (timestamp.start_ms < previousEnd || timestamp.end_ms < timestamp.start_ms) return false;
    if (timestamp.end_ms > durationMs + 1000) return false;
    previousEnd = timestamp.end_ms;
  }
  return true;
}

export async function generateSpeechAndTimestamps({ script, jobDir }) {
  const ttsOut = path.join(jobDir, 'audio.mp3');
  let audioPath = ttsOut;

  if (config.limits.skipTts) {
    const wc = wordCount(script);
    const durationSec = Math.max(2, (wc / config.limits.wordsPerMinute) * 60);
    await fs.mkdir(jobDir, { recursive: true });
    await generateSilentAudio(audioPath, durationSec);
    const durationMs = Math.round(durationSec * 1000);
    return { audioPath, durationMs, timestamps: buildEstimatedTimestamps(script, durationMs), skipped: true };
  }

  const result = await synthesizeSpeech(script, ttsOut);
  audioPath = result.audioPath;
  const durationMs = await getProbeDuration(audioPath);

  let timestamps = [];
  try {
    timestamps = await transcribeForTimestamps(audioPath, script, result.mime);
  } catch (err) {
    console.warn('[tts] STT fallback failed:', err.message);
  }

  if (looksSentenceLevel(timestamps, script) || !timestampsFitDuration(timestamps, durationMs)) {
    timestamps = buildEstimatedTimestamps(script, durationMs);
  }

  if (timestamps.length && timestamps[timestamps.length - 1].end_ms === 0) {
    timestamps[timestamps.length - 1].end_ms = durationMs;
  }

  return { audioPath, durationMs, timestamps, skipped: false, source: 'gemini' };
}
