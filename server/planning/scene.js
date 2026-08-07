import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { paletteFor } from '../design.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const VALID_SCENE_TYPES = [
  'hero', 'definition', 'callout', 'stat', 'process', 'timeline', 'comparison', 'summary',
  'visual_metaphor', 'network', 'data_flow', 'diagram', 'relationship',
  'concept', 'code', 'architecture', 'formula', 'prediction', 'cinematic',
];

const VALID_ANIMS = [
  'scalePop', 'wordByWord', 'fadeUp', 'fadeDown', 'slideLeft', 'slideRight',
  'kineticTypography', 'highlightSweep', 'bouncePop', 'blurReveal', 'typewriter',
];

const VALID_LAYOUTS = ['center', 'left', 'right', 'top', 'bottom', 'split', 'floating', 'grid'];
const PROCESS_SCENE_TYPES = new Set(['process', 'network', 'data_flow', 'diagram']);
const PRESENTER_POSITIONS = ['left', 'right'];
const PRESENTER_EMOTIONS = ['calm', 'concerned', 'reassuring', 'confident', 'hopeful', 'excited', 'serious'];
const PRESENTER_GESTURES = ['explain', 'point', 'reassure', 'alert', 'celebrate', 'think', 'walk'];

const SYSTEM_PROMPT = `You are a Scene Planner translating Visual Direction into a concrete renderable scene spec. Each scene you produce will be passed directly to an FFmpeg-based renderer — your output must be COMPLETE, premium, and RENDERABLE.

You receive:
- A storyboard (visual direction for each scene)
- A content plan (concepts, beats, takeaways)
- A topic palette

For each scene_direction in the storyboard, output ONE scene spec.

RULES

1. SCENE_TYPE — use the scene_type from the storyboard unchanged. Do not invent new types. The renderer knows all of: hero, definition, callout, stat, process, timeline, comparison, summary, visual_metaphor, network, data_flow, diagram, relationship, concept, code, architecture, formula, prediction.

2. LAYOUT — use the layout_type/layout from the storyboard unchanged. Allowed: center, left, right, top, bottom, split, floating, grid.

3. TIMING — copy start_ms and end_ms from the corresponding story_beat. If a beat is missing timing, distribute evenly across total_ms.

4. TITLE — short, punchy, 3-7 words. Often an "emphasis" word from the beat. Use ALL CAPS. Examples: "POWERHOUSES OF THE CELL", "ENERGY CONVERSION", "BILLIONS PER SECOND".

5. SUBTITLE — optional, 5-15 words. Plain language explanation. Use sentence case.

6. HIGHLIGHT_WORDS — pick 1-4 short words from title/subtitle that should glow in the kinetic typography. These will be rendered larger and brighter.

7. ANIMATION — pick the best text animation for the beat:
   - "hero"     → "kineticTypography" or "scalePop"
   - "definition" → "wordByWord" or "kineticTypography"
   - "callout"  → "scalePop" or "kineticTypography"
   - "stat"     → "scalePop"
   - "process"  → "fadeUp"
   - "summary"  → "wordByWord"
   - "visual_metaphor" → "kineticTypography"
   - "network"  → "fadeUp"
   - "data_flow" → "fadeUp"
   - "diagram"  → "fadeUp"
   - "relationship" → "scalePop"

8. ICON — pick exactly one primary Lucide icon (PascalCase) for the scene. Use the storyboard's icons[0] or icon_hints[0] as the starting point, or pick a more concrete icon. Examples: "Cpu", "Battery", "Zap", "Factory", "Dna", "Atom", "Leaf", "Globe", "FlaskConical", "Network", "HeartPulse".

9. COLOR — for hero/definition/callout/visual_metaphor: pick accent_color from the storyboard's color_hint. For process/data_flow/diagram: use the second palette color. For stat: use the third palette color. For summary: use the first palette color. accent_color_2 should be a contrasting color from the palette. accent_color_3 should be a third distinct color.

10. DECORATIVE — copy decorative_elements from the storyboard. Allowed: floating_circles, blobs, dots, lines, grid, pulse, particles, sweep, light_ray. Pick 2-4.

11. NEW FIELDS — copy these from the storyboard to every scene:
   - "primary_asset"     (string)
   - "secondary_assets"  (array of 1-3 short strings)
   - "icon_hints"        (array of 1-4 PascalCase strings)
   - "visual_goal"       (string)
   - "motion_choreography" (array of strings, each "X.Xs: ...")
   - "camera_motion"     (zoom_in | zoom_out | pan_left | pan_right | pan_up | pan_down | static)
   - "transition_style"  (cut | fade | zoom_in | zoom_out | sweep_left | sweep_right | flash)
   - "mood"              (string)
   - "beat_role"         (string from the content plan)
  - "emphasis_keywords" (array of short strings)
  - "colors"            (array of 2-4 hex colors)

12. TYPE-SPECIFIC FIELDS:
   - "stat"     → must have "value" (the number as a string, e.g. "9×10²⁰") and "label" (short caption)
   - "process"  → must have "steps" (array of 2-4 objects: { label, icon })
   - "timeline" → must have "milestones" (array of 2-5 objects: { label, year })
   - "comparison" → must have "left" and "right" (objects: { title, points[], icon, color })
   - "summary"  → must have "takeaways" (array of exactly 3 objects: { text, icon }) pulled from content.key_takeaways
   - "concept"  → must have "concept_items" (2-5 progressive representations)
   - "code" → must have "code_lines" (2-8 essential lines, no editor chrome)
   - "architecture" → must have "layers" (3-6 concise layer names)
   - "formula" → must have "formula" (one compact plain-text formula)
   - "prediction" → must have "flow_steps" (3-6 labels from input to prediction)

13. NO POWERPOINT TEXT — the title is the largest type on screen. The subtitle is small. Do not produce paragraphs. Do not produce bullet points in title.

14. COMPLETE — every scene must have all required fields. The renderer cannot fill in blanks.

OUTPUT

Return ONLY a valid JSON array. No markdown, no commentary, no explanation. The array length MUST equal the number of scene_directions in the storyboard.

Schema per scene:
{
  "scene_type": "...",
  "start_ms": 0,
  "end_ms": 4000,
  "layout": "center",
  "title": "SHORT TITLE",
  "subtitle": "optional plain-language sentence",
  "highlight_words": ["Word1", "Word2"],
  "animation": "kineticTypography",
  "accent_color": "#RRGGBB",
  "accent_color_2": "#RRGGBB",
  "accent_color_3": "#RRGGBB",
  "text_color": "#FFFFFF",
  "decorative_color": "#RRGGBB",
  "decorative": ["..."],
  "lucide_icon_name": "PascalCase",
  "visual_goal": "...",
  "primary_asset": "...",
  "secondary_assets": ["..."],
  "icon_hints": ["..."],
  "motion_choreography": ["..."],
  "camera_motion": "zoom_in",
  "transition_style": "fade",
  "mood": "...",
  "beat_role": "...",
  "teaching_stage": "...",
  "emphasis_keywords": ["..."],
  "colors": ["#RRGGBB", "#RRGGBB"],
  "value": "...",
  "label": "...",
  "steps": [],
  "milestones": [],
  "left": {},
  "right": {},
  "takeaways": [],
  "concept_items": [],
  "code_lines": [],
  "layers": [],
  "formula": "",
  "flow_steps": []
}`;

function safeStr(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeHex(v, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function clampIn(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function presenterForScene(s, sceneType, layout, beatRole) {
  const raw = s.presenter && typeof s.presenter === 'object' ? s.presenter : {};
  const enabled = raw.enabled !== false;
  const defaultPosition = layout === 'right' ? 'left' : 'right';
  const role = String(beatRole || '').toLowerCase();
  const mood = String(s.mood || '').toLowerCase();
  const emotion =
    role === 'hook' || mood.includes('risk') || mood.includes('warning') ? 'concerned' :
    role === 'summary' ? 'hopeful' :
    role === 'consequence' ? 'serious' :
    mood.includes('surprise') ? 'excited' :
    'reassuring';
  const gesture =
    role === 'hook' ? 'alert' :
    role === 'summary' ? 'celebrate' :
    PROCESS_SCENE_TYPES.has(sceneType) ? 'point' :
    sceneType === 'timeline' ? 'walk' :
    sceneType === 'formula' || sceneType === 'code' || sceneType === 'architecture' ? 'explain' :
    'reassure';
  const fallbackSpeech = safeStr(s.subtitle || s.title || 'Let me explain', 54);
  return {
    enabled,
    style: 'stickman',
    position: clampIn(raw.position, PRESENTER_POSITIONS, defaultPosition),
    emotion: clampIn(raw.emotion, PRESENTER_EMOTIONS, emotion),
    gesture: clampIn(raw.gesture, PRESENTER_GESTURES, gesture),
    speech: safeStr(raw.speech, 54) || fallbackSpeech,
  };
}

function validateScene(s, beat, idx, palette, totalMs, content) {
  if (!s || typeof s !== 'object') return null;
  const sceneType = clampIn(s.scene_type, VALID_SCENE_TYPES, null);
  if (!sceneType) return null;
  const layout = clampIn(s.layout || s.layout_type, VALID_LAYOUTS, beat?.layout || 'center');
  const animation = clampIn(s.animation, VALID_ANIMS, 'kineticTypography');
  const accent = safeHex(s.accent_color, palette.primary);
  const accent2 = safeHex(s.accent_color_2, palette.secondary);
  const accent3 = safeHex(s.accent_color_3, palette.tertiary);
  const textColor = safeHex(s.text_color, '#FFFFFF');
  const decColor = safeHex(s.decorative_color, accent);

  const validDecorative = ['floating_circles', 'blobs', 'dots', 'lines', 'grid', 'pulse', 'particles', 'sweep', 'light_ray'];
  const decorative = safeArray(s.decorative)
    .filter(x => validDecorative.includes(x))
    .slice(0, 6);
  if (!decorative.length) decorative.push('floating_circles', 'dots');

  const highlightWords = safeArray(s.highlight_words).map(w => safeStr(w, 20)).slice(0, 5);

  const out = {
    id: `scene_${String(idx + 1).padStart(2, '0')}`,
    scene_type: sceneType,
    start_ms: Math.max(0, parseInt(s.start_ms, 10) || (beat?.start_ms ?? 0)),
    end_ms: Math.max(0, parseInt(s.end_ms, 10) || (beat?.end_ms ?? 0)),
    layout,
    title: safeStr(s.title, 80),
    subtitle: safeStr(s.subtitle, 160),
    highlight_words: highlightWords,
    animation,
    accent_color: accent,
    accent_color_2: accent2,
    accent_color_3: accent3,
    text_color: textColor,
    decorative_color: decColor,
    decorative,
    lucide_icon_name: safeStr(s.lucide_icon_name, 40) || safeStr(s.icons?.[0], 40) || safeStr(s.icon_hints?.[0], 40) || 'Sparkles',
    primary_asset: safeStr(s.primary_asset, 60),
    secondary_assets: safeArray(s.secondary_assets).map(x => safeStr(x, 40)).slice(0, 4),
    icon_hints: safeArray(s.icon_hints).map(x => safeStr(x, 30)).slice(0, 4),
    visual_goal: safeStr(s.visual_goal, 200),
    motion_choreography: safeArray(s.motion_choreography).map(x => safeStr(x, 80)).slice(0, 8),
    camera_motion: clampIn(s.camera_motion, ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'static'], 'static'),
    transition_style: clampIn(s.transition_style, ['cut', 'fade', 'zoom_in', 'zoom_out', 'sweep_left', 'sweep_right', 'flash'], 'cut'),
    mood: safeStr(s.mood, 40),
    beat_role: safeStr(s.beat_role, 20) || (beat?.beat_role || ''),
    teaching_stage: safeStr(s.teaching_stage, 20) || (beat?.teaching_stage || ''),
    emphasis_keywords: safeArray(s.emphasis_keywords).map(x => safeStr(x, 30)).slice(0, 6),
    colors: safeArray(s.colors).map(x => safeHex(x, palette.primary)).slice(0, 4),
  };

  out.presenter = presenterForScene(s, sceneType, layout, out.beat_role);
  if (sceneType === 'cinematic') {
    const rawCinematic = s.cinematic && typeof s.cinematic === 'object' ? s.cinematic : {};
    out.cinematic = {
      setting: safeStr(rawCinematic.setting || s.primary_asset, 80),
      shot: safeStr(rawCinematic.shot || 'wide cinematic shot', 80),
      action: safeStr(rawCinematic.action || s.visual_goal || s.subtitle, 120),
      emotion: safeStr(rawCinematic.emotion || s.mood || 'calm tension', 40),
      lighting: safeStr(rawCinematic.lighting || 'soft cinematic light', 60),
    };
    out.characters = safeArray(s.characters).map(x => safeStr(x, 40)).filter(Boolean).slice(0, 5);
    out.ui_elements = safeArray(s.ui_elements).map(x => safeStr(x, 40)).filter(Boolean).slice(0, 6);
  }

  if (!out.title && Array.isArray(s.text_blocks)) {
    const titleBlock = s.text_blocks.find(tb => tb && tb.role === 'title');
    if (titleBlock?.text) out.title = safeStr(titleBlock.text, 80);
    const subtitleBlock = s.text_blocks.find(tb => tb && (tb.role === 'subtitle' || tb.role === 'caption' || tb.role === 'callout'));
    if (subtitleBlock?.text) out.subtitle = safeStr(subtitleBlock.text, 160);
    const emph = s.text_blocks.flatMap(tb => safeArray(tb?.emphasis_words || tb?.emphasis_keywords));
    if (!out.highlight_words.length && emph.length) out.highlight_words = emph.map(x => safeStr(x, 20)).slice(0, 6);
  }

  if (sceneType === 'stat') {
    out.value = safeStr(s.value, 20) || '0';
    out.label = safeStr(s.label, 80);
  }
  if (PROCESS_SCENE_TYPES.has(sceneType)) {
    out.steps = safeArray(s.steps).slice(0, 4).map(st => ({
      label: safeStr(typeof st === 'object' ? st?.label : st, 20),
      icon: typeof st === 'object' && st?.icon ? safeStr(st.icon, 30) : null,
    })).filter(st => st.label);
    if (out.steps.length < 2) {
      out.steps = [
        { label: 'Source', icon: 'CircleDot' },
        { label: 'Transform', icon: 'RefreshCw' },
        { label: 'Result', icon: 'CheckCircle' },
      ];
    }
  }
  if (sceneType === 'timeline') {
    out.milestones = safeArray(s.milestones).slice(0, 5).map(m => ({
      label: safeStr(typeof m === 'object' ? m?.label : m, 20),
      year: safeStr(typeof m === 'object' ? m?.year : '', 12),
    })).filter(m => m.label);
    if (out.milestones.length < 2) {
      out.milestones = [
        { label: 'Beginning', year: '' },
        { label: 'Development', year: '' },
        { label: 'Current state', year: 'Now' },
      ];
    }
  }
  if (sceneType === 'comparison') {
    const left = (s.left && typeof s.left === 'object') ? s.left : {};
    const right = (s.right && typeof s.right === 'object') ? s.right : {};
    out.left = {
      title: safeStr(left.title, 20) || 'Before',
      points: safeArray(left.points).map(p => safeStr(p, 40)).slice(0, 4),
      icon: left.icon ? safeStr(left.icon, 30) : null,
      color: safeHex(left.color, '#EF4444'),
    };
    out.right = {
      title: safeStr(right.title, 20) || 'After',
      points: safeArray(right.points).map(p => safeStr(p, 40)).slice(0, 4),
      icon: right.icon ? safeStr(right.icon, 30) : null,
      color: safeHex(right.color, '#10B981'),
    };
  }
  if (sceneType === 'summary') {
    const kts = content?.key_takeaways || [];
    out.takeaways = kts.slice(0, 3).map((text, i) => {
      const t = (text && typeof text === 'object') ? text : { text, icon: null };
      return {
        text: safeStr(t.text, 80) || `Key point ${i + 1}`,
        icon: t.icon ? safeStr(t.icon, 30) : null,
      };
    });
    if (out.takeaways.length === 0) {
      out.takeaways = [{ text: 'Key insight', icon: null }];
    }
  }
  if (sceneType === 'concept') {
    out.concept_items = safeArray(s.concept_items)
      .map(item => safeStr(typeof item === 'object' ? item?.label : item, 60))
      .filter(Boolean)
      .slice(0, 5);
    if (out.concept_items.length < 2) {
      out.concept_items = [out.title || 'Core idea', out.subtitle || 'How it works'];
    }
  }
  if (sceneType === 'code') {
    out.code_lines = safeArray(s.code_lines).map(line => safeStr(line, 100)).filter(Boolean).slice(0, 8);
    if (!out.code_lines.length) out.code_lines = [`# ${out.title || 'Example'}`, out.subtitle || 'result = process(input)'];
  }
  if (sceneType === 'architecture') {
    out.layers = safeArray(s.layers)
      .map(layer => safeStr(typeof layer === 'object' ? layer?.label : layer, 40))
      .filter(Boolean)
      .slice(0, 6);
    if (out.layers.length < 2) out.layers = ['Source', 'Core system', 'Interface', 'Result'];
  }
  if (sceneType === 'formula') {
    out.formula = safeStr(s.formula, 120) || out.subtitle || out.title || 'Relationship';
  }
  if (sceneType === 'prediction') {
    out.flow_steps = safeArray(s.flow_steps)
      .map(step => safeStr(typeof step === 'object' ? step?.label : step, 40))
      .filter(Boolean)
      .slice(0, 6);
    if (out.flow_steps.length < 2) out.flow_steps = ['Input', 'Analysis', 'Decision', 'Result'];
  }

  return out;
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

function shortTitle(text, fallback = 'KEY IDEA') {
  const words = String(text || '').replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean);
  return (words.slice(0, 6).join(' ') || fallback).toUpperCase().slice(0, 60);
}

function heuristicScene(beat, direction, idx, palette, content) {
  const d = direction || {};
  const sceneType = d.scene_type || 'definition';
  const titleText = (d.text_blocks?.find(tb => tb.role === 'title')?.text)
    || beat?.speaker_cue
    || (beat?.intent || 'scene')
    .split(' ')
    .slice(0, 5)
    .join(' ');
  const title = shortTitle(titleText, beat?.intent);
  const subtitleText = (d.text_blocks?.find(tb => tb.role === 'subtitle')?.text)
    || (d.text_blocks?.find(tb => tb.role === 'caption')?.text)
    || (beat?.speaker_cue || '')
    .split(' ')
    .slice(0, 12)
    .join(' ');
  const subtitle = subtitleText ? subtitleText.slice(0, 120) : '';
  const highlightWords = (d.text_blocks?.flatMap(tb => tb.emphasis_words || []) || []).slice(0, 4);

  const out = {
    id: `scene_${String(idx + 1).padStart(2, '0')}`,
    scene_type: sceneType,
    start_ms: beat?.start_ms ?? 0,
    end_ms: beat?.end_ms ?? 0,
    layout: d.layout || 'center',
    title,
    subtitle,
    highlight_words: highlightWords,
    animation: 'kineticTypography',
    accent_color: d.color_hint || palette.primary,
    accent_color_2: palette.secondary,
    accent_color_3: palette.tertiary,
    text_color: '#FFFFFF',
    decorative_color: d.color_hint || palette.primary,
    decorative: d.decorative_elements || ['floating_circles', 'dots'],
    lucide_icon_name: (d.icon_hints && d.icon_hints[0]) || 'Sparkles',
    primary_asset: d.primary_asset || '',
    secondary_assets: d.secondary_assets || [],
    icon_hints: d.icon_hints || ['Sparkles'],
    visual_goal: d.visual_goal || beat?.intent || '',
    motion_choreography: d.motion_choreography || ['0.0s: title reveal', '1.5s: glow pulse'],
    camera_motion: d.camera_motion || 'static',
    transition_style: d.transition_style || 'cut',
    mood: d.mood || '',
    beat_role: beat?.beat_role || '',
    teaching_stage: beat?.teaching_stage || d.teaching_stage || '',
  };
  if (sceneType === 'stat') {
    const number = (beat?.speaker_cue || '').match(/\b\d[\d,.]*%?\b/)?.[0];
    out.value = number || '1';
    out.label = number ? shortTitle(beat?.intent, 'KEY STAT') : 'KEY IDEA';
  }
  if (PROCESS_SCENE_TYPES.has(sceneType)) {
    out.steps = d.steps?.length ? d.steps : [
      { label: 'Input', icon: 'CircleDot' },
      { label: 'Transform', icon: 'RefreshCw' },
      { label: 'Output', icon: 'Zap' },
    ];
  }
  if (sceneType === 'timeline') {
    out.milestones = d.milestones?.length >= 2
      ? d.milestones
      : [
          { label: 'Beginning', year: '' },
          { label: 'Development', year: '' },
          { label: 'Current state', year: 'Now' },
        ];
  }
  if (sceneType === 'comparison' || sceneType === 'relationship') {
    out.left = { title: 'Without', points: ['Low output', 'System strain'], icon: 'XCircle', color: '#EF4444' };
    out.right = { title: 'With', points: ['High output', 'System flow'], icon: 'CheckCircle', color: '#10B981' };
  }
  if (sceneType === 'summary') {
    out.takeaways = (content?.key_takeaways || []).slice(0, 3).map((text, i) => ({
      text: safeStr(text, 80) || `Key point ${i + 1}`,
      icon: ['CheckCircle', 'Zap', 'Lightbulb'][i],
    }));
  }
  if (sceneType === 'concept') {
    out.concept_items = d.concept_items?.length
      ? d.concept_items
      : [title || 'Core idea', subtitle || 'How it works'];
  }
  if (sceneType === 'code') {
    out.code_lines = d.code_lines?.length
      ? d.code_lines
      : [`# ${title || 'Example'}`, subtitle || 'result = process(input)'];
  }
  if (sceneType === 'architecture') {
    out.layers = d.layers?.length ? d.layers : ['Source', 'Core system', 'Interface', 'Result'];
  }
  if (sceneType === 'formula') {
    out.formula = d.formula || subtitle || title || 'Relationship';
  }
  if (sceneType === 'prediction') {
    out.flow_steps = d.flow_steps?.length
      ? d.flow_steps
      : ['Input', 'Analysis', 'Decision', 'Result'];
  }
  return out;
}

export async function planSceneSpecs({ content, storyboard }) {
  const beats = content.story_beats || [];
  const directions = storyboard.scene_directions || [];
  const palette = content.palette || paletteFor(content.detected_topic || 'neutral');
  const totalMs = beats.length ? beats[beats.length - 1].end_ms : 20000;

  const MODEL_CHAIN = [
    config.gemini.plannerModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const userMsg = JSON.stringify({
    task: 'Translate each scene direction into a renderable scene spec. Use the storyboard to drive the visual choices.',
    storyboard: {
      visual_metaphors: storyboard.visual_metaphors,
      color_story: storyboard.color_story,
      scene_directions: directions,
    },
    content: {
      topic: content.topic,
      subtopic: content.subtopic,
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
    total_ms: totalMs,
  }, null, 2);

  let scenes = null;
  for (const modelName of MODEL_CHAIN) {
    if (scenes) break;
    for (let attempt = 0; attempt < 2 && !scenes; attempt++) {
      try {
        const m = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
            maxOutputTokens: 8192,
          },
          systemInstruction: SYSTEM_PROMPT,
        });
        const result = await m.generateContent(userMsg);
        const text = result.response.text();
        const parsed = tryParseJson(text);
        if (Array.isArray(parsed)) {
          const validated = parsed.map((s, i) => validateScene(s, beats[i] || beats[0], i, palette, totalMs, content))
            .filter(Boolean);
          if (validated.length === directions.length) {
            scenes = validated;
            console.log(`[scene] ok on model=${modelName} attempt=${attempt + 1} (${validated.length} scenes)`);
            break;
          } else {
            console.warn(`[scene] model=${modelName} attempt=${attempt + 1}: scene count mismatch (got ${validated.length}, need ${directions.length})`);
          }
        }
      } catch (err) {
        const msg = err?.message || String(err);
        const isOverload = msg.includes('503') || msg.includes('high demand') || msg.includes('429');
        console.warn(`[scene] model=${modelName} attempt=${attempt + 1} failed: ${msg.slice(0, 120)}`);
        if (isOverload) {
          const backoff = 1500 * (attempt + 1);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
  }

  if (!scenes) {
    console.warn('[scene] falling back to heuristic scene specs');
    scenes = directions.map((d, i) => heuristicScene(beats[i], d, i, palette, content));
  }

  return scenes;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const contentPath = new URL('./content.json', import.meta.url);
  const storyboardPath = new URL('./storyboard.json', import.meta.url);
  const outPath = new URL('./scenes.json', import.meta.url);
  const content = JSON.parse(readFileSync(contentPath, 'utf8'));
  const storyboard = JSON.parse(readFileSync(storyboardPath, 'utf8'));
  const t0 = Date.now();
  const result = await planSceneSpecs({ content, storyboard });
  const dt = Date.now() - t0;
  console.log(`\n[scene] completed in ${dt}ms (${result.length} scenes)\n`);
  console.log(JSON.stringify(result, null, 2));
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n[scene] wrote ${outPath.pathname}`);
}
