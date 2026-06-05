# Technical Design Document (TDD) — VideoGen

## 1. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node 20+ (ESM) | Native fetch, `node_modules/.cache` writable |
| HTTP | Express 4 | Smallest viable server, range-stream support is trivial |
| AI | `@google/generative-ai` | Gemini Flash for planner, TTS preview for narration |
| Video | `ffmpeg-static` + `fluent-ffmpeg` | No system FFmpeg needed; fluent API for filter graphs |
| Images | `sharp` (SVG→PNG) + `lucide-static` (1737 icons) | librsvg via sharp is reliable; FFmpeg SVG is flaky |
| HTTP client | `axios` | Pexels/Unsplash REST calls |
| IDs | `nanoid(12)` | Short, URL-safe, collision-resistant |
| Frontend | Vanilla HTML/CSS/JS | No build step, no framework lock-in |

## 2. Key Algorithms

### 2.1 Topic detection (`design.js#detectTopic`)
For each known topic (technology, finance, warning, science, success, energy, neutral), count keyword matches in the lower-cased script. Return the highest-scoring topic, or `neutral` if no keywords match.

### 2.2 Icon normalization (`lucide.js#normalizeLucideName`)
- Input: any of `cog`, `cog-icon`, `Cog`, `cog_icon`.
- Output: PascalCase valid Lucide name (`Cog`).
- Strip non-alphanumerics, split on `-`/`_`/space, capitalize each part, re-join.
- Validate against the 1737-name library.

### 2.3 Icon picker (`lucide.js#pickIconForQuery`)
A `KEYWORD_TO_ICON` map (~100 entries) covers common concepts. Fallback: search the icon name list for the query, then for a single keyword. Default: `Sparkles`.

### 2.4 Silent TTS (`tts.js#generateSpeechAndTimestamps` SKIP_TTS path)
1. Build silent audio: `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t <dur> -q:a 9 -acodec libmp3lame audio.mp3`.
2. Build estimated timestamps: `words.map((w,i) => ({w, start: i*0.4, end: (i+1)*0.4}))` using `WORDS_PER_MINUTE`.

### 2.5 Planner validation (`planner.js#validateScene`)
Per scene: clamp `scene_type` to the 8 allowed values, normalize icon name, validate animation, validate color hex, type-specific extraction (`steps`, `milestones`, `value`, `left`/`right`, `takeaways`). `fillGaps` inserts text_only scenes where the planner left holes and extends the last scene to the end.

### 2.6 Filter graph building (`scenes/base.js#FilterBuilder`)
The builder chains filters by label:
```
v0 = background     (color/gradient)
v1 = icon overlay   (scaled/pulsed)
v2 = title text     (with glow)
v3 = subtitle text
v4 = ...
```
Each text/icon add is `this.idx++` so labels never collide. Inputs are tracked separately via `inputIdx`.

## 3. Per-Scene-Type Rendering

| Type | Background | Layout | Animation |
|---|---|---|---|
| hero | gradient | icon (centered-top) + big title + subtitle | scalePop icon, glow title, fade subtitle |
| definition | solid | icon + uppercase title + body | scaleIn icon, glow title, fadeUp body |
| callout | solid + colored card | icon (in card) + title + body | scaleIn icon, glow title |
| stat | gradient | huge counter (Bebas Neue) + label | 0→value via `eif::floor(N*min(t/d,1)):d` |
| process | solid | N cards (icon+number) + arrows | sequential card reveal, slideRight arrows |
| timeline | solid | horizontal line + N dots + labels | left-to-right marker reveal |
| comparison | solid | left/right cards with colored borders | slideLeft (left) and slideRight (right) |
| summary | gradient | 3 numbered cards with icons | fadeUp per card, scaleIn icons |

## 4. FFmpeg Conventions

- **Resolution**: 1920×1080 @ 30fps, H.264 + AAC, faststart.
- **Filter graph**: `complexFilter` with chained labels `[v0]…[v1]…[v2]…`.
- **Inputs**: PNGs as `[0:v]`, `[1:v]`, …; gradient/color as inline `gradients=…` or `color=…` (no input).
- **Loop**: `-loop 1` for static PNGs.
- **Concat**: demuxer with absolute paths in a `.list.txt` file.
- **Mux**: `-c:v copy -c:a aac -b:a 128k -shortest`.

### 4.1 Font path safety
Windows fonts at `C:/Windows/Fonts/arial.ttf` contain a `:` which FFmpeg's filter parser sees as a separator. `config.js#resolveSafeFontPath` copies the font to `node_modules/.cache/videogen-font.ttf` (no colon) and that path is used in `drawtext`/`fontfile`.

### 4.2 Common gotchas
- `[0:v]` references must match the input order fed to ffmpeg. The `FilterBuilder` tracks its own `inputIdx` to avoid collisions.
- Filter clauses joined with `;` (not `,`).
- Single-quoted filter values must escape any literal `'` in the string.
- `drawtext` `text='...'` with newlines must have `\n` replaced with spaces.

## 5. Concurrency Model

```
queue: string[]              // jobIds
active: Set<string>          // currently processing
pumpQueue:                   // while active.size < MAX && queue.length:
  const id = queue.shift()
  active.add(id)
  runJob(id).finally(...)
```

- `MAX_CONCURRENT_JOBS` default 2.
- In-memory job store (`Map<id, Job>`).
- No persistence — restart loses all in-flight jobs.

## 6. Error Handling

| Layer | Strategy |
|---|---|
| TTS | try real; on failure or `SKIP_TTS=true`, generate silent audio |
| Planner | retry once on JSON parse failure; fallback to a single hero scene |
| Asset | Lucide failure → Pexels → Unsplash → text_only |
| Render | catch ffmpeg error → re-render the scene as a black 1-color clip |
| Concat | single-scene copy if N=1 |
| Mux | `ffmpeg` built-in error events; logged to console |

## 7. Environment

- `GEMINI_API_KEY` — Gemini for planner + (when enabled) TTS.
- `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` — image fallback.
- `FONT_PATH` — defaults to `C:/Windows/Fonts/arial.ttf`; copied to safe path on startup.
- `SKIP_TTS` — `true` to skip real TTS and produce silent audio.
- `WORDS_PER_MINUTE` — used by the silent path to estimate timestamps.
- `PORT` — server port (default 3000).
- `MAX_CONCURRENT_JOBS` — parallel jobs (default 2).
- `MAX_SCRIPT_CHARS` — 5000.

## 8. Performance

- Single FFmpeg process per scene.
- `ffmpeg-static` binary ≈ 70MB; `libx264 -preset veryfast` for speed.
- Icons cached as `{md5}_{color}.png` — only the first scene with a given icon+color triggers a sharp render.
- Concurrency caps prevent OOM on small VMs.

## 9. Security

- API keys only in `.env` (gitignored).
- No user data persisted beyond per-job scratch.
- HTTP range streaming uses `fs.createReadStream` with explicit start/end; no path traversal risk because the `:id` is a nanoid and the path is hard-built.
- `helmet` not currently used — public assets only, no auth surface.
- GitHub secret scanning enforced — first push was blocked; key was redacted from `context.md`.

## 10. Testing

- Manual e2e: `Invoke-RestMethod POST /api/generate` → poll `/api/jobs/:id` → `GET /api/video/:id`.
- Frame extraction: `ffmpeg -y -ss 1 -i <video> -frames:v 1 -update 1 frame.png` to verify colored motion graphics.
- Log inspection: `Get-Content server.log` for filter-graph errors, planner output, asset resolution.
- No automated test suite yet — recommended next: a fixture script + golden-frame comparison.

## 11. Known Limitations

- `gemini-flash-latest` planner occasionally returns scenes with missing fields; the validator patches but may over-default.
- TTS path is currently `SKIP_TTS=true` only (real TTS voice name needs rotation to a supported voice).
- No retry/backoff on Gemini errors — they fail the job.
- No SSR or pre-rendering; the video is the only output.
