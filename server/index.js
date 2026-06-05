import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, validate } from './config.js';
import { createJob, getJob, listJobs } from './pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

validate();

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(morgan('tiny'));

app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', skipTts: config.limits.skipTts, timestamp: new Date().toISOString() });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { script } = req.body || {};
    if (!script || typeof script !== 'string') {
      return res.status(400).json({ error: 'script is required' });
    }
    const job = await createJob(script);
    res.status(201).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      tts_source: job.tts_source,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    current_step: job.current_step,
    duration_ms: job.duration_ms,
    tts_source: job.tts_source,
    error_msg: job.error_msg,
    output_url: job.status === 'done' ? `/api/video/${job.id}` : null,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
});

app.get('/api/jobs', (_req, res) => {
  res.json(listJobs().slice(0, 50).map(j => ({
    jobId: j.id,
    status: j.status,
    progress: j.progress,
    current_step: j.current_step,
    created_at: j.created_at,
  })));
});

app.get('/api/video/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (job.status !== 'done' || !job.output_path) {
    return res.status(404).json({ error: 'video not ready' });
  }
  if (!fs.existsSync(job.output_path)) {
    return res.status(404).json({ error: 'video file missing' });
  }
  const stat = fs.statSync(job.output_path);
  const range = req.headers.range;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `inline; filename="video_${job.id}.mp4"`);
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', chunkSize);
    fs.createReadStream(job.output_path, { start, end }).pipe(res);
  } else {
    fs.createReadStream(job.output_path).pipe(res);
  }
});

app.get('/api/video/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (!job || job.status !== 'done' || !job.output_path) {
    return res.status(404).json({ error: 'video not ready' });
  }
  res.download(job.output_path, `video_${job.id}.mp4`);
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`\n  videogen listening on http://localhost:${config.port}`);
  console.log(`  open the URL above in your browser to use the app\n`);
  console.log(`  press Ctrl+C to stop\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[error] port ${config.port} is already in use. another instance may be running.`);
    console.error(`        stop it with:  Stop-Process -Name node -Force`);
    process.exit(1);
  }
  console.error('[error]', err);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] received ${signal}, closing...`);
  server.close((err) => {
    if (err) console.error('[server] close error:', err);
    console.log('[server] port released. bye.');
    process.exit(err ? 1 : 0);
  });
  setTimeout(() => {
    console.warn('[server] forced exit after 5s');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
