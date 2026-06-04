import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FONT_CACHE_DIR = path.resolve(ROOT, 'node_modules', '.cache');
const FONT_CACHE_PATH = path.join(FONT_CACHE_DIR, 'videogen-font.ttf');

function parseBool(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveSafeFontPath() {
  const fromEnv = process.env.FONT_PATH || 'C:/Windows/Fonts/arial.ttf';
  const hasColon = /:/.test(fromEnv);
  if (!hasColon) return fromEnv;
  try {
    fs.mkdirSync(FONT_CACHE_DIR, { recursive: true });
    if (!fs.existsSync(FONT_CACHE_PATH) && fs.existsSync(fromEnv)) {
      fs.copyFileSync(fromEnv, FONT_CACHE_PATH);
    }
    if (fs.existsSync(FONT_CACHE_PATH)) {
      console.log(`[config] copied font to safe path: ${FONT_CACHE_PATH}`);
      return FONT_CACHE_PATH;
    }
  } catch (err) {
    console.warn('[config] failed to copy font to safe path:', err.message);
  }
  return fromEnv;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  geminiApiKey: process.env.GEMINI_API_KEY || '',

  unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY || '',
  pexelsApiKey: process.env.PEXELS_API_KEY || '',

  paths: {
    root: ROOT,
    jobs: path.resolve(ROOT, process.env.JOBS_DIR || './jobs'),
    output: path.resolve(ROOT, process.env.OUTPUT_DIR || './output'),
    assets: path.resolve(ROOT, process.env.ASSETS_DIR || './assets'),
    font: resolveSafeFontPath(),
  },

  limits: {
    maxScriptChars: parseInt(process.env.MAX_SCRIPT_CHARS || '5000', 10),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10),
    skipTts: (process.env.SKIP_TTS || 'false').toLowerCase() === 'true',
    wordsPerMinute: parseInt(process.env.WORDS_PER_MINUTE || '150', 10),
  },

  features: {
    enableAdvancedLayouts: parseBool(process.env.ENABLE_ADVANCED_LAYOUTS, true),
    enableTextAnimations: parseBool(process.env.ENABLE_TEXT_ANIMATIONS, true),
    enableConnectors: parseBool(process.env.ENABLE_CONNECTORS, true),
  },

  gemini: {
    ttsModel: 'gemini-2.5-flash-preview-tts',
    ttsVoice: 'en-US-Standard-C',
    ttsRate: 0.95,
    plannerModel: 'gemini-flash-latest',
  },
};

export function validate() {
  const missing = [];
  if (!config.geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!config.unsplashAccessKey) missing.push('UNSPLASH_ACCESS_KEY');
  if (!config.pexelsApiKey) missing.push('PEXELS_API_KEY');
  if (missing.length) {
    console.warn(`[config] missing env vars: ${missing.join(', ')}`);
    console.warn('[config] copy .env.example to .env and fill in the values');
  }
}
