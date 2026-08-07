import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { detectTopic, paletteFor } from '../design.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const SYSTEM_PROMPT = `You are a Content Analyst preparing a script for a premium motion-graphics film. You think like a documentary editor preparing a shot list for a Kurzgesagt or Veritasium episode.

Decompose the user's script into story beats tied to the transcript timestamps. Your output drives the Visual Director, who decides how each beat will LOOK, not just what it will SAY.

RULES

1. BEAT COUNT — produce 7 to 13 story_beats. Use 7-8 beats below 60 seconds, 9-10 beats from 60-100 seconds, and 11-13 beats for longer tutorials. Every beat must earn its place; never pad with empty beats.

2. BEAT TIMING — most beats should be 4000–12000 ms. The HERO and SUMMARY beats can be shorter. A beat never exceeds 15000 ms; if it would, the idea is too big and must be split.

3. BEAT STRUCTURE — every story_beat has:
   - index (integer, 0-based)
   - start_ms and end_ms (integers, contiguous, non-overlapping, cover 0 to total_ms)
   - intent (a short verb-phrase, 3–8 words, describing the VISUAL STORY TURN the beat performs — NOT a content summary)
   - beat_role (one of: "hook", "definition", "process", "scale", "surprise", "consequence", "summary")
   - teaching_stage (one of: "hook", "concept", "visualization", "analogy", "code", "architecture", "training", "formula", "prediction", "summary")
   - speaker_cue (a short phrase the narrator says, ≤ 15 words, pulled or paraphrased from the script)

4. INTENT IS A VISUAL TURN, NOT A SUMMARY. The intent describes the beat's role in the VISUAL story, not what the narrator says. Examples of GOOD intents:
   - "Hook with a striking number"
   - "Reveal the hidden machinery inside"
   - "Build a process diagram"
   - "Zoom into the atomic scale"
   - "Warn the viewer with a consequence"
   - "Close with a single takeaway"

   Examples of BAD intents (rejected):
   - "Introduce mitochondria as the cell's essential energy producers, setting the stage for their critical function" (too long, content summary)
   - "Explain the second concept" (placeholder, no specificity)
   - "Show the title" (generic)

5. BEAT ROLES — the sequence of beat_roles across the film must form a deliberate arc. The arc strings you can choose from:
   - "hook → definition → process → scale → surprise → consequence → summary"
   - "hook → contrast → reveal → process → scale → consequence → summary"
   - "hook → definition → process → surprise → consequence → summary"

   The FIRST beat is always a "hook" beat. The LAST beat is always a "summary" beat. Exactly ONE beat must be "consequence" or "surprise". At most ONE "definition" beat. At most ONE "scale" beat.

6. CONCEPTS — extract 3–5 key concepts. Each concept = { term, definition (1 short sentence, ≤ 15 words), importance (one of: "foundational", "explanatory", "memorable", "surprising") }.

7. KEY TAKEAWAYS — produce exactly 3 key_takeaways the viewer should remember a week later. Each is a single sentence, 8–15 words, written in plain language. The strongest takeaway goes first.

8. AUDIENCE AND TONE — pick audience from: "general public", "students", "professionals", "tech-savvy". Pick tone from: "educational awe", "urgent warning", "calm wonder", "playful curiosity", "serious analysis". Match the script's actual register.

9. NO SLIDESHOWS — do not split the script by sentence. Split by VISUAL TURN. A beat can span 2–4 sentences if they all serve the same visual idea. Conversely, a single long sentence can be its own beat if it carries a key reveal or a number that demands its own moment.

10. NO PLACEHOLDERS — every intent must be specific to THIS script. If you could swap the intent into a different script unchanged, it is rejected.

OUTPUT

Return ONLY a valid JSON object. No markdown, no commentary, no explanation.

Schema:
{
  "topic": "short topic phrase",
  "subtopic": "narrower focus",
  "audience": "one of the 4 above",
  "tone": "one of the 5 above",
  "narrative_arc": "the chosen arc string",
  "concepts": [
    { "term": "...", "definition": "...", "importance": "foundational" | "explanatory" | "memorable" | "surprising" }
  ],
  "story_beats": [
    { "index": 0, "start_ms": 0, "end_ms": 4000, "intent": "short verb phrase", "beat_role": "hook", "teaching_stage": "hook", "speaker_cue": "..." }
  ],
  "key_takeaways": [
    "...",
    "...",
    "..."
  ]
}`;

function safeInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampTopic(s) {
  const allowed = ['general public', 'students', 'professionals', 'tech-savvy'];
  return allowed.includes(s) ? s : 'general public';
}

function clampTone(s) {
  const allowed = ['educational awe', 'urgent warning', 'calm wonder', 'playful curiosity', 'serious analysis'];
  return allowed.includes(s) ? s : 'educational awe';
}

function clampImportance(s) {
  const allowed = ['foundational', 'explanatory', 'memorable', 'surprising'];
  return allowed.includes(s) ? s : 'explanatory';
}

const VALID_BEAT_ROLES = new Set(['hook', 'definition', 'process', 'scale', 'surprise', 'consequence', 'summary']);
const VALID_TEACHING_STAGES = new Set([
  'hook', 'concept', 'visualization', 'analogy', 'code', 'architecture',
  'training', 'formula', 'prediction', 'process', 'contrast', 'timeline',
  'scale', 'evidence', 'consequence', 'summary',
]);
function clampBeatRole(s) {
  return VALID_BEAT_ROLES.has(s) ? s : null;
}

function clampTeachingStage(s, beatRole) {
  if (VALID_TEACHING_STAGES.has(s)) return s;
  const fallback = {
    hook: 'hook',
    definition: 'concept',
    process: 'visualization',
    scale: 'scale',
    surprise: 'evidence',
    consequence: 'consequence',
    summary: 'summary',
  };
  return fallback[beatRole] || 'concept';
}

export function heuristicContent(script, totalMs) {
  const words = script.trim().split(/\s+/).filter(Boolean);
  const wc = words.length;
  const targetBeats = totalMs >= 100000 ? 13 : totalMs >= 60000 ? 10 : 8;
  const sentences = script.split(/(?<=[.!?])\s+/).filter(Boolean);
  const text = script.toLowerCase();
  const hasCode = /\b(code|coding|python|javascript|typescript|java|function|class|api|library|framework|programming)\b/.test(text);
  const hasFormula = /[=+*/^]|\b(equation|formula|calculate|mathematics|physics|probability|percent|percentage|ratio|interest rate)\b/.test(text);
  const hasArchitecture = /\b(system|architecture|network|pipeline|layer|component|infrastructure|workflow|database|server)\b/.test(text);
  const hasPrediction = /\b(predict|predicts|predicted|predicting|prediction|forecast|forecasts|forecasting|classify|classification|inference|model output|diagnosis)\b/.test(text);
  const timelineSignals = text.match(/\b(history|historical|century|centuries|year|years|era|evolved|timeline|first|origin|founded|ancient|empire|republic|later|eventually)\b/g) || [];
  const uniqueTimelineSignals = new Set(timelineSignals);
  const hasExplicitDate = /\b(?:1[0-9]{3}|20[0-9]{2})\b/.test(text);
  const hasTimeline = hasExplicitDate || uniqueTimelineSignals.size >= 3;
  const hasComparison = /\b(versus| vs |compare|difference|before|after|better|worse|unlike)\b/.test(` ${text} `);
  const hasNumbers = /\d/.test(script);

  const fullBeatPlan = [
    { role: 'hook', stage: 'hook', intent: 'Hook with a striking framing' },
    { role: 'definition', stage: 'concept', intent: 'Define the core concept' },
    { role: 'process', stage: hasTimeline ? 'timeline' : 'visualization', intent: hasTimeline ? 'Trace the key progression' : 'Visualize the central mechanism' },
    { role: 'scale', stage: 'analogy', intent: 'Ground the concept with an analogy' },
    { role: 'process', stage: hasComparison ? 'contrast' : 'process', intent: hasComparison ? 'Contrast the competing ideas' : 'Walk through the key process' },
    { role: 'surprise', stage: hasNumbers ? 'evidence' : 'visualization', intent: hasNumbers ? 'Reveal the strongest evidence' : 'Reveal the hidden detail' },
    ...(hasCode ? [{ role: 'process', stage: 'code', intent: 'Translate the idea into code' }] : []),
    ...(hasArchitecture ? [{ role: 'process', stage: 'architecture', intent: 'Map the system architecture' }] : []),
    ...(hasFormula ? [{ role: 'process', stage: 'formula', intent: 'Explain the governing formula' }] : []),
    ...(hasPrediction ? [{ role: 'process', stage: 'prediction', intent: 'Trace the prediction path' }] : []),
    { role: 'consequence', stage: 'consequence', intent: 'Show why the idea matters' },
    { role: 'summary', stage: 'summary', intent: 'Close with the takeaway' },
  ];
  const desired = Math.min(targetBeats, fullBeatPlan.length);
  const priorityStages = new Set(['hook', 'concept', 'code', 'architecture', 'formula', 'prediction', 'consequence', 'summary']);
  const selected = new Set();
  fullBeatPlan.forEach((beat, index) => {
    if (priorityStages.has(beat.stage)) selected.add(index);
  });
  for (let i = 0; selected.size < desired && i < fullBeatPlan.length; i++) selected.add(i);
  const beatPlan = [...selected]
    .sort((a, b) => a - b)
    .slice(0, desired)
    .map(index => fullBeatPlan[index]);
  const arc = beatPlan.map(beat => beat.stage).join(' -> ');
  const perBeat = totalMs / beatPlan.length;
  const beats = beatPlan.map((b, i) => {
    const start = Math.round(i * perBeat);
    const end = Math.round((i + 1) * perBeat);
    const speakerCue = sentences[Math.floor((i / beatPlan.length) * sentences.length)] || '';
    return {
      index: i,
      start_ms: start,
      end_ms: end,
      intent: b.intent,
      beat_role: b.role,
      teaching_stage: b.stage,
      speaker_cue: speakerCue.slice(0, 120),
    };
  });
  const topicWords = words.slice(0, 4).join(' ');
  const concepts = [
    { term: topicWords || 'topic', definition: script.slice(0, 80), importance: 'foundational' },
    { term: 'process', definition: 'the key mechanism described', importance: 'explanatory' },
  ];
  const takeaways = [
    script.split('.')[0]?.trim() || 'Main idea of the script',
    'The mechanism behind the topic',
    'Why this matters in practice',
  ];
  return {
    source: 'heuristic',
    topic: topicWords || 'general topic',
    subtopic: 'main idea',
    audience: 'general public',
    tone: 'educational awe',
    narrative_arc: arc,
    concepts,
    story_beats: beats,
    key_takeaways: takeaways,
  };
}

function validateContent(parsed, totalMs) {
  if (!parsed || typeof parsed !== 'object') return null;
  const out = {
    source: 'gemini',
    topic: typeof parsed.topic === 'string' ? parsed.topic.slice(0, 60) : 'topic',
    subtopic: typeof parsed.subtopic === 'string' ? parsed.subtopic.slice(0, 60) : '',
    audience: clampTopic(parsed.audience),
    tone: clampTone(parsed.tone),
    narrative_arc: typeof parsed.narrative_arc === 'string' ? parsed.narrative_arc.slice(0, 200) : '',
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.slice(0, 6).map(c => ({
          term: typeof c?.term === 'string' ? c.term.slice(0, 40) : '',
          definition: typeof c?.definition === 'string' ? c.definition.slice(0, 120) : '',
          importance: clampImportance(c?.importance),
        })).filter(c => c.term)
      : [],
    story_beats: [],
    key_takeaways: Array.isArray(parsed.key_takeaways)
      ? parsed.key_takeaways.slice(0, 3).map(t => String(t).slice(0, 100)).filter(Boolean)
      : [],
  };

  const rawBeats = Array.isArray(parsed.story_beats) ? parsed.story_beats : [];
  const sorted = rawBeats
    .map(b => ({
      index: safeInt(b?.index, 0),
      start_ms: Math.max(0, safeInt(b?.start_ms, 0)),
      end_ms: Math.max(0, safeInt(b?.end_ms, 0)),
      intent: typeof b?.intent === 'string' ? b.intent.slice(0, 80) : '',
      beat_role: clampBeatRole(b?.beat_role),
      teaching_stage: clampTeachingStage(b?.teaching_stage, b?.beat_role),
      speaker_cue: typeof b?.speaker_cue === 'string' ? b.speaker_cue.slice(0, 200) : '',
    }))
    .filter(b => b.intent && b.beat_role)
    .sort((a, b) => a.start_ms - b.start_ms);

  const beats = sorted.length >= 7 && sorted.length <= 13 ? sorted : null;
  if (!beats) return null;

  if (beats[0].beat_role !== 'hook') return null;
  if (beats[beats.length - 1].beat_role !== 'summary') return null;
  const roleCounts = beats.reduce((m, b) => m.set(b.beat_role, (m.get(b.beat_role) || 0) + 1), new Map());
  if (!roleCounts.has('consequence') && !roleCounts.has('surprise')) return null;
  if ((roleCounts.get('definition') || 0) > 1) return null;
  if ((roleCounts.get('scale') || 0) > 1) return null;

  for (let i = 1; i < beats.length; i++) {
    if (beats[i].start_ms < beats[i - 1].end_ms) {
      beats[i].start_ms = beats[i - 1].end_ms;
    }
  }
  if (beats[0].start_ms > 100) beats[0].start_ms = 0;
  if (beats[beats.length - 1].end_ms < totalMs - 100) {
    beats[beats.length - 1].end_ms = totalMs;
  }
  for (const b of beats) {
    if (b.end_ms <= b.start_ms) b.end_ms = b.start_ms + 1000;
  }
  for (let i = 1; i < beats.length; i++) {
    if (beats[i].start_ms < beats[i - 1].end_ms) {
      beats[i].start_ms = beats[i - 1].end_ms;
    }
  }
  out.story_beats = beats;

  if (!out.key_takeaways.length) return null;
  if (!out.concepts.length) return null;
  if (!out.narrative_arc) out.narrative_arc = 'hook → definition → process → scale → surprise → consequence → summary';

  return out;
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch (_) {}
  }
  return null;
}

export async function understandScript({ script, transcript, totalMs }) {
  const topic = detectTopic(script);
  const palette = paletteFor(topic);
  const safeTotal = Math.max(5000, totalMs || 20000);

  const MODEL_CHAIN = [
    config.gemini.plannerModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const userMsg = JSON.stringify({
    task: 'Decompose this script into a content plan for a motion-graphics film.',
    script,
    transcript: Array.isArray(transcript) ? transcript.slice(0, 200) : transcript,
    total_ms: safeTotal,
    detected_topic: topic,
  }, null, 2);

  let content = null;
  for (const modelName of MODEL_CHAIN) {
    if (content) break;
    for (let attempt = 0; attempt < 2 && !content; attempt++) {
      try {
        const m = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 4096,
          },
          systemInstruction: SYSTEM_PROMPT,
        });
        const result = await m.generateContent(userMsg);
        const text = result.response.text();
        const parsed = tryParseJson(text);
        if (parsed) {
          const v = validateContent(parsed, safeTotal);
          if (v) {
            content = v;
            console.log(`[understand] ok on model=${modelName} attempt=${attempt + 1}`);
            break;
          } else {
            console.warn(`[understand] model=${modelName} attempt=${attempt + 1}: validation failed`);
          }
        }
      } catch (err) {
        const msg = err?.message || String(err);
        const isOverload = msg.includes('503') || msg.includes('high demand') || msg.includes('429');
        console.warn(`[understand] model=${modelName} attempt=${attempt + 1} failed: ${msg.slice(0, 120)}`);
        if (isOverload) {
          const backoff = 1500 * (attempt + 1);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
  }

  if (!content) {
    console.warn('[understand] falling back to heuristic content plan');
    content = heuristicContent(script, safeTotal);
  }

  return {
    ...content,
    palette: {
      primary: palette.colors[0],
      secondary: palette.colors[1],
      tertiary: palette.colors[2],
      accent4: palette.colors[3],
      accent5: palette.colors[4],
      glow: palette.glow,
      gradient: palette.gradient,
    },
    detected_topic: topic,
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const SAMPLE = process.env.SAMPLE_SCRIPT || 'Mitochondria are often called the powerhouses of the cell. These tiny organelles convert glucose and oxygen into ATP, the energy currency that fuels nearly every cellular process. Without mitochondria, a cell would quickly run out of energy and die. Every minute, your body produces roughly 9 × 10^20 ATP molecules — that is 900,000,000,000,000,000,000 reactions per second across all your cells. The glucose and oxygen you absorbed ten seconds ago are already being processed. Each mitochondrion has its own DNA, separate from the cell nucleus, hinting that they were once free-living bacteria that became permanent residents more than a billion years ago. When mitochondria fail, the consequences are catastrophic: muscle weakness, neurodegeneration, even death. Understanding them is understanding life itself.';
  const wc = SAMPLE.trim().split(/\s+/).filter(Boolean).length;
  const totalMs = Math.round((wc / 150) * 60 * 1000);
  const { writeFileSync } = await import('node:fs');
  const t0 = Date.now();
  const result = await understandScript({ script: SAMPLE, transcript: [], totalMs });
  const dt = Date.now() - t0;
  console.log(`\n[understand] completed in ${dt}ms (source=${result.source})`);
  console.log(`[understand] topic=${result.topic} subtopic=${result.subtopic} arc="${result.narrative_arc}"`);
  console.log(`[understand] ${result.concepts.length} concepts, ${result.story_beats.length} beats, ${result.key_takeaways.length} takeaways\n`);
  console.log(JSON.stringify(result, null, 2));
  const outPath = new URL('./content.json', import.meta.url);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n[understand] wrote ${outPath.pathname}`);
}
