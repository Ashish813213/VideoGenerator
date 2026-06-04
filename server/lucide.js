import lucideIcons from 'lucide-static';

export const ALL_LUCIDE_NAMES = Object.keys(lucideIcons);

const KEYWORD_TO_ICON = {
  energy: 'Zap', power: 'Zap', lightning: 'Zap', electric: 'Zap', spark: 'Sparkle',
  cpu: 'Cpu', processor: 'Cpu', computer: 'Cpu', chip: 'Cpu', microchip: 'Cpu',
  database: 'Database', data: 'Database', storage: 'Database', server: 'Server',
  brain: 'Brain', mind: 'Brain', think: 'Brain', intelligence: 'Brain', neural: 'BrainCircuit',
  atom: 'Atom', atomic: 'Atom', molecule: 'Atom', particle: 'Atom',
  dna: 'Dna', gene: 'Dna', genetic: 'Dna', chromosome: 'Dna',
  microscope: 'Microscope', cell: 'Microscope', bacteria: 'Microscope', microbe: 'Microscope',
  leaf: 'Leaf', plant: 'Leaf', tree: 'TreeDeciduous', nature: 'Leaf', eco: 'Leaf',
  globe: 'Globe', world: 'Globe', earth: 'Globe', planet: 'Globe', global: 'Globe',
  heart: 'Heart', love: 'Heart', health: 'HeartPulse', pulse: 'HeartPulse',
  rocket: 'Rocket', launch: 'Rocket', space: 'Rocket', satellite: 'Satellite',
  shield: 'Shield', security: 'Shield', protect: 'Shield', defense: 'Shield', safe: 'Shield',
  code: 'Code', programming: 'Code', software: 'Code', developer: 'Code',
  flask: 'FlaskConical', chemistry: 'FlaskConical', chemical: 'FlaskConical', experiment: 'FlaskConical', lab: 'FlaskConical',
  bulb: 'Lightbulb', idea: 'Lightbulb', lightbulb: 'Lightbulb', innovation: 'Lightbulb',
  cloud: 'Cloud', network: 'Cloud', internet: 'Cloud', wifi: 'Wifi',
  message: 'MessageCircle', chat: 'MessageCircle', mail: 'Mail', email: 'Mail',
  phone: 'Phone', call: 'Phone', mobile: 'Smartphone', smartphone: 'Smartphone',
  monitor: 'Monitor', screen: 'Monitor', display: 'Monitor',
  music: 'Music', audio: 'Music', sound: 'Volume2', speaker: 'Volume2',
  video: 'Video', film: 'Film', movie: 'Film', camera: 'Camera',
  camera: 'Camera', photo: 'Camera', picture: 'Image', image: 'Image',
  car: 'Car', vehicle: 'Car', truck: 'Truck', bike: 'Bike', bicycle: 'Bike',
  plane: 'Plane', flight: 'Plane', airport: 'Plane',
  train: 'Train', subway: 'Train', metro: 'Train',
  ship: 'Ship', boat: 'Ship',
  star: 'Star', favorite: 'Star', best: 'Star',
  trophy: 'Trophy', award: 'Trophy', winner: 'Trophy',
  target: 'Target', goal: 'Target', objective: 'Target',
  flag: 'Flag', marker: 'Flag',
  book: 'BookOpen', read: 'BookOpen', study: 'BookOpen', learn: 'GraduationCap', education: 'GraduationCap', school: 'GraduationCap',
  clock: 'Clock', time: 'Clock', hour: 'Clock', watch: 'Clock',
  calendar: 'Calendar', date: 'Calendar', schedule: 'Calendar',
  sun: 'Sun', sunrise: 'Sun', sunset: 'Sun', solar: 'Sun', sunlight: 'Sun',
  moon: 'Moon', night: 'Moon',
  rain: 'CloudRain', snow: 'Snowflake', snowflake: 'Snowflake', ice: 'Snowflake',
  wind: 'Wind', storm: 'CloudLightning', fire: 'Flame', flame: 'Flame', hot: 'Flame',
  mountain: 'Mountain', hill: 'Mountain',
  user: 'User', person: 'User', human: 'User', people: 'Users', users: 'Users', team: 'Users', group: 'Users',
  money: 'DollarSign', cash: 'DollarSign', dollar: 'DollarSign', currency: 'DollarSign', finance: 'DollarSign', bank: 'Banknote', payment: 'CreditCard', card: 'CreditCard',
  shopping: 'ShoppingCart', cart: 'ShoppingCart', buy: 'ShoppingCart', store: 'Store', shop: 'Store',
  food: 'Utensils', eat: 'Utensils', meal: 'Utensils', coffee: 'Coffee', drink: 'Coffee', tea: 'Coffee', water: 'Droplet', droplet: 'Droplet', liquid: 'Droplet',
  apple: 'Apple', fruit: 'Apple',
  battery: 'BatteryFull', charge: 'BatteryFull', power_level: 'BatteryFull', energy_storage: 'BatteryFull',
  network: 'Network', connection: 'Network', link: 'Link', chain: 'Link',
  lock: 'Lock', password: 'Lock', key: 'Key', secure: 'LockCheck',
  unlock: 'Unlock', open: 'Unlock',
  home: 'Home', house: 'Home', building: 'Building', office: 'Building',
  settings: 'Settings', gear: 'Settings', config: 'Settings', preferences: 'Settings',
  search: 'Search', find: 'Search', lookup: 'Search',
  refresh: 'RefreshCw', reload: 'RefreshCw', sync: 'RefreshCw', update: 'RefreshCw',
  download: 'Download', save: 'Download', upload: 'Upload', share: 'Share',
  send: 'Send', submit: 'Send',
  play: 'Play', start: 'Play', pause: 'Pause', stop: 'Square', record: 'Circle',
  check: 'Check', yes: 'Check', done: 'Check', complete: 'CheckCircle',
  cross: 'X', no: 'X', close: 'X', cancel: 'X', error: 'XCircle', warning: 'AlertTriangle', alert: 'AlertCircle', info: 'Info',
  question: 'HelpCircle', help: 'HelpCircle', faq: 'HelpCircle',
  arrow: 'ArrowRight', next: 'ArrowRight', previous: 'ArrowLeft', back: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown',
  plus: 'Plus', add: 'Plus', minus: 'Minus', remove: 'Minus', delete: 'Trash', trash: 'Trash',
  edit: 'Pencil', write: 'Pencil', pen: 'Pen', pencil: 'Pencil',
  eye: 'Eye', view: 'Eye', see: 'Eye', visibility: 'Eye',
  share: 'Share', social: 'Share',
  printer: 'Printer', print: 'Printer', scan: 'ScanLine', barcode: 'Barcode',
  thermometer: 'Thermometer', temperature: 'Thermometer',
  bandage: 'Bandage', medical: 'Stethoscope', doctor: 'Stethoscope', hospital: 'Stethoscope', pill: 'Pill', medicine: 'Pill', drug: 'Pill',
  robot: 'Bot', bot: 'Bot', ai: 'Bot', artificial: 'Bot',
  science: 'Microscope', research: 'FlaskConical', test: 'TestTube', experiment: 'FlaskConical', discovery: 'Telescope', telescope: 'Telescope',
  microscope: 'Microscope', microscopy: 'Microscope',
  cell: 'Microscope', cellular: 'Microscope',
  tissue: 'Layers', organ: 'Heart', body: 'User',
  oxygen: 'Wind', co2: 'Wind', carbon: 'Leaf', glucose: 'Droplet', sugar: 'Droplet', atp: 'Zap', fuel: 'Flame',
};

export function normalizeLucideName(name) {
  if (!name) return null;
  if (lucideIcons[name]) return name;
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  if (lucideIcons[pascal]) return pascal;
  const lower = name.toLowerCase();
  for (const k of ALL_LUCIDE_NAMES) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

export function pickIconForQuery(query) {
  if (!query) return null;
  const tokens = String(query).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (KEYWORD_TO_ICON[tok]) {
      const n = normalizeLucideName(KEYWORD_TO_ICON[tok]);
      if (n) return n;
    }
  }
  for (const tok of tokens) {
    for (const key of Object.keys(KEYWORD_TO_ICON)) {
      if (key.includes(tok) || tok.includes(key)) {
        const n = normalizeLucideName(KEYWORD_TO_ICON[key]);
        if (n) return n;
      }
    }
  }
  return null;
}

export function getIconSvg(name) {
  const normalized = normalizeLucideName(name);
  if (!normalized) return null;
  return lucideIcons[normalized];
}
