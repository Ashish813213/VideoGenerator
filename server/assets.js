import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import axios from 'axios';
import sharp from 'sharp';
import { config } from './config.js';
import { getIconSvg, normalizeLucideName, pickIconForQuery } from './lucide.js';

const ICON_DIR = path.join(config.paths.assets, 'icons');
const IMAGE_DIR = path.join(config.paths.assets, 'images');
const IMAGE_CACHE_PATH = path.join(config.paths.assets, '_image_cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESS_SCENE_TYPES = new Set(['process', 'network', 'data_flow', 'diagram']);

let imageCache = null;
async function loadImageCache() {
  if (imageCache) return imageCache;
  try {
    const raw = await fs.readFile(IMAGE_CACHE_PATH, 'utf-8');
    imageCache = JSON.parse(raw);
  } catch {
    imageCache = {};
  }
  return imageCache;
}

async function saveImageCache() {
  await fs.mkdir(path.dirname(IMAGE_CACHE_PATH), { recursive: true });
  await fs.writeFile(IMAGE_CACHE_PATH, JSON.stringify(imageCache, null, 2));
}

function hashQuery(q) {
  return crypto.createHash('md5').update(q.toLowerCase().trim()).digest('hex');
}

function hashIcon(name) {
  return crypto.createHash('md5').update(name.toLowerCase()).digest('hex');
}

export async function renderLucideIcon(iconName, color = '#FFFFFF', size = 512) {
  const normalized = normalizeLucideName(iconName);
  if (!normalized) return null;
  const key = `v2_${hashIcon(normalized)}_${color.replace('#', '')}_${size}`;
  const outPath = path.join(ICON_DIR, `${key}.png`);
  try {
    await fs.access(outPath);
    return outPath;
  } catch {}

  const inner = getIconSvg(normalized)?.replaceAll('currentColor', color);
  if (!inner) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  await fs.mkdir(ICON_DIR, { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  return outPath;
}

async function fetchUnsplash(query) {
  if (!config.unsplashAccessKey) return null;
  try {
    const resp = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, per_page: 1, orientation: 'landscape' },
      headers: { Authorization: `Client-ID ${config.unsplashAccessKey}` },
      timeout: 10_000,
    });
    const hit = resp.data?.results?.[0];
    return hit?.urls?.regular || hit?.urls?.small || null;
  } catch (err) {
    console.warn(`[assets] unsplash failed for "${query}":`, err.response?.status || err.message);
    return null;
  }
}

async function fetchPexels(query) {
  if (!config.pexelsApiKey) return null;
  try {
    const resp = await axios.get('https://api.pexels.com/v1/search', {
      params: { query, per_page: 1, orientation: 'landscape' },
      headers: { Authorization: config.pexelsApiKey },
      timeout: 10_000,
    });
    const hit = resp.data?.photos?.[0];
    return hit?.src?.landscape || hit?.src?.large || null;
  } catch (err) {
    console.warn(`[assets] pexels failed for "${query}":`, err.response?.status || err.message);
    return null;
  }
}

async function downloadToFile(url, dest) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, resp.data);
  return dest;
}

async function fetchImageFromNetwork(query) {
  const cache = await loadImageCache();
  const hash = hashQuery(query);
  const cached = cache[hash];
  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
    try {
      await fs.access(cached.local_path);
      return { path: cached.local_path, source: cached.source, cached: true };
    } catch {
      delete cache[hash];
    }
  }

  let url = await fetchPexels(query);
  let source = 'pexels';
  if (!url) {
    url = await fetchUnsplash(query);
    source = 'unsplash';
  }
  if (!url) return null;

  const ext = url.includes('.png') ? 'png' : 'jpg';
  const dest = path.join(IMAGE_DIR, `${hash}.${ext}`);
  try {
    await downloadToFile(url, dest);
  } catch (err) {
    console.warn(`[assets] download failed for "${query}":`, err.message);
    return null;
  }
  cache[hash] = {
    query,
    source,
    local_path: dest,
    original_url: url,
    cached_at: Date.now(),
  };
  await saveImageCache();
  return { path: dest, source, cached: false };
}

export async function resolveSceneVisual(scene) {
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';
  const iconColor = '#FFFFFF';

  const result = {
    iconPath: null,
    iconPaths: {},
    imagePath: null,
  };

  const wantIconNames = new Set();
  if (scene.lucide_icon_name) wantIconNames.add(scene.lucide_icon_name);
  if (PROCESS_SCENE_TYPES.has(scene.scene_type) && Array.isArray(scene.steps)) {
    for (const s of scene.steps) if (s.icon) wantIconNames.add(s.icon);
  }
  if (scene.scene_type === 'summary' && Array.isArray(scene.takeaways)) {
    for (const t of scene.takeaways) if (t.icon) wantIconNames.add(t.icon);
  }
  if (scene.scene_type === 'comparison') {
    if (scene.left?.icon) wantIconNames.add(scene.left.icon);
    if (scene.right?.icon) wantIconNames.add(scene.right.icon);
  }

  for (const name of wantIconNames) {
    const p = await renderLucideIcon(name, iconColor, 512);
    if (p) result.iconPaths[name] = p;
  }

  if (scene.lucide_icon_name) {
    result.iconPath = result.iconPaths[scene.lucide_icon_name] || null;
  }

  const imageQuery = scene.image_query || [scene.primary_asset, scene.visual_goal, scene.title].filter(Boolean).join(' ');
  if (imageQuery && /hero|definition|callout|comparison|visual_metaphor|network|data_flow|diagram|relationship|stat/.test(scene.scene_type || '')) {
    const img = await fetchImageFromNetwork(imageQuery);
    if (img) result.imagePath = img.path;
  }

  return result;
}

export async function resolveScenes(scenes) {
  const results = new Map();
  for (let i = 0; i < scenes.length; i++) {
    const v = await resolveSceneVisual(scenes[i]);
    results.set(i, v);
  }
  return results;
}
