import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import axios from 'axios';
import ffmpegPath from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function toMs(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return t < 1000 ? Math.round(t * 1000) : Math.round(t);
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

  let resp;
  try {
    resp = await axios.post(`${url}?key=${config.geminiApiKey}`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
      responseType: 'json',
      validateStatus: () => true,
    });
  } catch (err) {
    throw new Error(`TTS request failed: ${err.message}`);
  }

  if (resp.status >= 400) {
    const errBody = resp.data?.error?.message || JSON.stringify(resp.data);
    throw new Error(`TTS ${resp.status}: ${errBody}`);
  }

  const parts = resp.data?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find(p => p.inlineData?.mimeType?.startsWith('audio/'));
  if (!audioPart) {
    const textPart = parts.find(p => p.text);
    throw new Error('TTS response had no audio inlineData' + (textPart ? ` (got text: ${textPart.text.slice(0, 200)})` : ''));
  }

  const mime = audioPart.inlineData.mimeType;
  const audioBytes = Buffer.from(audioPart.inlineData.data, 'base64');
  const ext = mime.includes('wav') ? 'wav' : mime.includes('mpeg') ? 'mp3' : 'mp3';
  const finalPath = outPath.replace(/\.[^.]+$/, '') + '.' + ext;
  await fs.writeFile(finalPath, audioBytes);

  return { audioPath: finalPath, mime };
}

export async function transcribeForTimestamps(audioPath, script) {
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
    { inlineData: { mimeType: 'audio/mpeg', data: audioBytes.toString('base64') } },
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
  const ffprobe = (await import('fluent-ffmpeg')).default;
  return new Promise((resolve, reject) => {
    ffprobe.ffprobe(audioPath, (err, data) => {
      if (err) return reject(err);
      const s = data?.format?.duration || 0;
      resolve(Math.round(s * 1000));
    });
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
  const perWord = totalSpan / words.length;
  const out = [];
  let cursor = 0;
  for (const w of words) {
    const dur = Math.max(80, Math.round(perWord * (0.5 + w.length / 8)));
    out.push({ word: w, start_ms: cursor, end_ms: cursor + dur });
    cursor += dur;
  }
  return out;
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
    timestamps = await transcribeForTimestamps(audioPath, script);
  } catch (err) {
    console.warn('[tts] STT fallback failed:', err.message);
  }

  if (looksSentenceLevel(timestamps, script)) {
    timestamps = buildEstimatedTimestamps(script, durationMs);
  }

  if (timestamps.length && timestamps[timestamps.length - 1].end_ms === 0) {
    timestamps[timestamps.length - 1].end_ms = durationMs;
  }

  return { audioPath, durationMs, timestamps, skipped: false };
}
