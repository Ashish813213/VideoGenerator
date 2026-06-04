import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { generateSpeechAndTimestamps } from './tts.js';
import { planScenes } from './planner.js';
import { resolveScenes } from './assets.js';
import { renderScene, concatScenes, muxAudio } from './render.js';

const jobs = new Map();

const activeJobs = new Set();
const queue = [];

function setStatus(job, patch) {
  Object.assign(job, patch);
  jobs.set(job.id, job);
}

export function getJob(id) {
  return jobs.get(id);
}

export function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.created_at - a.created_at);
}

export async function createJob(script) {
  if (!script || !script.trim()) {
    throw new Error('Script is required');
  }
  if (script.length > config.limits.maxScriptChars) {
    throw new Error(`Script exceeds max length of ${config.limits.maxScriptChars} chars`);
  }
  const id = nanoid(12);
  const job = {
    id,
    script: script.trim(),
    status: 'queued',
    progress: 0,
    current_step: 'queued',
    error_msg: null,
    audio_path: null,
    output_path: null,
    duration_ms: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  jobs.set(id, job);
  await fs.mkdir(path.join(config.paths.jobs, id), { recursive: true });
  enqueue(id);
  return job;
}

function enqueue(id) {
  queue.push(id);
  pumpQueue();
}

function pumpQueue() {
  while (activeJobs.size < config.limits.maxConcurrentJobs && queue.length) {
    const id = queue.shift();
    activeJobs.add(id);
    runJob(id).finally(() => {
      activeJobs.delete(id);
      pumpQueue();
    });
  }
}

async function runJob(id) {
  const job = jobs.get(id);
  const jobDir = path.join(config.paths.jobs, id);
  try {
    setStatus(job, { status: 'processing', current_step: 'tts', progress: 5, updated_at: Date.now() });

    const { audioPath, durationMs, timestamps, skipped } = await generateSpeechAndTimestamps({
      script: job.script,
      jobDir,
    });
    if (skipped) console.log(`[pipeline] job ${id}: TTS skipped, using silent audio (${durationMs}ms)`);
    setStatus(job, { audio_path: audioPath, duration_ms: durationMs, progress: 25, current_step: 'planning', updated_at: Date.now() });

    const scenes = await planScenes({
      transcript: timestamps,
      script: job.script,
      totalMs: durationMs,
    });

    setStatus(job, { progress: 45, current_step: 'assets', updated_at: Date.now() });

    const assetMap = await resolveScenes(scenes);
    console.log(`[pipeline] job ${id}: planned ${scenes.length} scenes:`);
    scenes.forEach((s, i) => {
      const a = assetMap.get(i);
      const iconNames = a?.iconPaths ? Object.keys(a.iconPaths).join(',') : '-';
      console.log(`  scene ${i}: type=${s.scene_type} accent=${s.accent_color} icons=[${iconNames}] title="${(s.title||'').slice(0,40)}"`);
    });

    setStatus(job, { progress: 60, current_step: 'rendering', updated_at: Date.now() });

    const sceneClips = [];
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const asset = assetMap.get(i) || {};
      const clipPath = await renderScene({
        scene: s,
        asset,
        jobDir,
        sceneIndex: i,
      });
      sceneClips.push(clipPath);
      const pct = 60 + Math.round(((i + 1) / scenes.length) * 25);
      setStatus(job, { progress: pct, updated_at: Date.now() });
    }

    setStatus(job, { progress: 88, current_step: 'muxing', updated_at: Date.now() });

    const videoOnly = path.join(jobDir, 'video.mp4');
    if (sceneClips.length === 1) {
      await fs.copyFile(sceneClips[0], videoOnly);
    } else {
      await concatScenes(sceneClips, videoOnly);
    }

    const finalOut = path.join(config.paths.output, `${id}.mp4`);
    await fs.mkdir(path.dirname(finalOut), { recursive: true });
    await muxAudio(videoOnly, audioPath, finalOut);

    setStatus(job, {
      status: 'done',
      progress: 100,
      current_step: 'done',
      output_path: finalOut,
      updated_at: Date.now(),
    });
  } catch (err) {
    console.error(`[pipeline] job ${id} failed:`, err);
    setStatus(job, {
      status: 'failed',
      error_msg: err.message || String(err),
      current_step: 'failed',
      updated_at: Date.now(),
    });
  }
}
