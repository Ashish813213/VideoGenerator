# VideoGen — Project Context

## Goal
- Build a no-auth web app that turns a text script into a narrated video using Gemini + Lucide icons + FFmpeg.
- Architecture defined in `docs/PRD.md`, `docs/SystemDesign.md`, `docs/TDD.md`.

## Constraints & Preferences
- No login/signup, no auth — paste script → get MP4.
- "Simple" — skip Remotion/Chromium, use FFmpeg-only rendering.
- Icons: **Lucide first**, Pexels, then Unsplash.
- Lucide icons (PascalCase) drawn via `lucide-static` + `sharp` SVG→PNG, cached in `assets/icons/`.
- Windows env, Node 20+, `ffmpeg-static` for binary.
- API keys in `.env` (gitignored). User has been sharing keys in chat — **must rotate after**.

## Architecture (as built)
```
public/                 # static frontend (no build step)
  index.html, style.css, app.js   # 3-step UI, 3 example scripts, dark/light auto
server/
  index.js              # Express, 5 API routes, serves /public
  config.js             # env loader + FONT_PATH colon-safe copy
  tts.js                # generateSpeechAndTimestamps (real + silent-skip)
  planner.js            # Gemini → scene plan (validator auto-derives fg from bg)
  lucide.js             # icon library, normalizeLucideName, pickIconForQuery
  assets.js             # resolveVisual/resolveScenes (Lucide → Pexels → Unsplash)
  render.js             # renderScene + concatScenes + muxAudio
  pipeline.js           # job state machine, queue
jobs/{id}/              # per-job audio.mp3, scene_NNN.mp4, video.mp4
output/{id}.mp4         # final muxed MP4
assets/icons/           # cached Lucide PNGs (md5(name)_color.png)
assets/images/          # cached Pexels/Unsplash JPGs
node_modules/.cache/    # safe font copy (no colon in path)
```

## Recent Bugs & Fixes
1. **Font path colon escape failing** — `C:/Windows/Fonts/arial.ttf` has a colon; FFmpeg's `fontfile='C\:/...'` escape wasn't honored in the filter complex parser. Entire drawtext chain failed → retry path taken → still failed → no text drawn. **Fix:** `config.js` copies the font to `node_modules/.cache/videogen-font.ttf` at startup if a colon is present. Render no longer escapes colons.
2. **Invisible black-on-black** — `text_color` defaulted to `#000000` even when `bg_color` was also black. **Fix:** `planner.js` validator now auto-derives `text_color` from `bg_color` (white on black, black on white).
3. **drawtext with empty box=0** — removed redundant `box=1:boxcolor=@0.0:boxborderw=20` (no-op transparent box).
4. **Pipeline debug log read wrong field** — `s.text` → `s.display_text`; also logs `bg`, `fg`, `icon` now.

## Current Status
- Server runs on `http://localhost:3000`.
- `SKIP_TTS=true` mode works: silent audio via ffmpeg `anullsrc`, estimated timestamps from word count, scenes planned by Gemini against script.
- Icons render in correct contrasting color (cached as `{md5}_{color}.png`).
- Font safely copied on startup.
- Last test produced 4 scenes for a 16.4s script, all valid MP4s (silent).

## Blocked
- Real TTS unavailable: Gemini TTS rejects `en-US-Standard-C`. Valid voices: `Kore, Puck, Zephyr, Aoede, Leda, Orus, Perseus` (any of 30+ listed in error).
- Until TTS is restored, no narration — silent video only.

## Next Steps
1. **Test the latest fix** — restart server, send a real script, verify the rendered frame has visible icon + text on a contrasting background.
2. **Re-enable TTS** by changing `ttsVoice` in `server/config.js` to a valid voice (e.g., `Kore` or `Zephyr`) and setting `SKIP_TTS=false`.
3. **Rotate all API keys** that were shared in chat.

## Key API / Config
- `POST /api/generate` `{script}` → `{jobId, status:"processing"}`
- `GET /api/jobs/:id` → `{status, progress, current_step, error_msg, output_url, duration_ms}`
- `GET /api/video/:id` → streams MP4
- `GET /api/health` → status + skipTts flag
- `.env`: `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `FONT_PATH`, `SKIP_TTS`, `WORDS_PER_MINUTE`, `PORT`, `MAX_CONCURRENT_JOBS`

## Environment Notes
- `.env` current key: `GEMINI_API_KEY=<REDACTED — see .env, do NOT commit>` (Cloudflare-prefixed; works for `gemini-flash-latest` text). Real Gemini keys are `AIzaSy...` — this one is anomalous. **Rotate.**
- FFmpeg filter graph reference (lucide branch): `[bg][ico]overlay=x='(W-520)/2':y='(H*0.18)':eval=init[ov];[ov]drawtext=textfile=...:fontcolor=...:fontsize=...`
- Concat demuxer needs absolute paths in list file.

## File Map
- `D:\Mr.Ashish\VideoGen\package.json` — deps + scripts.
- `D:\Mr.Ashish\VideoGen\.env` — keys, paths, flags.
- `D:\Mr.Ashish\VideoGen\.env.example` — template.
- `D:\Mr.Ashish\VideoGen\.gitignore` — excludes `node_modules/`, `.env`, `jobs/`, `output/`, `assets/`.
- `D:\Mr.Ashish\VideoGen\server\index.js` — Express app, 5 routes, static frontend.
- `D:\Mr.Ashish\VideoGen\server\config.js` — env loader, **font colon-copy logic**, plannerModel.
- `D:\Mr.Ashish\VideoGen\server\tts.js` — TTS + STT + silent-audio + estimated timestamps.
- `D:\Mr.Ashish\VideoGen\server\planner.js` — system prompt with Lucide hints; **validator auto-derives fg from bg**.
- `D:\Mr.Ashish\VideoGen\server\lucide.js` — icon library, `normalizeLucideName`, `pickIconForQuery`.
- `D:\Mr.Ashish\VideoGen\server\assets.js` — `resolveVisual`, `resolveScenes`; Lucide PNG render via sharp.
- `D:\Mr.Ashish\VideoGen\server\render.js` — `renderScene` (per-scene MP4), `concatScenes`, `muxAudio`.
- `D:\Mr.Ashish\VideoGen\server\pipeline.js` — job state machine, queue, **debug log per scene**.
- `D:\Mr.Ashish\VideoGen\public\index.html` + `style.css` + `app.js` — frontend.
- `D:\Mr.Ashish\VideoGen\README.md` — setup + API docs.
- `D:\Mr.Ashish\VideoGen\docs\PRD.md`, `SystemDesign.md`, `TDD.md` — reference architecture.
- `D:\Mr.Ashish\VideoGen\jobs\` — runtime per-job files.
- `D:\Mr.Ashish\VideoGen\output\` — final MP4s.
- `D:\Mr.Ashish\VideoGen\assets\icons\`, `assets\images\` — caches.
- `D:\Mr.Ashish\VideoGen\context.md` — this file.

## Commands
- Start: `node server/index.js` (or via `Start-Process` detached)
- Stop: `Stop-Process -Name node -Force`
- Test job: `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/generate -ContentType application/json -Body (@{script="..."} | ConvertTo-Json)`
- Frame extract: `node_modules\ffmpeg-static\ffmpeg.exe -y -ss 1 -i <video> -frames:v 1 -update 1 frame.png`
