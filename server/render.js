import { existsSync } from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { config } from './config.js';
import { renderSceneType } from './scenes/index.js';
import { paletteFor, detectTopic, TOPIC_PALETTES } from './design.js';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

function runFfmpeg({ inputs, filterGraph, output, durationSec }) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    for (const inp of inputs) {
      cmd = cmd.input(inp.path).inputOptions([`-loop 1`]);
    }
    const outputLabel = filterGraph.match(/\[([^\]]+)\]\s*$/)?.[1];
    if (!outputLabel) {
      reject(new Error('render graph has no final output label'));
      return;
    }
    cmd
      .complexFilter(filterGraph, outputLabel)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 18',
        '-tune animation',
        '-profile:v high',
        '-pix_fmt yuv420p',
        '-r 30',
        `-t ${durationSec.toFixed(3)}`,
        '-movflags +faststart',
        '-y',
      ])
      .output(output)
      .on('end', () => resolve(output))
      .on('error', (err, stdout, stderr) => {
        err.ffmpegStderr = stderr;
        reject(err);
      })
      .run();
  });
}

export async function renderScene({ scene, asset, jobDir, sceneIndex, script }) {
  const durationMs = Math.max(500, scene.end_ms - scene.start_ms);
  const durationSec = durationMs / 1000;
  const out = path.join(jobDir, `scene_${String(sceneIndex).padStart(3, '0')}.mp4`);

  const topic = detectTopic(script || '');
  const palette = paletteFor(topic);

  const ctx = {
    durSec: durationSec,
    iconPath: asset?.iconPath || null,
    iconPaths: asset?.iconPaths || {},
    imagePath: asset?.imagePath || null,
    palette,
  };

  let graph;
  try {
    const result = renderSceneType(scene, ctx);
    graph = { inputs: result.inputs, filterGraph: result.filterGraph };
  } catch (err) {
    console.warn(`[render] scene_type renderer failed for "${scene.scene_type}":`, err.message);
    graph = buildFallbackGraph(scene, ctx, durationSec);
  }

  try {
    await runFfmpeg({
      inputs: graph.inputs,
      filterGraph: graph.filterGraph,
      output: out,
      durationSec,
    });
    return out;
  } catch (err) {
    console.warn(`[render] filter graph failed for scene ${sceneIndex} (${scene.scene_type}):`, err.message);
    if (err.ffmpegStderr) console.warn(`[render] ffmpeg stderr:\n${err.ffmpegStderr}`);
    console.warn(`[render] filter graph (${graph.filterGraph.length} chars): ${graph.filterGraph}`);
    const fallback = buildFallbackGraph(scene, ctx, durationSec);
    try {
      await runFfmpeg({
        inputs: fallback.inputs,
        filterGraph: fallback.filterGraph,
        output: out,
        durationSec,
      });
    } catch (err2) {
      console.error(`[render] fallback also failed for scene ${sceneIndex}:`, err2.message);
      await ffmpeg()
        .input(`color=c=black:s=1920x1080:r=30:d=${durationSec.toFixed(3)}`)
        .inputOptions(['-f lavfi'])
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 18', '-tune animation', '-profile:v high', '-pix_fmt yuv420p', '-y'])
        .output(out)
        .run();
    }
  }
  return out;
}

function buildFallbackGraph(scene, ctx, durSec) {
  const inputs = [];
  const title = String(scene.title || scene.id || '')
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .toUpperCase();
  const color = scene.bg_color || '#0A0A0A';
  const fg = scene.accent_color || '#FFFFFF';
  const fallbackSize = Math.max(52, Math.min(110, Math.floor(1500 / Math.max(8, title.length * 0.56))));
  const font = config.paths.font;
  const fontExpr = font ? font.replace(/\\/g, '/').replace(/'/g, "\\'") : null;
  const parts = [
    `color=c=${color}:s=1920x1080:r=30:d=${durSec.toFixed(3)}[bg]`,
  ];
  if (ctx.iconPath) {
    inputs.push({ path: ctx.iconPath });
    const i = inputs.length - 1;
    parts.push(
      `[${i}:v]format=rgba,scale=300:300,setpts=PTS-STARTPTS[ico]`,
      `[bg][ico]overlay=x=(W-300)/2:y=(H*0.3):eval=init[t1]`,
    );
  } else {
    parts.push(`[bg]copy[t1]`);
  }
  const textOpts = [
    `text='${(title || '').replace(/'/g, "\\'")}'`,
    `fontcolor=${fg}`,
    `fontsize=${fallbackSize}`,
  ];
  if (fontExpr) textOpts.push(`fontfile='${fontExpr}'`);
  textOpts.push(`x=(w-text_w)/2:y=(h-text_h)/2+200`);
  parts.push(`[t1]drawtext=${textOpts.join(':')}[t2]`);
  parts.push(`[t2]copy[out]`);
  return { inputs, filterGraph: parts.join(';') };
}

export async function concatScenes(scenePaths, outPath, durationsMs = []) {
  const transitionSec = 0.25;
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    for (const scenePath of scenePaths) cmd = cmd.input(scenePath);

    const filters = [];
    for (let i = 0; i < scenePaths.length; i++) {
      const tail = i < scenePaths.length - 1 ? `,tpad=stop_mode=clone:stop_duration=${transitionSec}` : '';
      filters.push(`[${i}:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS${tail}[s${i}]`);
    }

    let current = 's0';
    let cumulativeSec = Math.max(0.5, (durationsMs[0] || 500) / 1000);
    for (let i = 1; i < scenePaths.length; i++) {
      const next = `x${i}`;
      filters.push(
        `[${current}][s${i}]xfade=transition=fade:duration=${transitionSec}:offset=${cumulativeSec.toFixed(3)}[${next}]`
      );
      current = next;
      cumulativeSec += Math.max(0.5, (durationsMs[i] || 500) / 1000);
    }

    cmd
      .complexFilter(filters.join(';'), current)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 18',
        '-tune animation',
        '-profile:v high',
        '-pix_fmt yuv420p',
        '-r 30',
        `-t ${cumulativeSec.toFixed(3)}`,
        '-movflags +faststart',
        '-y',
      ])
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}

export async function muxAudio(videoPath, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-b:a 128k',
        '-shortest',
        '-movflags +faststart',
        '-y',
      ])
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .run();
  });
}
