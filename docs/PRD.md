# Product Requirements Document (PRD) — VideoGen

## 1. Overview

**VideoGen** is a no-authentication, single-page web app that converts a text script into a narrated short-form video. The user pastes a script (or picks an example), submits it, and receives a downloadable MP4 in roughly the style of Kurzgesagt / Veritasium / Ali Abdaal — colored, kinetic, motion-graphics-driven, with Lucide icons and topic-aware theming.

The whole pipeline runs server-side: Gemini plans the scenes, FFmpeg renders them, and the resulting MP4 is streamed back to the browser.

## 2. Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Zero-friction: paste script → MP4 in <60s for a 30s script | P95 generation ≤ 60s for scripts up to 5000 chars |
| G2 | No login, no signup, no API key for the end user | Frontend has no auth UI |
| G3 | Premium motion-graphics look (Apple/Kurzgesagt/Veritasium) | 8 scene types, topic-driven color, word-by-word text, kinetic icons |
| G4 | Cheap & simple stack | No Remotion/Chromium; FFmpeg-only rendering |
| G5 | Deterministic visuals for known concepts | Lucide icons as the first visual choice |

## 3. Non-Goals

- Real-time preview or in-browser editing
- Multi-track audio or background music
- Captions/subtitles
- User accounts, history, or sharing
- Long-form video (target: 30–90s outputs)

## 4. User Stories

- **US1**: As a content creator, I paste a 200-word script about a topic and get a 30-second explainer video with icons and animated text.
- **US2**: As a student, I want a video I can play inline and download for offline use.
- **US3**: As a teacher, I want to regenerate a video quickly when I tweak the script.
- **US4**: As a casual user, I want one-click example scripts that already produce a good result.

## 5. Functional Requirements

### 5.1 Frontend (public/)
- Single HTML page, no build step.
- Three-step UI: **input → progress → result**.
- Three built-in example scripts.
- Submit button posts to `POST /api/generate` with `{ script }`.
- Progress bar polls `GET /api/jobs/:id` every 1.5s.
- Result page embeds the video with native `<video>` controls and a download button.
- Honors `prefers-color-scheme` for dark/light theme.

### 5.2 Backend API
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/generate` | Create a job. Returns `{jobId, status:"processing"}` |
| `GET` | `/api/jobs` | List recent jobs (max 50) |
| `GET` | `/api/jobs/:id` | Job state, progress, error, output URL |
| `GET` | `/api/video/:id` | Stream MP4 (HTTP range support) |
| `GET` | `/api/video/:id/download` | Force-download MP4 |
| `GET` | `/api/health` | Liveness + skipTts flag |

### 5.3 Pipeline
1. **TTS** — Gemini `gemini-2.5-flash-preview-tts` produces an MP3 narration + word-level timestamps. Falls back to silent audio (`anullsrc`) + estimated timestamps if `SKIP_TTS=true`.
2. **Planner** — Gemini `gemini-flash-latest` returns a JSON array of scenes with start/end ms, type, title, subtitle, accent color, icon, animation, and per-type data (steps, milestones, value, etc.).
3. **Assets** — For each scene, render Lucide icon as PNG (sharp + cached). Optionally fetch Pexels/Unsplash image.
4. **Render** — Per-scene FFmpeg filter graph produces `scene_NNN.mp4`.
5. **Concat** — Demuxer merges scenes into `video.mp4`.
6. **Mux** — Video + audio merged into `output/{id}.mp4`.

### 5.4 Design System
- 8 scene types: `hero`, `definition`, `callout`, `stat`, `process`, `timeline`, `comparison`, `summary`.
- Topic auto-detection (tech/finance/warning/science/success/energy) drives color palette.
- Fonts: Space Grotesk (display), Inter (body), Bebas Neue (stat).
- All visuals must be animated — no static scenes longer than 3s.

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | 30s video generated in <60s on a single server |
| Reliability | Failed scenes fall back to a black clip; pipeline never throws to the user |
| Portability | Cross-platform; tested on Windows with `ffmpeg-static` |
| Privacy | User scripts are processed in-memory and not persisted beyond the job |
| Security | API keys in `.env` (gitignored); no third-party tracking |

## 7. Constraints

- No Remotion, no Chromium, no headless browser.
- FFmpeg is the only video engine.
- Lucide icons as the default visual; Pexels/Unsplash are fallbacks for concrete physical scenes.
- Windows path quirks (colon in `C:/Windows/Fonts/...`) are handled by copying the font to a safe cache path at startup.

## 8. Acceptance Criteria

A release is "done" when:
1. A user can paste a 30-word script and download a 20–60s MP4 without errors.
2. The output uses at least 3 different scene types from the 8 available.
3. The output has visible icons, colored backgrounds, and animated text (visible in extracted frames at multiple timestamps).
4. The server releases its port on `Ctrl+C` or `SIGTERM`.
5. Pushing to GitHub does not leak any API keys.
