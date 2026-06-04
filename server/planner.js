import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { pickIconForQuery, normalizeLucideName } from './lucide.js';
import { SCENE_TYPE_LIST, COLORS, paletteFor, detectTopic } from './design.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const LUCIDE_HINT = [
  'Cpu','Code','Code2','Database','Server','Cloud','CloudLightning','Wifi','Monitor','Smartphone','Bot','CircuitBoard','Network',
  'Atom','Dna','Microscope','FlaskConical','FlaskRound','Brain','BrainCircuit','Leaf','Globe','Telescope','Beaker','TestTube','TestTubes',
  'Zap','Bolt','Power','Battery','BatteryFull','BatteryLow','BatteryMedium','Sparkle','Sun','Lightbulb',
  'Heart','HeartPulse','Stethoscope','Pill','Activity','Bandage',
  'Star','Trophy','Target','Flag','BookOpen','GraduationCap','Compass','Rocket','Satellite','WandSparkles','Sparkles',
  'Play','RefreshCw','Send','Save','Download','Upload','Search','Settings','Plus','Minus','Trash','Pencil','Pen','Eye','Share',
  'Mail','MessageCircle','MessageSquare','Phone','PhoneCall','Mic','Video','Bell','BellRing',
  'Car','Plane','Ship','Train','Truck','Bike','Bus',
  'User','Users','UserPlus','Baby','PersonStanding',
  'Sun','Moon','Cloud','CloudRain','Snowflake','Wind','Flame','Mountain','TreeDeciduous','TreePine','Flower','Sprout',
  'DollarSign','Banknote','CreditCard','ShoppingCart','Store','TrendingUp','TrendingDown','BarChart','PieChart','LineChart',
  'Utensils','Coffee','Apple','Pizza','Wine','Beer','Droplet','Egg',
  'Home','Building','MapPin','Map','Compass','Navigation',
  'Lock','LockKeyhole','Key','Shield','ShieldCheck','Fingerprint',
  'Clock','AlarmClock','Calendar','Timer','Hourglass',
  'HelpCircle','Info','AlertCircle','AlertTriangle','CheckCircle','XCircle','Circle','Square','Triangle',
  'ArrowRight','ArrowLeft','ArrowUp','ArrowDown','ChevronRight','ChevronLeft','ChevronUp','ChevronDown',
  'Music','Volume2','Headphones','Radio','Speaker',
  'Camera','Image','Film','Video','Tv','MonitorPlay','PlayCircle',
  'Box','Package','Layers','Stack','Archive','Folder','File','FileText',
  'GitBranch','GitCommit','GitMerge','GitPullRequest','Terminal','Command','Cog','Wrench','Hammer',
  'Anchor','Tent','Backpack',
].join(', ');

const SYSTEM_PROMPT = `You are an elite motion graphics director (Apple / Kurzgesagt / Veritasium style). Transform a script into a high-impact scene plan for a 30–90 second explainer video.

DESIGN LANGUAGE
- Dark premium look. Default background: #0A0A0A (near-black). Use #FAFAFA only for bright/optimistic topics.
- Topic colors are pre-decided (you do NOT choose bg_color). Use the supplied 'palette' object to set accent_color.
- Display text: short, bold, uppercase-friendly, 2–6 words. Body: short explanatory phrases.
- Every scene must include at least one motion keyword in 'animation': scalePop, fadeUp, fadeDown, wordByWord, slideLeft, slideRight, blurReveal, kineticTypography, highlightSweep, bouncePop, drawSVG, popIn, elasticScale.

SCENE TYPES — pick exactly one per scene, matching the narrative beat:
1. "hero"  — Opening/title. Big headline + subtitle. Use for the first 3–5 seconds.
2. "definition"  — Define a term. Layout: large keyword (title) + 1–2 line definition (body). Include 'lucide_icon_name'.
3. "process"  — Sequential steps. REQUIRED: 'steps' (array of 2–4 short strings, e.g. ["Input","Process","Output"]) and an icon per step. Steps animate in left-to-right.
4. "timeline"  — Past → Present → Future. REQUIRED: 'milestones' (array of {label, year}). Markers slide along a horizontal line.
5. "comparison"  — Left vs Right. REQUIRED: 'left' and 'right' objects: {title, points:[string], icon, color}.
6. "stat"  — Big animated number. REQUIRED: 'value' (string, e.g. "95%"), 'label' (short caption), 'prefix'/'suffix' optional. Number scales 0→final.
7. "callout"  — Highlight a single important concept. Large colored card with glow border. Include 'lucide_icon_name' and a one-line insight.
8. "summary"  — 3 key takeaways. REQUIRED: 'takeaways' (array of 3 short strings with optional icon names).

ANIMATION RULES
- "hero"     → "scalePop" or "kineticTypography"
- "definition" → "wordByWord" or "fadeUp"
- "process"  → "slideRight" for steps
- "timeline" → "slideLeft" for markers
- "comparison" → "slideLeft" (left) and "slideRight" (right)
- "stat"     → "scalePop" for the number
- "callout"  → "bouncePop" or "scalePop"
- "summary"  → "fadeUp" per takeaway

TEXT ANIMATIONS allowed: scalePop, typewriter, fadeUp, fadeDown, wordByWord, slideLeft, slideRight, blurReveal, kineticTypography, highlightSweep, bouncePop.

TEXT RULES
- title: 2–6 words. uppercase-friendly. The single most important phrase.
- subtitle: 1 short sentence, max 10 words. The 'so what'.
- For important keywords in the title, set 'highlight_words' to an array of words to render in the accent color (gradient glow effect).
- For stats, set 'value' to the final number (e.g. "95%", "10X", "3.5B").

ICON
- Provide 'lucide_icon_name' (PascalCase) for definition / callout / process steps / summary takeaways.
- Use only names from this curated set: ${LUCIDE_HINT}
- If a step in 'process' or a takeaway in 'summary' has its own icon, add an 'icon' field to that item.

COLORS
- 'accent_color' is REQUIRED. Pick the main brand color for the topic from the supplied palette.
- 'text_color' defaults to #FFFFFF.
- Do NOT set 'bg_color' (the renderer decides; default is #0A0A0A dark or #FAFAFA light per topic).

TIMING
- Scene timings must cover the entire audio without gaps. Last scene ends at total_ms.
- A 60-second script typically has 5–9 scenes.
- Hero scene: ~3–4s. Definition: 4–6s. Process: 5–7s. Stat: 4–5s. Summary: 5–6s.

OUTPUT
- Output ONLY a valid JSON array. No markdown, no commentary.
- The 'id' field is optional; we will assign it.
- Use these fields per scene:
  {
    "scene_type": "hero" | "definition" | "process" | "timeline" | "comparison" | "stat" | "callout" | "summary",
    "start_ms": 0,
    "end_ms": 1720,
    "title": "WHAT IS A CPU?",
    "subtitle": "The brain of the computer",
    "highlight_words": ["CPU"],
    "animation": "scalePop",
    "accent_color": "#3B82F6",
    "text_color": "#FFFFFF",
    "lucide_icon_name": "Cpu" | null,
    "value": "95%" | null,            // stat only
    "label": "faster than last gen"   // stat only
    "steps": [{"label":"Input","icon":"Play"}, ...]   // process only
    "milestones": [{"label":"1970","year":"1971"}, ...] // timeline only
    "left":  {"title":"Old","points":[...],"icon":"...","color":"#EF4444"}   // comparison
    "right": {"title":"New","points":[...],"icon":"...","color":"#10B981"}   // comparison
    "takeaways": [{"text":"Fast","icon":"Zap"}, ...]   // summary
  }
`;

const VALID_ANIMS = new Set([
  'scalePop','typewriter','fadeUp','fadeDown','wordByWord','slideLeft','slideRight',
  'blurReveal','kineticTypography','highlightSweep','bouncePop','drawSVG','popIn',
  'elasticScale','pulse','zoomIn','zoomOut','parallax','focusReveal','floatAnimation','slideReveal',
  'rotate','fade_in','slide_in','zoom_in','pulse_old',
]);
const VALID_HEX = /^#([0-9a-fA-F]{3}){1,2}$/;

function safeStr(v, max = 80) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function validateScene(s, i, totalMs) {
  const sceneType = SCENE_TYPE_LIST.includes(s.scene_type) ? s.scene_type : 'definition';
  const anim = VALID_ANIMS.has(s.animation) ? s.animation : 'fadeUp';
  const accent = VALID_HEX.test(s.accent_color || '') ? s.accent_color : '#3B82F6';
  const textColor = VALID_HEX.test(s.text_color || '') ? s.text_color : '#FFFFFF';
  const iconName = typeof s.lucide_icon_name === 'string'
    ? (normalizeLucideName(s.lucide_icon_name) || null)
    : null;

  const out = {
    id: typeof s.id === 'string' ? s.id : `scene_${String(i + 1).padStart(2, '0')}`,
    scene_type: sceneType,
    start_ms: Math.max(0, parseInt(s.start_ms, 10) || 0),
    end_ms: Math.max(0, parseInt(s.end_ms, 10) || 0),
    title: safeStr(s.title, 60),
    subtitle: safeStr(s.subtitle, 100),
    highlight_words: safeArray(s.highlight_words).map(x => safeStr(x, 20)).slice(0, 6),
    animation: anim,
    accent_color: accent,
    text_color: textColor,
    lucide_icon_name: iconName,
    bg_color: '#0A0A0A',
  };

  if (sceneType === 'stat') {
    out.value = safeStr(s.value, 20) || '0';
    out.label = safeStr(s.label, 60);
  }
  if (sceneType === 'process') {
    out.steps = safeArray(s.steps).map(st => ({
      label: safeStr(typeof st === 'object' ? st?.label : st, 20),
      icon: typeof st === 'object' && st?.icon ? (normalizeLucideName(st.icon) || null) : null,
    })).filter(st => st.label).slice(0, 4);
    if (!out.steps.length) out.steps = [{ label: 'Step 1', icon: null }];
  }
  if (sceneType === 'timeline') {
    out.milestones = safeArray(s.milestones).map(m => ({
      label: safeStr(typeof m === 'object' ? m?.label : m, 20),
      year: safeStr(typeof m === 'object' ? m?.year : '', 12),
    })).filter(m => m.label).slice(0, 5);
    if (!out.milestones.length) out.milestones = [{ label: 'Now', year: '' }];
  }
  if (sceneType === 'comparison') {
    const left = s.left && typeof s.left === 'object' ? s.left : {};
    const right = s.right && typeof s.right === 'object' ? s.right : {};
    out.left = {
      title: safeStr(left.title, 20) || 'Before',
      points: safeArray(left.points).map(p => safeStr(p, 40)).slice(0, 4),
      icon: left.icon ? (normalizeLucideName(left.icon) || null) : null,
      color: VALID_HEX.test(left.color || '') ? left.color : '#EF4444',
    };
    out.right = {
      title: safeStr(right.title, 20) || 'After',
      points: safeArray(right.points).map(p => safeStr(p, 40)).slice(0, 4),
      icon: right.icon ? (normalizeLucideName(right.icon) || null) : null,
      color: VALID_HEX.test(right.color || '') ? right.color : '#10B981',
    };
  }
  if (sceneType === 'summary') {
    out.takeaways = safeArray(s.takeaways).map(t => ({
      text: safeStr(typeof t === 'object' ? t?.text : t, 60),
      icon: typeof t === 'object' && t?.icon ? (normalizeLucideName(t.icon) || null) : null,
    })).filter(t => t.text).slice(0, 3);
    if (!out.takeaways.length) out.takeaways = [{ text: 'Key point', icon: null }];
  }
  if (sceneType === 'hero' || sceneType === 'definition' || sceneType === 'callout') {
    if (!out.lucide_icon_name) {
      out.lucide_icon_name = pickIconForQuery(out.title) || 'Sparkles';
    }
  }

  return out;
}

function fillGaps(scenes, totalMs) {
  if (!scenes.length) return scenes;
  scenes.sort((a, b) => a.start_ms - b.start_ms);
  const out = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.start_ms > cursor + 50) {
      out.push({
        id: `scene_gap_${i}`,
        scene_type: 'definition',
        start_ms: cursor,
        end_ms: Math.min(s.start_ms, totalMs),
        title: '',
        subtitle: '',
        highlight_words: [],
        animation: 'fadeUp',
        accent_color: '#3B82F6',
        text_color: '#FFFFFF',
        lucide_icon_name: null,
        bg_color: '#0A0A0A',
      });
    }
    out.push(s);
    cursor = s.end_ms;
  }
  if (cursor < totalMs - 50) {
    const last = scenes[scenes.length - 1];
    out.push({ ...last, id: `scene_tail`, start_ms: cursor, end_ms: totalMs });
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].start_ms < out[i - 1].end_ms) {
      out[i].start_ms = out[i - 1].end_ms;
    }
  }
  return out.filter(s => s.end_ms > s.start_ms);
}

function tryParse(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return null;
}

export async function planScenes({ transcript, script, totalMs }) {
  const topic = detectTopic(script);
  const palette = paletteFor(topic);

  const model = genAI.getGenerativeModel({
    model: config.gemini.plannerModel,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.85 },
    systemInstruction: SYSTEM_PROMPT,
  });

  const userMsg = JSON.stringify({
    transcript,
    script,
    total_ms: totalMs,
    topic,
    palette: { primary: palette.primary, accent: palette.accent, glow: palette.glow },
  }, null, 2);

  let scenes = null;
  for (let attempt = 0; attempt < 2 && !scenes; attempt++) {
    try {
      const result = await model.generateContent(userMsg);
      const text = result.response.text();
      const parsed = tryParse(text);
      if (parsed) {
        scenes = parsed.map((s, i) => validateScene(s, i, totalMs));
      }
    } catch (err) {
      console.warn(`[planner] attempt ${attempt + 1} failed:`, err.message);
    }
  }

  if (!scenes) {
    console.warn('[planner] using fallback single scene');
    scenes = [{
      id: 'scene_01',
      scene_type: 'hero',
      start_ms: 0,
      end_ms: totalMs,
      title: script.slice(0, 60).toUpperCase(),
      subtitle: '',
      highlight_words: [],
      animation: 'scalePop',
      accent_color: palette.primary,
      text_color: '#FFFFFF',
      lucide_icon_name: pickIconForQuery(script) || 'Sparkles',
      bg_color: '#0A0A0A',
    }];
  }

  return fillGaps(scenes, totalMs);
}
