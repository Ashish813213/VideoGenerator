# VideoGen

A simple, no-auth web app that turns a text script into a narrated video with AI-generated scenes, relevant images, and Gemini TTS voiceover.

## What it does

1. You paste a script
2. **Gemini TTS** speaks it (English, female voice)
3. **Gemini Flash** plans 5-15 second scenes (image queries, animations, colors)
4. **Unsplash / Pexels** fetch relevant photos
5. **FFmpeg** composites each scene (image + text + animation), concatenates them, and muxes the audio
6. You get an MP4 to watch and download

## Quick start

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## Configuration

All configuration is in `.env`. A working `.env` is included; update the keys if you want to use your own.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini TTS + scene planning |
| `UNSPLASH_ACCESS_KEY` | Primary image source |
| `PEXELS_API_KEY` | Fallback image source |
| `PORT` | HTTP port (default 3000) |
| `MAX_SCRIPT_CHARS` | Max script length (default 5000) |
| `MAX_CONCURRENT_JOBS` | Pipeline concurrency (default 2) |
| `FONT_PATH` | TTF font for text rendering (Windows default: `C:/Windows/Fonts/arial.ttf`) |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/generate` | Body: `{ "script": "..." }` → returns `{ jobId, status, progress }` |
| `GET` | `/api/jobs/:id` | Status, progress, output URL when done |
| `GET` | `/api/video/:id` | Streams the MP4 (supports range requests for seeking) |
| `GET` | `/api/video/:id/download` | Forces download with filename |

## Output structure

```
jobs/<jobId>/
  audio.mp3
  scene_000.mp4, scene_001.mp4, ...
  video.mp4          (concatenated, no audio)
output/<jobId>.mp4   (final, with audio)
assets/images/       (cached stock photos)
```

## Tech stack

- **Node.js 20+** with Express
- **@google/generative-ai** for TTS and scene planning
- **ffmpeg-static** + **fluent-ffmpeg** for rendering (no Chromium needed)
- **Vanilla HTML/CSS/JS** frontend, no build step

## Security

The API keys in `.env` are sensitive. The file is gitignored. **Rotate any keys that have been shared in plain text** (chat, email, screenshots).
