import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { understandScript } from './understand.js';
import { directScenes } from './direct.js';
import { planSceneSpecs } from './scene.js';
import { config } from '../config.js';
import { detectTopic, paletteFor } from '../design.js';

const PLAN_CACHE_DIR = path.join(config.paths.jobs, '.plan_cache');
const PLANNER_VERSION = 'v14-presenter-character';

function scriptKey(script) {
  return crypto.createHash('md5').update(`${PLANNER_VERSION}:${script.trim().toLowerCase()}`).digest('hex');
}

async function ensureCacheDir() {
  await fs.mkdir(PLAN_CACHE_DIR, { recursive: true });
}

async function readJson(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}

async function writeJson(p, obj) {
  await fs.writeFile(p, JSON.stringify(obj, null, 2));
}

export async function orchestrate({ script, transcript, totalMs, jobDir }) {
  await ensureCacheDir();
  const key = scriptKey(script);
  const contentPath = path.join(PLAN_CACHE_DIR, `${key}.content.json`);
  const storyboardPath = path.join(PLAN_CACHE_DIR, `${key}.storyboard.json`);
  const scenesPath = path.join(PLAN_CACHE_DIR, `${key}.scenes.json`);

  const t0 = Date.now();

  let content = await readJson(contentPath);
  if (!content) {
    console.log(`[orchestrate] stage 1/3: understanding the script…`);
    content = await understandScript({ script, transcript, totalMs });
    await writeJson(contentPath, content);
  } else {
    console.log(`[orchestrate] stage 1/3: cached`);
  }
  if (jobDir) {
    await fs.mkdir(jobDir, { recursive: true });
    await writeJson(path.join(jobDir, 'content.json'), content);
  }
  console.log(`[orchestrate]   content.json: ${content.story_beats?.length || 0} beats, arc=${content.narrative_arc}`);

  let storyboard = await readJson(storyboardPath);
  if (!storyboard) {
    console.log(`[orchestrate] stage 2/3: directing the film…`);
    storyboard = await directScenes({ content });
    await writeJson(storyboardPath, storyboard);
  } else {
    console.log(`[orchestrate] stage 2/3: cached`);
  }
  if (jobDir) await writeJson(path.join(jobDir, 'storyboard.json'), storyboard);
  console.log(`[orchestrate]   storyboard.json: ${storyboard.scene_directions?.length || 0} directions, ${storyboard.visual_metaphors?.length || 0} metaphors`);

  let scenes = await readJson(scenesPath);
  if (!scenes) {
    console.log(`[orchestrate] stage 3/3: planning scene specs…`);
    scenes = await planSceneSpecs({ content, storyboard });
    await writeJson(scenesPath, scenes);
  } else {
    console.log(`[orchestrate] stage 3/3: cached`);
  }
  if (jobDir) await writeJson(path.join(jobDir, 'scenes.json'), scenes);
  console.log(`[orchestrate]   scenes.json: ${scenes.length} scenes`);

  console.log(`[orchestrate] total planning time: ${Date.now() - t0}ms`);
  return scenes;
}

export function planCacheKey(script) {
  return scriptKey(script);
}
