# VideoGen — Project Context

## Goal
- Build a no-auth web app that turns a text script into a narrated video with premium motion-graphics (Apple / Kurzgesagt / Veritasium style) using Gemini + Lucide icons + FFmpeg.
- Architecture defined in `docs/PRD.md`, `docs/SystemDesign.md`, `docs/TDD.md`.

## Constraints & Preferences
- No login/signup, no auth — paste script → get MP4.
- "Simple" — skip Remotion/Chromium, use FFmpeg-only rendering.
- Icons: **Lucide first**, Pexels, then Unsplash.
- Lucide icons (PascalCase) drawn via `lucide-static` + `sharp` SVG→PNG, cached in `assets/icons/`.
- Windows env, Node 20+, `ffmpeg-static` for binary.
- API keys in `.env` (gitignored). User shared keys in chat — **must rotate after**.

## Architecture (as built)

```
public/                       # static frontend — no build step
  index.html, style.css, app.js   # 3-step UI, dark/light auto

server/
  index.js                    # Express, 5 routes, graceful shutdown
  config.js                   # env loader + FONT_PATH colon-safe copy
  design.js                   # design system: colors, palette, 8 scene types
  tts.js                      # generateSpeechAndTimestamps (real + silent-skip)
  planner.js                  # Gemini → scene plan, 8 scene types, validator
  lucide.js                   # 1737-icon library, normalizeLucideName, pickIconForQuery
  assets.js                   # resolveSceneVisual (Lucide → Pexels → Unsplash)
  render.js                   # renderScene dispatch + concat + mux
  pipeline.js                 # job state machine, queue, debug log
  scenes/
    base.js                   # FilterBuilder: bg, text, glow, icon, line, etc.
    index.js                  # 8 scene-type renderers (hero/definition/callout/stat/process/timeline/comparison/summary)

jobs/{id}/                    # per-job audio.mp3, scene_NNN.mp4, video.mp4
output/{id}.mp4               # final muxed MP4

assets/
  icons/                      # cached Lucide PNGs (md5(name)_color_size.png)
  images/                     # cached Pexels/Unsplash JPGs
  fonts/                      # Space Grotesk, Inter, Bebas Neue (TTF)

node_modules/.cache/          # safe font copy (no colon in path)
```

## Design System (V3)

### 8 Scene Types
1. **hero** — opening title + subtitle, big accent text + pulse icon
2. **definition** — keyword + 1-line definition
3. **callout** — accent-colored card with glow + icon + insight
4. **stat** — huge animated counter (0 → final) with Bebas Neue, label below
5. **process** — 2–4 step cards with icons, arrows, sequential reveal
6. **timeline** — horizontal line with dot markers + year + label
7. **comparison** — left/right cards with colored borders
8. **summary** — 3 takeaway cards with numbered headers

### Color Palette
- `bgDark: #0A0A0A`, `bgLight: #FAFAFA`
- Tech: `blue #3B82F6` + `cyan #06B6D4`
- Finance: `emerald #10B981` + `green #22C55E`
- Science: `purple #8B5CF6` + `blue`
- Warning: `red #EF4444` + `orange #F97316`
- Energy: `orange #F97316` + `yellow #FACC15`
- Topic auto-detected from script via keyword scoring in `design.js#detectTopic`.

### Animations
- Text: word-by-word, kineticTypography, scalePop, fadeUp, glow text (2 drawtext layers)
- Icon: scaleIn (0.4s), pulse (sin-based), rotate, popIn
- Counter: `eif::expr:d` for 0→value
- Cards: gradient backgrounds, multi-layer drawbox with @alpha

### Typography
- Display: **Space Grotesk Bold**
- Body: **Inter Regular/Bold**
- Stat: **Bebas Neue Regular**
- All in `assets/fonts/`, paths auto-resolved by `design.js#FONTS`.

## Recent Bugs & Fixes
1. **Font path colon escape failing** — `C:/Windows/Fonts/arial.ttf` colon was breaking FFmpeg's filter parser. **Fix:** `config.js` copies font to `node_modules/.cache/videogen-font.ttf` at startup; render no longer escapes colons.
2. **Invisible black-on-black** — `text_color` defaulted to black, `bg_color` was black. **Fix:** `planner.js` validator now auto-derives `text_color` from `bg_color`.
3. **drawtext with redundant box** — removed no-op `box=1:boxcolor=@0.0:boxborderw=20`.
4. **Pipeline debug log read `s.text`** instead of `s.display_text` — fixed.
5. **FilterBuilder input index bug** — was using label-counter for input index, causing wrong `[N:v]` references. **Fix:** separate `inputIdx` counter in `FilterBuilder.pushInput()`.
6. **Server doesn't release port on kill** — `index.js` now has `SIGINT/SIGTERM` handlers that `server.close()` and exit cleanly, plus `EADDRINUSE` startup error.
7. **Hero scene syntax error** — `x = '(W-360)/2'` (assignment) → `x: '(W-360)/2'` (object key).

## Current Status
- Server runs on `http://localhost:3000` with graceful shutdown.
- 15 commits pushed to https://github.com/Ashish813213/VideoGenerator (force-pushed to replace old single-commit main).
- New V3 design system built (8 scene types, 7 fonts, gradients, counters, glow).
- **Just restarted server with V3** but end-to-end test of new renderers NOT YET RUN — first attempt to render likely has filter-graph issues that need debugging.
- `SKIP_TTS=true` mode still used: silent audio via `anullsrc`, estimated timestamps from word count.

## Blocked
- Real TTS unavailable: Gemini TTS rejects `en-US-Standard-C`. Valid voices: `Kore, Puck, Zephyr, Aoede, Leda, Orus, Perseus` (any of 30+ listed in error).
- Until TTS is restored, no narration — silent video only.

## Next Steps
1. **Debug V3 renderer** — run end-to-end test (`Invoke-RestMethod POST /api/generate`), inspect server.log for filter-graph errors, extract a frame to verify colored motion graphics.
2. **Fix any filter-graph issues** that surface in first V3 render — likely candidates: counter expression syntax, complex chained drawtext with `enable`, drawbox overlay ordering.
3. **Re-enable TTS** by changing `ttsVoice` in `server/config.js` to a valid voice (e.g., `Kore` or `Zephyr`) and setting `SKIP_TTS=false`.
4. **Rotate all API keys** shared in chat (Gemini, Pexels, Unsplash).

## Key API / Config
- `POST /api/generate` `{script}` → `{jobId, status:"processing"}`
- `GET /api/jobs/:id` → `{status, progress, current_step, error_msg, output_url, duration_ms}`
- `GET /api/video/:id` → streams MP4 (HTTP range)
- `GET /api/video/:id/download` → attachment download
- `GET /api/health` → status + skipTts flag
- `.env`: `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `FONT_PATH`, `SKIP_TTS`, `WORDS_PER_MINUTE`, `PORT`, `MAX_CONCURRENT_JOBS`

## Environment Notes
- `.env` current key: `GEMINI_API_KEY=<REDACTED — see .env, do NOT commit>` (Cloudflare-prefixed; works for `gemini-flash-latest` text). Real Gemini keys are `AIzaSy...` — this one is anomalous. **Rotate.**
- FFmpeg filter graph uses label-based chaining (`[bg]` → `[t1]` → `[t2]` …).
- Concat demuxer needs absolute paths in list file.
- API keys were caught by GitHub secret scanning in first push attempt — context.md redacts the key value going forward.

## File Map
- `D:\Mr.Ashish\VideoGen\package.json` — deps + scripts (`start`, `dev`).
- `D:\Mr.Ashish\VideoGen\.env` — keys, paths, `SKIP_TTS=true`, `WORDS_PER_MINUTE=150`.
- `D:\Mr.Ashish\VideoGen\.env.example` — template.
- `D:\Mr.Ashish\VideoGen\.gitignore` — excludes `node_modules/`, `.env`, `jobs/`, `output/`, `assets/`, `frames/`, `DOCS/`, `*.docx`, `*.log`.
- `D:\Mr.Ashish\VideoGen\server\index.js` — Express app, 5 routes, static frontend, graceful shutdown.
- `D:\Mr.Ashish\VideoGen\server\config.js` — env loader, **font colon-copy logic**, plannerModel.
- `D:\Mr.Ashish\VideoGen\server\design.js` — color palette, 8 scene types, topic detection, font paths.
- `D:\Mr.Ashish\VideoGen\server\tts.js` — TTS + STT + silent-audio + estimated timestamps.
- `D:\Mr.Ashish\VideoGen\server\planner.js` — system prompt with 8 scene types, validator, gap-fill.
- `D:\Mr.Ashish\VideoGen\server\lucide.js` — 1737-icon library, `normalizeLucideName`, `pickIconForQuery`, `getIconSvg`.
- `D:\Mr.Ashish\VideoGen\server\assets.js` — `resolveSceneVisual`, sharp-rendered Lucide PNGs (cached), Pexels→Unsplash fallback.
- `D:\Mr.Ashish\VideoGen\server\render.js` — `renderScene` dispatch, `concatScenes`, `muxAudio`, fallback.
- `D:\Mr.Ashish\VideoGen\server\pipeline.js` — job state machine, queue, debug log.
- `D:\Mr.Ashish\VideoGen\server\scenes\base.js` — `FilterBuilder` (bg, text, glow, icon, image, line).
- `D:\Mr.Ashish\VideoGen\server\scenes\index.js` — 8 scene-type renderers.
- `D:\Mr.Ashish\VideoGen\public\index.html` + `style.css` + `app.js` — frontend.
- `D:\Mr.Ashish\VideoGen\README.md` — setup + API docs.
- `D:\Mr.Ashish\VideoGen\docs\PRD.md`, `SystemDesign.md`, `TDD.md` — reference architecture.
- `D:\Mr.Ashish\VideoGen\jobs\` — runtime per-job files.
- `D:\Mr.Ashish\VideoGen\output\` — final MP4s.
- `D:\Mr.Ashish\VideoGen\assets\icons\`, `assets\images\`, `assets\fonts\` — caches.
- `D:\Mr.Ashish\VideoGen\context.md` — this file.

## Commands
- Start: `node server/index.js` (or via `Start-Process` detached)
- Stop: `Stop-Process -Name node -Force` (or Ctrl+C if in foreground — graceful shutdown releases the port)
- Test job: `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/generate -ContentType application/json -Body (@{script="..."} | ConvertTo-Json)`
- Frame extract: `node_modules\ffmpeg-static\ffmpeg.exe -y -ss 1 -i <video> -frames:v 1 -update 1 frame.png`
- Git: 15 commits on `main` at https://github.com/Ashish813213/VideoGenerator
