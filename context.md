# VideoGen Project Context

Last verified: June 8, 2026

## Product Goal

VideoGen is a local, no-auth web app that converts a text script into a narrated
1920x1080 MP4. It uses Gemini for narration and planning, Lucide/stock assets for
visuals, bundled Google Fonts for role-based typography, and FFmpeg for scene
rendering, concatenation, and audio muxing.

Primary flow:

1. User submits a script in the vanilla web UI.
2. Gemini TTS creates narration and Gemini Flash derives word timestamps.
3. A three-stage planner creates content beats, visual direction, and scene specs.
4. Assets are resolved from Lucide first, then Pexels and Unsplash where relevant.
5. FFmpeg renders each scene, concatenates clips, and muxes narration.
6. The browser polls job status and exposes the final MP4.

## Current Architecture

```text
public/
  index.html                  UI shell
  style.css                   responsive styling
  app.js                      submit, poll, result playback/download

server/
  index.js                    Express routes and graceful shutdown
  config.js                   environment, paths, limits, feature flags
  pipeline.js                 in-memory jobs, queue, pipeline state machine
  tts.js                      Gemini TTS, WAV packaging, STT, timing fallback
  planner.js                  orchestration entry point and scene validation
  assets.js                   Lucide rendering and stock image cache
  lucide.js                   icon lookup and normalization
  design.js                   palettes, typography, topic detection
  render.js                   scene render, fallback, concat, audio mux
  planning/
    understand.js             script -> content beats
    direct.js                 beats -> visual direction/storyboard
    scene.js                  storyboard -> renderable scene specs
    orchestrate.js            runs the three planning stages
  scenes/
    base.js                   FFmpeg FilterBuilder primitives
    index.js                  scene-type renderers

jobs/{jobId}/                 audio, plans, scene clips, video-only MP4
output/{jobId}.mp4            final muxed video
assets/icons/                 generated Lucide PNG cache
assets/images/                stock image cache
assets/fonts/                 bundled role-based typography and licenses
```

The server exposes:

- `GET /api/health`
- `POST /api/generate` with `{ "script": "..." }`
- `GET /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/video/:id`
- `GET /api/video/:id/download`

## Runtime Configuration

Important `.env` variables:

- `GEMINI_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `PEXELS_API_KEY`
- `PORT`
- `JOBS_DIR`, `OUTPUT_DIR`, `ASSETS_DIR`
- `FONT_PATH`
- `MAX_SCRIPT_CHARS`
- `MAX_CONCURRENT_JOBS`
- `SKIP_TTS`
- `WORDS_PER_MINUTE`
- `ENABLE_ADVANCED_LAYOUTS`
- `ENABLE_TEXT_ANIMATIONS`
- `ENABLE_CONNECTORS`

Current verified TTS configuration:

- `SKIP_TTS=false`
- model: `gemini-2.5-flash-preview-tts`
- voice: `Kore`
- Gemini returns raw `audio/L16;codec=pcm;rate=24000`

Never commit `.env` or copy API key values into documentation/logs. Keys previously
shared outside the environment file should be rotated.

## TTS Root Cause and Fix

### Root cause

Gemini TTS returns raw signed 16-bit, 24 kHz, mono PCM. The old implementation
wrote those bytes directly to `audio.mp3`. FFmpeg then guessed that the file was
MP3, emitted repeated `Header missing` errors, and estimated a false duration.

Evidence from job `0UbGuT1GIyMV`:

- Raw payload size: 1,626,766 bytes
- Old mislabeled MP3 duration: 101.67 seconds
- Same bytes wrapped correctly as PCM WAV: 33.89 seconds
- The false duration stretched the final scene from 25.60s to 101.67s

### Implemented fix in `server/tts.js`

- Detect `audio/L16` / PCM responses.
- Add a valid 44-byte RIFF/WAV header.
- Save PCM output as `audio.wav`, not `audio.mp3`.
- Pass `audio/wav` to Gemini transcription.
- Treat numeric transcript values as milliseconds, as requested in the prompt.
- Reject timestamps outside the real audio duration.
- Make estimated word timings proportional and end exactly at audio duration.
- Reject obviously corrupt containers during duration probing.

### Verification

A live Gemini test returned:

```text
source MIME: audio/L16;codec=pcm;rate=24000
saved MIME:  audio/wav
duration:    3250 ms
timestamps:  8 words
```

Google's current TTS documentation also specifies converting the returned PCM as
`s16le`, 24 kHz, mono before using it as WAV/audio.

The local server was restarted after this fix and reports `skipTts=false`.

TTS synthesis now retries network failures, HTTP 429, and transient 5xx responses
up to three times with bounded backoff. This was added after an end-to-end request
received a transient Gemini HTTP 500.

## Renderer Root Cause and Fix

The June 5 output looked basic because all advanced FFmpeg graphs failed and
`renderScene()` silently emitted fallback clips.

The primary defect was missing output mapping. Every complex graph ended in a
named label such as `[v43]`, but `fluent-ffmpeg` was not told to map that label.
The graph rendered correctly as soon as the final label was passed to
`complexFilter`.

Additional visual defects fixed:

- Full-screen card/glow helper canvases were opaque and covered earlier layers.
- Direct `drawtext` strings broke on apostrophes.
- The stat renderer consumed one labeled stream twice.
- Lucide SVG `currentColor` rendered cached icons black.
- Icon glow created square artifacts.
- Neon text borders were large enough to become solid color slabs.
- Camera zoom expressions scaled by pixels instead of percentages.
- Right-side layouts still placed text on the left.
- Summary takeaways were not wrapped and collided across cards.
- Bright palette gradients were replaced with darker cinematic gradients.
- Process reveal timing now scales with scene duration.

Verification:

- All six saved scene graphs pass FFmpeg parser/render smoke tests.
- Hero, process, and summary clips were rendered as real MP4 files.
- Frames were visually inspected for icon color, typography, composition, and
  summary readability.
- V10 director rules now explicitly enforce multi-asset scenes, layout variety,
  and a new attention event at least every two seconds.
- A real API job (`TAxMNJBkAjwY`) completed TTS, planning fallback, assets,
  rendering, concatenation, and muxing. Its WAV is 14.61s and final MP4 is 14.50s.

The local server was restarted after these renderer changes.

## Known Problems

### P0 - Render fallback hides production failures

`renderScene()` catches the advanced-render error, then catches the normal
fallback error, then emits a black clip. The job can reach `done` even when every
real scene failed. Jobs need a degraded/failed status or a render-quality error
when fallback usage crosses a threshold.

### P1 - Existing output contains the old corrupt narration

`output/0UbGuT1GIyMV.mp4` is 91.97 seconds and was muxed from the invalid
headerless-PCM-as-MP3 file. It should be treated as a failed artifact and
regenerated after restart.

### P1 - Planning is slow and model retries are opaque

The latest three-stage planning run took about 154.6 seconds.
`gemini-flash-latest` failed twice during scene planning before
`gemini-2.5-flash` succeeded. API error details are cut off in `server.log`.
Record model, status code, retry delay, and stage duration without logging keys.

### P1 - Jobs only exist in memory

The `jobs` map is not restored on restart. Existing MP4 files remain on disk, but
the API returns `job not found`, so video routes cannot serve them after restart.
Persist minimal job metadata or reconstruct completed jobs from `output/`.

### P1 - Timestamp precision is approximate

Gemini audio understanding is being used as word-level STT. When it returns too
few or invalid timestamps, the code estimates timings from word lengths. This is
acceptable for scene timing but should not be described as guaranteed alignment.

The most recent STT failure is confirmed as quota exhaustion:

```text
429 Too Many Requests
generate_content_free_tier_requests
limit: 20
model: gemini-2.5-flash
```

The WAV was valid. STT did not fail because of audio encoding. Until quota resets
or billing/quota is increased, the timestamp fallback will be used.

## Animation Smoothness Update

The renderer previously changed image and icon frame dimensions on every frame
while keeping a fixed overlay origin. This produced visible edge warping,
top-left anchoring, abrupt icon size jumps, and occasional nearly empty frames
between scenes. Dynamic full-frame zoom and per-frame raster resizing were later
removed because they still created shimmer in encoded output.

The current renderer now:

- renders stock images into a fixed-size cover crop before animating them
- keeps stock image and icon raster dimensions fixed throughout a scene
- uses opacity, staging, and restrained position changes instead of raster zoom
- places animated icons inside a fixed transparent frame
- avoids dynamic full-frame camera scaling
- keeps displayed text and cards alive through the final scene frame
- wraps and scales display headlines to their available layout region
- crossfades scene clips for 250 ms using cloned tail frames
- preserves the original summed scene duration during crossfades
- renders gradients and final clips consistently at 30 fps
- removes the intentional blur previously applied to primary stock images

A local FFmpeg smoke test rendered two 1.8 second scenes into a 3.60 second
video, confirming that the crossfade does not shorten narration timing. Frames
before, during, and after the transition contained no black flash. The formerly
black stat scene also rendered successfully after the stat expression fix.

The generated visual quality can still be basic when Gemini planning is blocked
by quota. Smooth rendering cannot replace the richer scene specifications that
V10 would normally produce.

## Reference-Style Layout and Typography Update

The June 8 review used `D:\Mr.Ashish\Miscelleonous\Refernce Vid.mp4` as the
visual reference. The desired style uses clear composition zones, concise
headlines, fixed lower-third narration captions, and typography changes based on
the role of each beat.

The current scene renderer now:

- derives the available text region from the actual stock-image rectangle
- places image and text in separate columns with a fixed safety gutter
- forces image-bearing center/floating scenes into a stable split composition
- wraps long titles and reduces font size until they fit their safe region
- prevents callout cards and icons from competing with an image for the same area
- suppresses persistent subtitles when speech-timed captions are available
- displays each spoken phrase only while that phrase is being narrated
- wraps captions to at most two lines in one highlighted lower-third panel
- uses one panel behind the complete caption instead of one box per text line

`server/planner.js` builds `spoken_captions` from transcript word timestamps and
attaches them to planned scenes, including cached plans. When timestamps are
estimated because STT quota is unavailable, the captions inherit that approximate
alignment.

Typography roles are defined in `server/design.js`:

- Anton for bold/statistical emphasis
- Luckiest Guy for playful visual metaphors and callouts
- Permanent Marker for handwritten beat labels and summaries
- Space Grotesk for general scene titles and body composition
- Inter Bold for narration captions

The portable font files and their licenses are stored under `assets/fonts/`.
The MP4 encoder uses H.264 High profile, CRF 18, the medium preset, animation
tuning, `yuv420p`, and 30 fps.

Verification:

- A long image-bearing callout was rendered as
  `jobs/_collision_check/scene_000.mp4`.
- The title wrapped entirely inside the left text column.
- The image remained unobstructed in the right visual column.
- A long spoken caption wrapped into one centered highlighted panel.
- The verified clip is 1920x1080, H.264 High, `yuv420p`, 30 fps, and 4.00 seconds.
- `node --check server/scenes/index.js` and `git diff --check` passed.

### P1 - Gemini planning quota can bypass V10

The same quota pressure can block all planner models. When that happens, V10 is
not executed and the local heuristic planner is used. The heuristic fallback now
creates topic-specific icons, structured process/summary data, varied layouts,
and avoids fake zero-value stat scenes, but it cannot match full Gemini direction.

### P2 - TTS settings are partly hardcoded

The TTS model and voice are hardcoded in `server/config.js`; `ttsRate` exists but
is unused. Expose model/voice through environment variables and remove or
implement rate control.

### P2 - No automated tests

There is no test script or test suite. High-value first tests:

- PCM-to-WAV header and duration
- timestamp unit normalization and duration bounds
- estimated timestamps end exactly at `durationMs`
- planner scene timing continuity
- representative FFmpeg graph smoke test for every scene type
- pipeline failure/degraded-state behavior

### P2 - Documentation drift and encoding damage

Several docs/log strings contain mojibake such as `â†’` and `ΓÇª`. README and docs
also describe an older one-stage planner and the old TTS behavior in places.
Normalize files to UTF-8 and update docs after renderer stabilization.

## Current Worktree Notes

The repository contains substantial uncommitted changes across the frontend,
planner, renderer, design system, and TTS. These changes predated this context
update and must not be reverted casually.

Files changed during the TTS and visual-render investigation:

- `.gitignore`
- `server/tts.js`
- `server/render.js`
- `server/assets.js`
- `server/design.js`
- `server/planner.js`
- `server/scenes/base.js`
- `server/scenes/index.js`
- `server/planning/direct.js`
- `assets/fonts/`
- `context.md`

Runtime logs currently present:

- `server.log`
- `server.err`

## Recommended Work Order

1. Run a complete video job with several image-bearing scene types.
2. Review title/image separation and caption timing in the final muxed MP4.
3. Confirm narration duration and final MP4 duration remain close.
4. Make fallback/degraded rendering visible in job status.
5. Persist completed job metadata and refresh the remaining docs.

## Useful Commands

```powershell
npm start
```

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/generate `
  -ContentType application/json `
  -Body (@{ script = "Short verification script." } | ConvertTo-Json)
```

```powershell
.\node_modules\ffmpeg-static\ffmpeg.exe -hide_banner -i .\jobs\<jobId>\audio.wav
```

```powershell
Get-Content .\server.log -Tail 250
```

## External Reference

- Gemini TTS speech generation:
  https://ai.google.dev/gemini-api/docs/speech-generation
