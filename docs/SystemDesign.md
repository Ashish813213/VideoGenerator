# System Design — VideoGen

## 1. High-Level Architecture

```
┌────────────┐    POST /api/generate    ┌─────────────────┐
│  Browser   │ ───────────────────────► │  Express Server │
│  (public/) │                         │  (server/)      │
│            │ ◄── JSON jobId ──────── │                 │
│            │                         │                 │
│            │   GET /api/jobs/:id     │                 │
│            │ ───────────────────────►│                 │
│            │ ◄── status/progress ─── │                 │
│            │                         │                 │
│            │   GET /api/video/:id    │                 │
│            │ ◄──── MP4 stream ────── │                 │
└────────────┘                         └─────────────────┘
                                                │
                ┌───────────────────────────────┼───────────────────────────────┐
                │                               │                               │
        ┌───────▼────────┐              ┌────────▼────────┐              ┌───────▼────────┐
        │  Gemini TTS    │              │  Gemini Planner │              │  FFmpeg Static │
        │  + fallback    │              │  (scene plan)   │              │  + Lucide PNG  │
        └────────────────┘              └─────────────────┘              └────────────────┘
```

## 2. Process Flow

```
script (string)
    │
    ▼
[createJob]  ─────►  in-memory job queue
    │
    ▼
[generateSpeechAndTimestamps]
    │  • real: Gemini TTS + STT
    │  • skip: silent audio + word-based timing
    ▼
[planScenes]   ──────►  JSON array of scenes
    │
    ▼
[resolveScenes] ──────►  per-scene icon PNGs (cached)
    │
    ▼
[renderScene × N]  ───►  scene_NNN.mp4
    │
    ▼
[concatScenes]  ──────►  video.mp4
    │
    ▼
[muxAudio]  ─────────►  output/{id}.mp4
    │
    ▼
[stream]   GET /api/video/:id
```

## 3. Module Layout

| Module | Responsibility |
|---|---|
| `server/index.js` | Express app, REST routes, static frontend, graceful shutdown |
| `server/config.js` | Env loader, safe font-path copy, planner/tts model names |
| `server/design.js` | Color palette, 8 scene types, topic detection, font registry |
| `server/tts.js` | TTS, STT, silent-audio + estimated timing |
| `server/planner.js` | Gemini prompt, scene validator, gap-fill |
| `server/lucide.js` | 1737-icon library, `normalizeLucideName`, `pickIconForQuery` |
| `server/assets.js` | `resolveSceneVisual` — Lucide → Pexels → Unsplash, sharp-rendered PNGs |
| `server/render.js` | `renderScene` dispatch, `concatScenes`, `muxAudio` |
| `server/pipeline.js` | Job state machine, queue, orchestrator |
| `server/scenes/base.js` | `FilterBuilder` — bg/text/glow/icon primitives |
| `server/scenes/index.js` | 8 per-type renderers |

## 4. Data Model

### Job
```ts
Job = {
  id: string                    // nanoid(12)
  script: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  progress: number              // 0..100
  current_step: string
  error_msg: string | null
  audio_path: string | null
  output_path: string | null
  duration_ms: number
  created_at: number            // epoch ms
  updated_at: number
}
```

### Scene (post-validation)
```ts
Scene = {
  id: string
  scene_type: 'hero'|'definition'|'callout'|'stat'|'process'|'timeline'|'comparison'|'summary'
  start_ms: number
  end_ms: number
  title: string
  subtitle: string
  highlight_words: string[]
  animation: string             // scalePop, fadeUp, wordByWord, etc.
  accent_color: string          // hex
  text_color: string            // hex
  bg_color: string              // hex
  lucide_icon_name: string | null
  // type-specific:
  value?: string                // stat
  label?: string                // stat
  steps?: {label, icon}[]       // process
  milestones?: {label, year}[]  // timeline
  left?: {title, points, icon, color}     // comparison
  right?: {title, points, icon, color}    // comparison
  takeaways?: {text, icon}[]    // summary
}
```

## 5. Concurrency

- Single-process Node 20+ server.
- In-memory `Map<id, Job>` and FIFO queue.
- `MAX_CONCURRENT_JOBS` (default 2) controls parallel renders.
- Each job holds its own working directory at `jobs/{id}/`.

## 6. Storage

| Path | Purpose | Lifetime |
|---|---|---|
| `jobs/{id}/` | Per-job scratch (audio, scene clips, video.mp4) | Ephemeral |
| `output/{id}.mp4` | Final muxed output | Persistent |
| `assets/icons/{md5}_{color}.png` | Lucide icon cache | Persistent |
| `assets/images/{md5}.{ext}` | Pexels/Unsplash cache | Persistent, 7-day TTL |
| `node_modules/.cache/videogen-font.ttf` | Safe font copy | Persistent |

## 7. Failure Modes

| Failure | Detection | Recovery |
|---|---|---|
| Invalid script | length check in `createJob` | 400 response |
| Gemini TTS failure | TTS API error | `SKIP_TTS` path produces silent audio |
| Planner failure | JSON parse error or empty plan | 1 retry, then 1-scene fallback |
| Asset fetch failure | network error | Lucide icon fallback → text_only |
| Filter graph error | ffmpeg non-zero exit | scene is re-rendered with a black-clip fallback |
| Concat failure | demuxer error | single-scene copy if only one clip |
| Port already in use | `EADDRINUSE` | clear error message + non-zero exit |

## 8. Design Decisions

- **FFmpeg-only rendering** — keeps the build small and the binary deterministic. Trade-off: no fancy CSS-like easing; we approximate with `t`-based expressions.
- **Lucide first** — deterministic, fast, infinitely cacheable. Real photos are reserved for the rare "concrete physical scene" case.
- **Sharp for SVG→PNG** — librsvg is reliable; FFmpeg SVG support is flaky.
- **Concat demuxer with absolute paths** — relative paths resolve against the list file's directory.
- **Safe font copy** — Windows colon in `C:/Windows/Fonts/...` breaks FFmpeg's filter parser.
- **In-memory jobs** — no DB needed for the v1 single-user experience.

## 9. Observability

- `morgan('tiny')` for HTTP access logs.
- `console.log` for pipeline events: TTS skip, planner output per scene, render failures, fallback activations.
- `server.log` is the captured stdout when launched via `Start-Process`.
- Per-scene debug line in `pipeline.js` logs `scene_type`, `accent_color`, icons resolved, title.

## 10. Future Work

- Re-enable real TTS with a valid Gemini voice name.
- Server-Sent Events for progress instead of polling.
- Multi-user queue persistence (Redis/SQLite).
- Per-user font selection.
- Background music / sound-effect layer.
- Caption/subtitle burn-in.
