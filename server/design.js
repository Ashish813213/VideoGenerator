import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = path.resolve(ROOT, 'assets', 'fonts');

function fontPath(name) {
  const p = path.join(FONT_DIR, name);
  return fs.existsSync(p) ? p.replace(/\\/g, '/') : null;
}

export const FONTS = {
  display: fontPath('SpaceGrotesk-Bold.ttf'),
  displaySemi: fontPath('SpaceGrotesk-SemiBold.ttf'),
  displayRegular: fontPath('SpaceGrotesk-Regular.ttf'),
  body: fontPath('Inter-Regular.ttf'),
  bodyBold: fontPath('Inter-Bold.ttf'),
  bodySemi: fontPath('Inter-SemiBold.ttf'),
  stat: fontPath('BebasNeue-Regular.ttf'),
  impact: fontPath('Anton-Regular.ttf'),
  playful: fontPath('LuckiestGuy-Regular.ttf'),
  handwritten: fontPath('PermanentMarker-Regular.ttf'),
};

export const COLORS = {
  bgDark: '#020617',
  bgMid: '#0F172A',
  bgLight: '#1E293B',
  paperLight: '#FAFAFA',
  blue: '#3B82F6',
  blueDeep: '#1E3A8A',
  blueLight: '#60A5FA',
  cyan: '#06B6D4',
  purple: '#8B5CF6',
  purpleDeep: '#4C1D95',
  purpleLight: '#A855F7',
  pink: '#EC4899',
  emerald: '#10B981',
  green: '#22C55E',
  greenLight: '#A3E635',
  yellow: '#FACC15',
  orange: '#F97316',
  orangeDeep: '#C2410C',
  orangeLight: '#FDBA74',
  red: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
};

export const GRADIENTS = {
  dark: ['#080B12', '#0C1220', '#111827'],
  blue: ['#070B14', '#0B1528', '#12213D'],
  purple: ['#090A14', '#151226', '#24183A'],
  orange: ['#0E0B09', '#21150F', '#3A2115'],
  emerald: ['#070D0C', '#0C1B18', '#123229'],
  cyberpunk: ['#090A14', '#181329', '#2B1733'],
  warm: ['#0E0B09', '#21150F', '#3A2115'],
};

export const TOPIC_PALETTES = {
  technology: {
    name: 'technology',
    gradient: GRADIENTS.blue,
    colors: [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.blueLight, COLORS.purpleLight],
    glow: COLORS.blue,
  },
  ai: {
    name: 'ai',
    gradient: GRADIENTS.cyberpunk,
    colors: [COLORS.purple, COLORS.pink, COLORS.blue, COLORS.purpleLight, COLORS.cyan],
    glow: COLORS.purple,
  },
  finance: {
    name: 'finance',
    gradient: GRADIENTS.emerald,
    colors: [COLORS.emerald, COLORS.green, COLORS.yellow, COLORS.greenLight, COLORS.emerald],
    glow: COLORS.emerald,
  },
  warning: {
    name: 'warning',
    gradient: [COLORS.bgDark, '#7F1D1D', COLORS.red],
    colors: [COLORS.red, COLORS.orange, COLORS.yellow, COLORS.orangeLight, COLORS.red],
    glow: COLORS.red,
  },
  cybersecurity: {
    name: 'cybersecurity',
    gradient: ['#090A0D', '#211014', '#351619'],
    colors: [COLORS.red, COLORS.orange, '#1F2937', COLORS.red, COLORS.yellow],
    glow: COLORS.red,
  },
  science: {
    name: 'science',
    gradient: GRADIENTS.purple,
    colors: [COLORS.purple, COLORS.blue, COLORS.pink, COLORS.purpleLight, COLORS.cyan],
    glow: COLORS.purple,
  },
  success: {
    name: 'success',
    gradient: GRADIENTS.emerald,
    colors: [COLORS.green, COLORS.emerald, COLORS.yellow, COLORS.greenLight, COLORS.emerald],
    glow: COLORS.green,
  },
  energy: {
    name: 'energy',
    gradient: GRADIENTS.warm,
    colors: [COLORS.orange, COLORS.yellow, COLORS.red, COLORS.orangeLight, COLORS.yellow],
    glow: COLORS.orange,
  },
  startup: {
    name: 'startup',
    gradient: ['#070B14', '#101A2E', '#201838'],
    colors: [COLORS.blue, COLORS.white, COLORS.purple, COLORS.cyan, COLORS.blueLight],
    glow: COLORS.blue,
  },
  neutral: {
    name: 'neutral',
    gradient: GRADIENTS.dark,
    colors: [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.purpleLight, COLORS.blueLight],
    glow: COLORS.blue,
  },
};

const TOPIC_KEYWORDS = {
  ai: ['ai','artificial intelligence','machine learning','neural network','deep learning','llm','gpt','chatgpt','transformer','chatbot','generative','diffusion','prompt','token','embedding','agent','rag','fine-tuning','model','training','inference'],
  cybersecurity: ['hack','hacker','breach','malware','phishing','vulnerability','exploit','ransomware','ddos','zero-day','cybersecurity','security','password','encryption','firewall','threat','attack','virus','trojan','spyware'],
  technology: ['computer','cpu','gpu','chip','processor','code','software','hardware','data','algorithm','app','web','server','cloud','database','api','python','javascript','programming','developer','tech','digital','binary','transistor','memory','ram','ssd','disk','network','internet','wifi','5g','router','browser'],
  finance: ['money','finance','invest','stock','market','trading','economy','bank','loan','credit','debt','inflation','revenue','profit','loss','dollar','euro','crypto','bitcoin','ethereum','blockchain','portfolio','dividend','interest','tax','budget','salary','wealth','asset','liability'],
  warning: ['warning','danger','risk','threat','attack','hack','breach','malware','virus','fraud','scam','crash','failure','error','critical','alert','emergency','deadly','toxic','hazard','pollution','climate','extinction','pandemic','war','crime'],
  science: ['science','physics','chemistry','biology','molecule','cell','dna','gene','atom','quantum','relativity','energy','force','gravity','evolution','species','bacteria','protein','enzyme','neuron','brain','experiment','hypothesis','theory','research','laboratory','microscope','telescope','space','planet','star','galaxy'],
  success: ['success','win','achieve','goal','record','best','top','fastest','growth','improve','boost','increase','optimize','efficient','productive','leader','winner','champion','milestone','celebrate'],
  energy: ['power','electric','battery','voltage','current','solar','wind','nuclear','fuel','engine','motor','turbine','generator','joule','watt','kilowatt','megawatt'],
  startup: ['startup','founder','launch','product','growth','users','customer','saas','venture','seed','series','funding','investor','y combinator','pitch','mvp','scale'],
};

export function detectTopic(script) {
  const text = (script || '').toLowerCase();
  const scores = {};
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    scores[topic] = 0;
    for (const kw of kws) {
      if (text.includes(kw)) scores[topic] += 1;
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'neutral';
}

export function paletteFor(topic) {
  return TOPIC_PALETTES[topic] || TOPIC_PALETTES.neutral;
}

export const SCENE_TYPES = {
  HERO: 'hero',
  DEFINITION: 'definition',
  PROCESS: 'process',
  TIMELINE: 'timeline',
  COMPARISON: 'comparison',
  STAT: 'stat',
  CALLOUT: 'callout',
  SUMMARY: 'summary',
  VISUAL_METAPHOR: 'visual_metaphor',
  NETWORK: 'network',
  DATA_FLOW: 'data_flow',
  DIAGRAM: 'diagram',
  RELATIONSHIP: 'relationship',
  CONCEPT: 'concept',
  CODE: 'code',
  ARCHITECTURE: 'architecture',
  FORMULA: 'formula',
  PREDICTION: 'prediction',
  CINEMATIC: 'cinematic',
};

export const SCENE_TYPE_LIST = Object.values(SCENE_TYPES);

export const SCENE_TYPE_FALLBACK = {
  visual_metaphor: 'hero',
  network: 'process',
  data_flow: 'process',
  diagram: 'process',
  relationship: 'comparison',
  concept: 'definition',
  code: 'process',
  architecture: 'process',
  formula: 'definition',
  prediction: 'process',
  cinematic: 'hero',
};

export const LAYOUTS = ['center', 'left', 'right', 'top', 'bottom', 'split', 'floating', 'grid'];

export const W = 1920;
export const H = 1080;
export const FPS = 30;
