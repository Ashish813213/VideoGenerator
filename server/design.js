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
};

export const COLORS = {
  bgDark: '#0A0A0A',
  bgLight: '#FAFAFA',
  blue: '#3B82F6',
  cyan: '#06B6D4',
  purple: '#8B5CF6',
  emerald: '#10B981',
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  yellow: '#FACC15',
  white: '#FFFFFF',
  black: '#000000',
};

export const TOPIC_PALETTE = {
  technology: { primary: COLORS.blue, accent: COLORS.cyan, glow: COLORS.blue },
  finance: { primary: COLORS.emerald, accent: COLORS.green, glow: COLORS.emerald },
  warning: { primary: COLORS.red, accent: COLORS.orange, glow: COLORS.red },
  science: { primary: COLORS.purple, accent: COLORS.blue, glow: COLORS.purple },
  success: { primary: COLORS.green, accent: COLORS.emerald, glow: COLORS.green },
  energy: { primary: COLORS.orange, accent: COLORS.yellow, glow: COLORS.orange },
  neutral: { primary: COLORS.blue, accent: COLORS.purple, glow: COLORS.blue },
};

const TOPIC_KEYWORDS = {
  technology: ['computer','cpu','gpu','chip','processor','code','software','hardware','ai','machine learning','neural','data','algorithm','app','web','server','cloud','database','api','python','javascript','programming','developer','engineer','tech','digital','binary','transistor','memory','ram','ssd','disk','network','internet','wifi','5g','router','browser'],
  finance: ['money','finance','invest','stock','market','trading','economy','bank','loan','credit','debt','inflation','revenue','profit','loss','dollar','euro','crypto','bitcoin','ethereum','blockchain','portfolio','dividend','interest','tax','budget','salary','wealth','asset','liability'],
  warning: ['warning','danger','risk','threat','attack','hack','breach','malware','virus','fraud','scam','crash','failure','error','critical','alert','emergency','deadly','toxic','hazard','pollution','climate','extinction','pandemic','war','crime'],
  science: ['science','physics','chemistry','biology','molecule','cell','dna','gene','atom','quantum','relativity','energy','force','gravity','evolution','species','bacteria','virus','protein','enzyme','neuron','brain','experiment','hypothesis','theory','research','laboratory','microscope','telescope','space','planet','star','galaxy'],
  success: ['success','win','achieve','goal','record','best','top','fastest','growth','improve','boost','increase','optimize','efficient','productive','leader','winner','champion','milestone','celebrate'],
  energy: ['power','electric','battery','voltage','current','solar','wind','nuclear','fuel','engine','motor','turbine','generator','joule','watt','kilowatt','megawatt'],
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
  return TOPIC_PALETTE[topic] || TOPIC_PALETTE.neutral;
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
};

export const SCENE_TYPE_LIST = Object.values(SCENE_TYPES);

export const W = 1920;
export const H = 1080;
export const FPS = 30;
