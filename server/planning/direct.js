import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { pickIconForQuery } from '../lucide.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const VALID_LAYOUTS = ['center', 'left', 'right', 'top', 'bottom', 'split', 'floating', 'grid'];
const VALID_SCENE_TYPES = [
  'hero', 'definition', 'callout', 'stat', 'process', 'timeline', 'comparison', 'summary',
  'visual_metaphor', 'network', 'data_flow', 'diagram', 'relationship',
];
const VALID_MOTIONS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'static'];
const VALID_TRANSITIONS = ['cut', 'fade', 'zoom_in', 'zoom_out', 'sweep_left', 'sweep_right', 'flash'];
const VALID_DECORATIVE = ['floating_circles', 'blobs', 'dots', 'lines', 'grid', 'pulse', 'particles', 'sweep', 'light_ray'];

const SCENE_TYPE_FOR_ROLE = {
  hook: ['hero', 'visual_metaphor'],
  definition: ['definition', 'callout', 'visual_metaphor'],
  process: ['process', 'data_flow', 'diagram'],
  scale: ['stat', 'callout', 'visual_metaphor'],
  surprise: ['callout', 'visual_metaphor', 'comparison'],
  consequence: ['callout', 'comparison', 'visual_metaphor'],
  summary: ['summary'],
};

const SYSTEM_PROMPT = `You are the VIDEOGEN MASTER VISUAL DIRECTOR.

You are NOT a video generator.
You are an Emmy-level Visual Director, Motion Graphics Designer, Storyboard Artist, and YouTube Retention Expert.

Your job is to transform narration into a visually stunning educational experience.
The output must feel like Apple Keynote, Kurzgesagt, Veritasium, MagnatesMedia, Fireship, Vox, or TED-Ed.

Never create slideshows.
Never create one image per sentence.
Never place text over a static image and call it a scene.

PRIMARY GOAL
Create wow moments.

Every scene must answer:
1. What should the viewer focus on?
2. Why is it important?
3. What motion explains it?
4. What visual metaphor improves understanding?

SCENE SELECTION ENGINE
Choose the most cinematic option from hero, definition, process, comparison, timeline, stat, callout, summary, visual_metaphor, network, data_flow, diagram, or relationship.

VISUAL STORYTELLING RULES
Think visually, not literally.
Use metaphors like power plant, energy factory, central control center, connected global network, conveyor belt, data river, or living diagram.

MULTI-ASSET SCENES
Every scene must combine a background, primary visual, supporting icons, lines or
shapes, animated text, and at least one focus highlight. A single image with text
is invalid and must be redesigned before output.

LAYOUT ENGINE
Use centered hero, split screen, floating card, grid layout, left visual right text, right visual left text, top header, or bottom callout.
Never repeat the same layout twice in a row.

MOTION ENGINE
Every scene must contain 3-5 motion events in the form "X.Xs: action".
Use zoom, highlight, glow, arrow movement, line draw, particle burst, scale pop, icon pulse, or camera pan.
Add a new motion, object, camera move, or highlight at least every 2 seconds.
The viewer must never stare at an unchanged composition for more than 3 seconds.

TEXT DESIGN
Use short punchy titles, compact subtitles, and kinetic emphasis words.
Important keywords should be larger, colored, and glowing.

COLOR PSYCHOLOGY
Energy: orange/yellow. Technology: blue/cyan. Science: purple/blue. Danger: red/orange. Success: green.

OUTPUT RULES
Return ONLY valid JSON.
Every scene_direction must include scene_type, visual_goal, layout_type, primary_asset, secondary_assets, icons, text_blocks, animations, colors, emphasis_keywords, camera_motion, transition_style, decorative_elements, color_hint, and mood.
If a scene resembles a PowerPoint slide, reject it and redesign it before returning JSON.

Schema:
{
  "visual_metaphors": [
    { "concept": "...", "metaphor": "...", "visual_assets": ["..."], "icon_hint": "PascalCase" }
  ],
  "color_story": { "<beat_index>": "color phrase", ... },
  "scene_directions": [
    {
      "intent_ref": 0,
      "scene_type": "hero",
      "visual_goal": "1-2 sentence visual goal",
      "layout_type": "center",
      "primary_asset": "short phrase",
      "secondary_assets": ["short phrase", "..."],
      "icons": ["PascalCase", "..."],
      "text_blocks": [
        { "role": "title", "text": "...", "emphasis_words": ["..."] }
      ],
      "animations": ["0.0s: title scale-pop in", "1.0s: glow pulse"],
      "colors": ["#RRGGBB", "#RRGGBB"],
      "emphasis_keywords": ["..."],
      "camera_motion": "zoom_in",
      "transition_style": "fade",
      "decorative_elements": ["floating_circles", "particles"],
      "color_hint": "#RRGGBB",
      "mood": "cinematic"
    }
  ]
}`;

function clampString(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function clampArray(v, max = 10) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max);
}

function clampIn(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function safeHex(v, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function validateDirection(d, palette, beat, idx) {
  if (!d || typeof d !== 'object') return null;
  const allowedForRole = SCENE_TYPE_FOR_ROLE[beat.beat_role] || SCENE_TYPE_FOR_ROLE.definition;
  const sceneType = clampIn(d.scene_type, VALID_SCENE_TYPES, null);
  const finalSceneType = allowedForRole.includes(sceneType) ? sceneType : allowedForRole[0];

  const layout = clampIn(d.layout_type ?? d.layout, VALID_LAYOUTS, 'center');
  const camera = clampIn(d.camera_motion, VALID_MOTIONS, 'static');
  const transition = clampIn(d.transition_style, VALID_TRANSITIONS, 'cut');
  const decorative = clampArray(d.decorative_elements)
    .filter(x => VALID_DECORATIVE.includes(x))
    .slice(0, 5);
  if (!decorative.length) {
    decorative.push('floating_circles', 'dots');
  }

  const textBlocks = clampArray(d.text_blocks, 5).map(tb => ({
    role: clampIn(tb?.role, ['title', 'subtitle', 'caption', 'label', 'callout'], 'caption'),
    text: clampString(tb?.text, 120),
    emphasis_words: clampArray(tb?.emphasis_words, 6).map(w => clampString(w, 30)),
  })).filter(tb => tb.text);

  if (!textBlocks.length) {
    textBlocks.push({
      role: beat.beat_role === 'summary' ? 'title' : 'caption',
      text: beat.speaker_cue || beat.intent || '',
      emphasis_words: [],
    });
  }

  const motion = clampArray(d.animations ?? d.motion_choreography, 8)
    .map(m => clampString(m, 120))
    .filter(m => /\d+(\.\d+)?s:/.test(m));
  if (motion.length < 2) {
    motion.push('0.0s: title reveal');
    motion.push('1.5s: accent glow pulse');
    if (beat.beat_role !== 'summary') motion.push('3.0s: light sweep');
  }

  const iconHints = clampArray(d.icons ?? d.icon_hints, 4)
    .map(s => clampString(s, 30).replace(/[^A-Za-z0-9]/g, ''))
    .filter(s => /^[A-Z]/.test(s));
  if (!iconHints.length) {
    iconHints.push('Sparkles');
  }

  const colors = clampArray(d.colors, 4).map(c => safeHex(c, '')).filter(Boolean);
  const emphasisKeywords = clampArray(d.emphasis_keywords, 8).map(w => clampString(w, 30)).filter(Boolean);
  const secondaryAssets = clampArray(d.secondary_assets, 4).map(s => clampString(s, 40));

  return {
    intent_ref: beat.index ?? idx,
    beat_role: beat.beat_role,
    scene_type: finalSceneType,
    visual_goal: clampString(d.visual_goal, 200) || beat.intent,
    layout,
    primary_asset: clampString(d.primary_asset, 60) || (textBlocks.find(tb => tb.role === 'title')?.text || beat.intent || 'main visual element'),
    secondary_assets: secondaryAssets,
    icon_hints: iconHints,
    icons: iconHints,
    text_blocks: textBlocks,
    motion_choreography: motion.slice(0, 6),
    animations: motion.slice(0, 6),
    camera_motion: camera,
    transition_style: transition,
    decorative_elements: decorative,
    color_hint: safeHex(d.color_hint, palette.primary),
    colors: colors.length ? colors : [palette.primary, palette.secondary, palette.tertiary],
    emphasis_keywords: emphasisKeywords,
    mood: clampString(d.mood, 40) || 'engaging',
  };
}

function heuristicDirection(beat, idx, palette) {
  const allowedTypes = SCENE_TYPE_FOR_ROLE[beat.beat_role] || ['definition'];
  const hasNumber = /\d/.test(beat.speaker_cue || '');
  const sceneType = beat.beat_role === 'scale' && !hasNumber ? 'visual_metaphor' : allowedTypes[0];
  const layouts = VALID_LAYOUTS.filter(l => l !== 'center');
  const layout = layouts[idx % layouts.length];
  const cameras = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'static'];
  const camera = cameras[idx % cameras.length];
  const transitions = ['fade', 'sweep_left', 'sweep_right', 'zoom_in', 'flash'];
  const transition = transitions[idx % transitions.length];
  const cue = beat.speaker_cue || beat.intent || '';
  const icon = pickIconForQuery(cue) || pickIconForQuery(beat.intent) || 'Sparkles';
  const roleAssets = {
    hook: ['hero symbol', 'radial energy field'],
    definition: ['focus object', 'callout lines'],
    process: ['input node', 'transformation path', 'output node'],
    scale: ['repeating particles', 'depth grid'],
    surprise: ['contrast object', 'highlight burst'],
    consequence: ['warning state', 'fading energy'],
    summary: ['three takeaway cards', 'completion markers'],
  };
  return {
    intent_ref: beat.index ?? idx,
    beat_role: beat.beat_role,
    scene_type: sceneType,
    visual_goal: `${beat.intent || beat.beat_role}: visualize "${cue.slice(0, 80)}"`,
    layout,
    primary_asset: cue.split(/\s+/).slice(0, 6).join(' ') || 'main visual element',
    secondary_assets: roleAssets[beat.beat_role] || ['supporting diagram', 'accent shapes'],
    icon_hints: [icon],
    icons: [icon],
    text_blocks: [
      {
        role: beat.beat_role === 'summary' ? 'title' : 'caption',
        text: beat.speaker_cue || beat.intent || '',
        emphasis_words: [],
      },
    ],
    motion_choreography: ['0.0s: title reveal', '1.5s: accent glow pulse', '3.0s: light sweep'],
    animations: ['0.0s: title reveal', '1.5s: accent glow pulse', '3.0s: light sweep'],
    camera_motion: camera,
    transition_style: transition,
    decorative_elements: ['floating_circles', 'dots'],
    color_hint: palette.primary,
    colors: [palette.primary, palette.secondary, palette.tertiary],
    emphasis_keywords: [],
    mood: beat.beat_role,
  };
}

function diversifyLayouts(directions) {
  const alternatives = ['left', 'right', 'split', 'floating', 'grid', 'top', 'bottom', 'center'];
  for (let i = 1; i < directions.length; i++) {
    if (directions[i].layout !== directions[i - 1].layout) continue;
    directions[i].layout = alternatives.find(layout =>
      layout !== directions[i - 1].layout &&
      layout !== directions[i + 1]?.layout
    ) || 'split';
  }
  return directions;
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

export async function directScenes({ content }) {
  const beats = content.story_beats || [];
  const palette = content.palette || {
    primary: '#3B82F6', secondary: '#8B5CF6', tertiary: '#06B6D4', glow: '#3B82F6',
  };

  const MODEL_CHAIN = [
    config.gemini.plannerModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const userMsg = JSON.stringify({
    task: 'Design one visual scene direction for each story beat in the content plan. Be specific, be visual, never make a slideshow.',
    content_plan: {
      topic: content.topic,
      subtopic: content.subtopic,
      audience: content.audience,
      tone: content.tone,
      narrative_arc: content.narrative_arc,
      concepts: content.concepts,
      key_takeaways: content.key_takeaways,
      story_beats: beats,
    },
    palette: {
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      accent4: palette.accent4,
      accent5: palette.accent5,
    },
  }, null, 2);

  let direction = null;
  for (const modelName of MODEL_CHAIN) {
    if (direction) break;
    for (let attempt = 0; attempt < 2 && !direction; attempt++) {
      try {
        const m = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85,
            maxOutputTokens: 8192,
          },
          systemInstruction: SYSTEM_PROMPT,
        });
        const result = await m.generateContent(userMsg);
        const text = result.response.text();
        const parsed = tryParseJson(text);
        if (parsed && Array.isArray(parsed.scene_directions)) {
          const directions = diversifyLayouts(parsed.scene_directions
            .map((d, i) => validateDirection(d, palette, beats[i] || beats[0], i))
            .filter(Boolean));
          if (directions.length === beats.length) {
            const visualMetaphors = Array.isArray(parsed.visual_metaphors)
              ? parsed.visual_metaphors.slice(0, 4).map(m => ({
                  concept: clampString(m?.concept, 40),
                  metaphor: clampString(m?.metaphor, 60),
                  visual_assets: clampArray(m?.visual_assets, 4).map(s => clampString(s, 40)),
                  icon_hint: clampString(m?.icon_hint, 30).replace(/[^A-Za-z0-9]/g, ''),
                })).filter(m => m.concept)
              : [];
            const colorStory = (parsed.color_story && typeof parsed.color_story === 'object') ? parsed.color_story : {};
            direction = {
              source: 'gemini',
              model: modelName,
              visual_metaphors: visualMetaphors,
              color_story: colorStory,
              scene_directions: directions,
            };
            console.log(`[direct] ok on model=${modelName} attempt=${attempt + 1} (${directions.length} directions)`);
            break;
          } else {
            console.warn(`[direct] model=${modelName} attempt=${attempt + 1}: direction count mismatch (got ${directions.length}, need ${beats.length})`);
          }
        }
      } catch (err) {
        const msg = err?.message || String(err);
        const isOverload = msg.includes('503') || msg.includes('high demand') || msg.includes('429');
        console.warn(`[direct] model=${modelName} attempt=${attempt + 1} failed: ${msg.slice(0, 120)}`);
        if (isOverload) {
          const backoff = 1500 * (attempt + 1);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
  }

  if (!direction) {
    console.warn('[direct] falling back to heuristic scene directions');
    direction = {
      source: 'heuristic',
      visual_metaphors: [],
      color_story: {},
      scene_directions: beats.map((b, i) => heuristicDirection(b, i, palette)),
    };
  }

  return direction;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const inPath = new URL('./content.json', import.meta.url);
  const outPath = new URL('./storyboard.json', import.meta.url);
  const content = JSON.parse(readFileSync(inPath, 'utf8'));
  const t0 = Date.now();
  const result = await directScenes({ content });
  const dt = Date.now() - t0;
  console.log(`\n[direct] completed in ${dt}ms (source=${result.source})`);
  console.log(`[direct] ${result.scene_directions.length} scene directions, ${result.visual_metaphors.length} visual metaphors\n`);
  console.log(JSON.stringify(result, null, 2));
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n[direct] wrote ${outPath.pathname}`);
}
