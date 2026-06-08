import { pickIconForQuery, normalizeLucideName } from './lucide.js';
import { SCENE_TYPE_LIST, SCENE_TYPE_FALLBACK, paletteFor, detectTopic } from './design.js';
import { orchestrate } from './planning/orchestrate.js';

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
  'ShieldAlert','ShieldX','Bug','Skull','Crosshair','Siren','Flame',
  'Network','Wifi','Radio','Antenna','Satellite','Router',
  'Brain','BrainCircuit','Sparkles','Wand2','Workflow',
  'Anchor','Tent','Backpack',
].join(', ');

const VALID_ANIMS = new Set([
  'scalePop','typewriter','fadeUp','fadeDown','wordByWord','slideLeft','slideRight',
  'blurReveal','kineticTypography','highlightSweep','bouncePop','drawSVG','popIn',
  'elasticScale','pulse','zoomIn','zoomOut','parallax','focusReveal','floatAnimation','slideReveal',
  'rotate','fade_in','slide_in','zoom_in',
]);
const VALID_LAYOUTS = new Set(['center','left','right','top','bottom','split','floating','grid']);
const VALID_DECORATIVE = new Set(['floating_circles','blobs','dots','lines','grid','pulse','particles','sweep','light_ray']);
const VALID_HEX = /^#([0-9a-fA-F]{3}){1,2}$/;

function safeStr(v, max = 80) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/Ã—|×/g, 'x')
    .replace(/Â²|²/g, '2')
    .replace(/Â³|³/g, '3')
    .replace(/â°|⁰/g, '0')
    .replace(/â¹|¹/g, '1')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeArray(v) { return Array.isArray(v) ? v : []; }

function validateScene(s, i, totalMs) {
  const sceneType = SCENE_TYPE_LIST.includes(s.scene_type) ? s.scene_type : 'definition';
  if (sceneType !== s.scene_type && SCENE_TYPE_FALLBACK[s.scene_type]) {
    const mapped = SCENE_TYPE_FALLBACK[s.scene_type];
    if (SCENE_TYPE_LIST.includes(mapped)) return validateScene({ ...s, scene_type: mapped }, i, totalMs);
  }
  const anim = VALID_ANIMS.has(s.animation) ? s.animation : 'scalePop';
  const layout = VALID_LAYOUTS.has(s.layout) ? s.layout : 'center';
  const accent = VALID_HEX.test(s.accent_color || '') ? s.accent_color : '#3B82F6';
  const accent2 = VALID_HEX.test(s.accent_color_2 || '') ? s.accent_color_2 : accent;
  const accent3 = VALID_HEX.test(s.accent_color_3 || '') ? s.accent_color_3 : accent2;
  const textColor = VALID_HEX.test(s.text_color || '') ? s.text_color : '#FFFFFF';
  const decColor = VALID_HEX.test(s.decorative_color || '') ? s.decorative_color : accent;
  const iconName = typeof s.lucide_icon_name === 'string'
    ? (normalizeLucideName(s.lucide_icon_name) || null)
    : null;

  const decorative = safeArray(s.decorative)
    .filter(x => VALID_DECORATIVE.has(x))
    .slice(0, 8);
  if (!decorative.length) {
    const defaults = {
      hero: ['floating_circles', 'pulse', 'dots'],
      definition: ['dots', 'lines'],
      callout: ['floating_circles', 'pulse'],
      stat: ['floating_circles', 'sweep'],
      process: ['lines', 'dots'],
      timeline: ['lines', 'dots'],
      comparison: ['floating_circles'],
      summary: ['floating_circles', 'dots'],
    };
    decorative.push(...(defaults[sceneType] || ['dots']));
  }

  const out = {
    id: typeof s.id === 'string' ? s.id : `scene_${String(i + 1).padStart(2, '0')}`,
    scene_type: sceneType,
    start_ms: Math.max(0, parseInt(s.start_ms, 10) || 0),
    end_ms: Math.max(0, parseInt(s.end_ms, 10) || 0),
    layout,
    title: safeStr(s.title, 80),
    subtitle: safeStr(s.subtitle, 160),
    highlight_words: safeArray(s.highlight_words).map(x => safeStr(x, 20)).slice(0, 6),
    animation: anim,
    accent_color: accent,
    accent_color_2: accent2,
    accent_color_3: accent3,
    text_color: textColor,
    decorative_color: decColor,
    decorative,
    lucide_icon_name: iconName,
    bg_color: '#020617',
    primary_asset: safeStr(s.primary_asset, 60),
    secondary_assets: safeArray(s.secondary_assets).map(x => safeStr(x, 40)).slice(0, 4),
    icon_hints: safeArray(s.icon_hints).map(x => safeStr(x, 30)).slice(0, 4),
    visual_goal: safeStr(s.visual_goal, 200),
    motion_choreography: safeArray(s.motion_choreography).map(x => safeStr(x, 80)).slice(0, 8),
    camera_motion: typeof s.camera_motion === 'string' ? s.camera_motion : 'static',
    transition_style: typeof s.transition_style === 'string' ? s.transition_style : 'cut',
    mood: safeStr(s.mood, 40),
    beat_role: safeStr(s.beat_role, 20),
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
        layout: 'center',
        title: '',
        subtitle: '',
        highlight_words: [],
        animation: 'fadeUp',
        accent_color: '#3B82F6',
        accent_color_2: '#8B5CF6',
        accent_color_3: '#06B6D4',
        text_color: '#FFFFFF',
        decorative_color: '#3B82F6',
        decorative: ['dots'],
        lucide_icon_name: null,
        bg_color: '#020617',
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

export function buildSpokenCaptions(scene, transcript) {
  if (!Array.isArray(transcript) || !transcript.length) return [];
  const words = transcript.filter(item =>
    item &&
    typeof item.word === 'string' &&
    item.word.trim() &&
    item.end_ms > scene.start_ms &&
    item.start_ms < scene.end_ms
  );
  if (!words.length) return [];

  const captions = [];
  let group = [];
  let chars = 0;

  const flush = () => {
    if (!group.length) return;
    const first = group[0];
    const last = group[group.length - 1];
    captions.push({
      text: group.map(item => item.word).join(' '),
      start_ms: Math.max(0, first.start_ms - scene.start_ms),
      end_ms: Math.min(scene.end_ms - scene.start_ms, last.end_ms - scene.start_ms + 140),
    });
    group = [];
    chars = 0;
  };

  for (const word of words) {
    const clean = word.word.trim();
    const gap = group.length ? word.start_ms - group[group.length - 1].end_ms : 0;
    const nextChars = chars + (group.length ? 1 : 0) + clean.length;
    const sentenceEnd = /[.!?]["']?$/.test(clean);
    if (group.length && (gap > 360 || nextChars > 34 || group.length >= 6)) flush();
    group.push(word);
    chars += (group.length > 1 ? 1 : 0) + clean.length;
    if (sentenceEnd || group.length >= 6) flush();
  }
  flush();

  return captions
    .filter(caption => caption.end_ms > caption.start_ms)
    .slice(0, 24);
}

function attachSpokenCaptions(scenes, transcript) {
  return scenes.map(scene => ({
    ...scene,
    spoken_captions: buildSpokenCaptions(scene, transcript),
  }));
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

export async function planScenes({ transcript, script, totalMs, jobDir }) {
  let rawScenes;
  try {
    rawScenes = await orchestrate({ script, transcript, totalMs, jobDir });
  } catch (err) {
    console.error('[planner] orchestrate failed, using single-scene fallback:', err.message);
    const topic = detectTopic(script);
    const palette = paletteFor(topic);
    rawScenes = [{
      id: 'scene_01',
      scene_type: 'hero',
      start_ms: 0,
      end_ms: totalMs,
      layout: 'center',
      title: script.slice(0, 60).toUpperCase(),
      subtitle: '',
      highlight_words: [],
      animation: 'kineticTypography',
      accent_color: palette.colors[0],
      accent_color_2: palette.colors[1],
      accent_color_3: palette.colors[2],
      text_color: '#FFFFFF',
      decorative_color: palette.glow,
      decorative: ['floating_circles','pulse','dots'],
      lucide_icon_name: pickIconForQuery(script) || 'Sparkles',
      bg_color: '#020617',
    }];
  }

  const validated = rawScenes.map((s, i) => validateScene(s, i, totalMs));
  return attachSpokenCaptions(fillGaps(validated, totalMs), transcript);
}
