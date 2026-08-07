import { FilterBuilder, W, H, splitWords, wrapWords, escapeDrawtext } from './base.js';
import { FONTS, GRADIENTS } from '../design.js';

function fontFor(kind) {
  if (kind === 'display') return FONTS.display || FONTS.bodyBold;
  if (kind === 'displaySemi') return FONTS.displaySemi || FONTS.bodySemi;
  if (kind === 'stat') return FONTS.impact || FONTS.stat || FONTS.display;
  if (kind === 'playful') return FONTS.playful || FONTS.display;
  if (kind === 'handwritten') return FONTS.handwritten || FONTS.bodySemi;
  if (kind === 'body') return FONTS.body || FONTS.bodyBold;
  if (kind === 'bodyBold') return FONTS.bodyBold || FONTS.displaySemi;
  return FONTS.bodyBold;
}

function titleFontFor(scene) {
  if (scene.scene_type === 'visual_metaphor' || scene.scene_type === 'callout') return fontFor('playful');
  if (scene.scene_type === 'summary') return fontFor('handwritten');
  if (scene.scene_type === 'stat') return fontFor('impact');
  return fontFor('display');
}

function titleCaseLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function gradientFor(scene, palette) {
  return palette.gradient || GRADIENTS.dark;
}

function addDecorations(fb, cur, scene, palette) {
  const dec = scene.decorative || [];
  const decColor = scene.decorative_color || scene.accent_color;

  for (const el of dec) {
    if (el === 'floating_circles') {
      cur = fb.addCircle(cur, fb.next(), { x: 250, y: 200, r: 80, color: decColor, alpha: 0.08 });
      cur = fb.addCircle(cur, fb.next(), { x: W - 280, y: H - 220, r: 120, color: palette.colors[1] || decColor, alpha: 0.06 });
    } else if (el === 'blobs') {
      continue;
    } else if (el === 'dots') {
      const positions = [
        [200, 180, 8, decColor],
        [380, 850, 6, palette.colors[1] || decColor],
        [W - 320, 200, 10, palette.colors[2] || decColor],
        [W - 480, H - 280, 7, decColor],
        [W / 2 - 200, 100, 5, palette.colors[1] || decColor],
        [W / 2 + 300, H - 120, 6, decColor],
        [300, 500, 4, palette.colors[2] || decColor],
        [W - 200, 600, 5, decColor],
      ];
      for (const [x, y, s, c] of positions) {
        cur = fb.addGlowDot(cur, fb.next(), { x, y, size: s, color: c, pulse: false });
      }
    } else if (el === 'lines') {
      cur = fb.addLine(cur, fb.next(), { x1: 100, y1: 100, x2: 400, y2: 250, color: decColor, thickness: 2, alpha: 0.14 });
      cur = fb.addLine(cur, fb.next(), { x1: W - 500, y1: H - 200, x2: W - 100, y2: H - 350, color: palette.colors[1] || decColor, thickness: 2, alpha: 0.14 });
    } else if (el === 'grid') {
      cur = fb.addGrid(cur, fb.next(), { size: 100, color: decColor, alpha: 0.05 });
    } else if (el === 'pulse') {
      cur = fb.addGlowDot(cur, fb.next(), { x: W - 150, y: 150, size: 14, color: decColor, pulse: true });
    } else if (el === 'sweep') {
      continue;
    } else if (el === 'particles') {
      const positions = [
        [200, 200, 3], [400, 300, 2], [600, 250, 4], [800, 350, 3],
        [W - 300, 400, 3], [W - 500, 500, 2], [W - 200, 200, 4],
        [300, 700, 3], [W - 400, 750, 2], [W / 2, 200, 3],
      ];
      for (const [x, y, s] of positions) {
        cur = fb.addGlowDot(cur, fb.next(), { x, y, size: s, color: decColor, pulse: true });
      }
    } else if (el === 'light_ray') {
      cur = fb.addLine(cur, fb.next(), { x1: 0, y1: 0, x2: W, y2: H, color: decColor, thickness: 1, alpha: 0.06 });
    }
  }
  if (scene.beat_role) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: titleCaseLabel(scene.beat_role),
      x: 96,
      y: 62,
      font: fontFor('handwritten'),
      color: scene.accent_color,
      size: 32,
      alpha: 0.92,
      startAt: 0.08,
      endAt: 999,
    });
    cur = fb.addLine(cur, fb.next(), {
      x1: 96,
      y1: 112,
      x2: 190,
      y2: 112,
      color: scene.accent_color,
      thickness: 4,
      alpha: 0.75,
    });
  }
  return cur;
}

function displayTitle(value, maxWords = 12) {
  const text = splitWords(value).slice(0, maxWords).join(' ');
  if (!text || text !== text.toUpperCase()) return text;
  const keepUpper = new Set(['AI', 'API', 'ATP', 'CPU', 'DNA', 'GPU', 'LLM', 'RAM']);
  const small = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);
  return text.split(' ').map((word, index) => {
    if (keepUpper.has(word)) return word;
    const lower = word.toLowerCase();
    if (index > 0 && small.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function normalizeInlineText(value) {
  return String(value || '')
    .replace(/Ã—|×/g, 'x')
    .replace(/Â²|²/g, '2')
    .replace(/Â³|³/g, '3')
    .replace(/â°|⁰/g, '0')
    .replace(/â¹|¹/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

function fitTextBlock(text, {
  maxWidth,
  maxHeight = Infinity,
  maxSize,
  minSize,
  maxLines,
  lineHeight = 1.12,
}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  for (let size = maxSize; size >= minSize; size -= 2) {
    const maxChars = Math.max(4, Math.floor(maxWidth / (size * 0.56)));
    const lines = wrapWords(clean, maxChars, maxLines);
    const widest = Math.max(0, ...lines.map(line => line.length * size * 0.56));
    const height = lines.length * size * lineHeight;
    if (widest <= maxWidth && height <= maxHeight) {
      return { lines, size, lineHeight: Math.round(size * lineHeight), height: Math.round(height) };
    }
  }
  const maxChars = Math.max(4, Math.floor(maxWidth / (minSize * 0.56)));
  const lines = wrapWords(clean, maxChars, maxLines);
  return {
    lines,
    size: minSize,
    lineHeight: Math.round(minSize * lineHeight),
    height: Math.round(lines.length * minSize * lineHeight),
  };
}

function wrapFormula(text, maxChars) {
  const normalized = normalizeInlineText(text)
    .replace(/\s*([=+\-*/^×÷])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawTokens = normalized.split(' ').filter(Boolean);
  const tokens = [];
  for (const token of rawTokens) {
    if (token.length <= maxChars) {
      tokens.push(token);
      continue;
    }
    for (let i = 0; i < token.length; i += maxChars) {
      tokens.push(token.slice(i, i + maxChars));
    }
  }

  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitFormulaBlock(text, {
  maxWidth,
  maxHeight,
  maxSize = 60,
  minSize = 18,
  maxLines = 5,
  lineHeight = 1.18,
}) {
  const clean = normalizeInlineText(text);
  for (let size = maxSize; size >= minSize; size -= 2) {
    const maxChars = Math.max(6, Math.floor(maxWidth / (size * 0.56)));
    const lines = wrapFormula(clean, maxChars);
    const widest = Math.max(0, ...lines.map(line => line.length * size * 0.56));
    const height = lines.length * size * lineHeight;
    if (lines.length <= maxLines && widest <= maxWidth && height <= maxHeight) {
      return { lines, size, lineHeight: Math.round(size * lineHeight), height: Math.round(height) };
    }
  }

  const size = minSize;
  const maxChars = Math.max(6, Math.floor(maxWidth / (size * 0.56)));
  const lines = wrapFormula(clean, maxChars);
  return {
    lines,
    size,
    lineHeight: Math.round(size * lineHeight),
    height: Math.round(lines.length * size * lineHeight),
  };
}

function addFormulaBlock(fb, input, {
  text,
  x,
  y,
  width,
  maxHeight,
  maxSize = 60,
  minSize = 18,
  maxLines = 5,
  font,
  color,
  startAt = 0,
}) {
  const layout = fitFormulaBlock(text, {
    maxWidth: width,
    maxHeight,
    maxSize,
    minSize,
    maxLines,
  });
  let cur = input;
  const top = y + Math.max(0, Math.round((maxHeight - layout.height) / 2));
  for (let i = 0; i < layout.lines.length; i++) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: layout.lines[i],
      x: `${x}+(${width}-text_w)/2`,
      y: top + i * layout.lineHeight,
      font,
      color,
      size: layout.size,
      startAt: startAt + i * 0.06,
      endAt: 999,
    });
  }
  return { output: cur, layout };
}

function addTextBlock(fb, input, {
  text,
  x,
  y,
  width,
  maxHeight = Infinity,
  maxSize,
  minSize,
  maxLines = 2,
  lineHeight = 1.12,
  align = 'left',
  font,
  color,
  alpha = 1,
  accent = null,
  startAt = 0,
  endAt = 999,
  stagger = 0.06,
  fadeInDur = 0.32,
  enable = null,
  extraKVs = {},
}) {
  const layout = fitTextBlock(text, { maxWidth: width, maxHeight, maxSize, minSize, maxLines, lineHeight });
  let cur = input;
  for (let i = 0; i < layout.lines.length; i++) {
    const lineX = align === 'center' ? `${x}+(${width}-text_w)/2` : `${x}`;
    const next = fb.next();
    const opts = {
      text: layout.lines[i],
      x: lineX,
      y: y + i * layout.lineHeight,
      font,
      color,
      alpha,
      size: layout.size,
      startAt: startAt + i * stagger,
      endAt,
      fadeInDur,
      enable,
      extraKVs,
    };
    cur = accent
      ? fb.addNeonText(cur, next, { ...opts, glowColor: accent })
      : fb.addText(cur, next, opts);
  }
  return { output: cur, layout };
}

function titleRegion(layout) {
  if (layout === 'left' || layout === 'split') return { x: 96, y: 460, width: 760, align: 'left' };
  if (layout === 'right') return { x: 1050, y: 460, width: 760, align: 'left' };
  return { x: 180, y: 500, width: 1560, align: 'center' };
}

function imageTextRegion(box) {
  const gutter = 80;
  const edge = 96;
  const imageOnRight = box.x + box.w / 2 >= W / 2;
  if (imageOnRight) {
    return {
      x: edge,
      y: 390,
      width: Math.max(420, box.x - gutter - edge),
      align: 'left',
    };
  }
  const x = box.x + box.w + gutter;
  return {
    x,
    y: 390,
    width: Math.max(420, W - edge - x),
    align: 'left',
  };
}

function addSpokenCaptions(fb, input, scene) {
  const captions = Array.isArray(scene.spoken_captions) ? scene.spoken_captions : [];
  let cur = input;
  for (const caption of captions) {
    const start = Math.max(0, Number(caption.start_ms || 0) / 1000);
    const end = Math.max(start + 0.08, Number(caption.end_ms || 0) / 1000);
    const text = normalizeInlineText(caption.text);
    const layout = fitTextBlock(text, {
      maxWidth: 1280,
      maxHeight: 120,
      maxSize: 42,
      minSize: 30,
      maxLines: 2,
      lineHeight: 1.18,
    });
    const widest = Math.max(...layout.lines.map(line => line.length * layout.size * 0.56), 320);
    const panelW = Math.min(1360, Math.max(420, Math.ceil(widest + 64)));
    const panelH = layout.height + 30;
    const panelX = Math.round((W - panelW) / 2);
    const panelY = 1000 - panelH;
    const panel = fb.next();
    fb.clauses.push(
      `[${cur}]drawbox=x=${panelX}:y=${panelY}:w=${panelW}:h=${panelH}:` +
      `color=${scene.accent_color || '#3B82F6'}@0.90:t=fill:` +
      `enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'[${panel}]`
    );
    cur = panel;
    const captionBlock = addTextBlock(fb, cur, {
      text: normalizeInlineText(caption.text),
      x: panelX + 32,
      y: panelY + 15,
      width: panelW - 64,
      maxHeight: 120,
      maxSize: 42,
      minSize: 30,
      maxLines: 2,
      lineHeight: 1.18,
      align: 'center',
      font: fontFor('bodyBold'),
      color: '#FFFFFF',
      startAt: start,
      endAt: end,
      stagger: 0,
      fadeInDur: 0.12,
      enable: `between(t,${start.toFixed(3)},${end.toFixed(3)})`,
    });
    cur = captionBlock.output;
  }
  return cur;
}

function positionForLayout(layout, kind, scene) {
  if (kind === 'icon') {
    if (layout === 'left') return { x: 200, y: H * 0.30 };
    if (layout === 'right') return { x: W - 700, y: H * 0.30 };
    if (layout === 'top') return { x: (W - 380) / 2, y: 120 };
    if (layout === 'bottom') return { x: (W - 380) / 2, y: 180 };
    return { x: (W - 380) / 2, y: 100 };
  }
  if (kind === 'title') {
    if (layout === 'left') return { x: '80', y: H * 0.42 };
    if (layout === 'right') return { x: '1040', y: H * 0.42 };
    if (layout === 'top') return { x: '(W-text_w)/2', y: 480 };
    if (layout === 'bottom') return { x: '(W-text_w)/2', y: H * 0.70 };
    return { x: '(W-text_w)/2', y: H * 0.50 };
  }
  if (kind === 'subtitle') {
    if (layout === 'left') return { x: '80', y: H * 0.55 };
    if (layout === 'right') return { x: '1040', y: H * 0.55 };
    if (layout === 'top') return { x: '(W-text_w)/2', y: 600 };
    if (layout === 'bottom') return { x: '(W-text_w)/2', y: H * 0.82 };
    return { x: '(W-text_w)/2', y: H * 0.68 };
  }
  return { x: '(W-text_w)/2', y: H * 0.55 };
}

function imageBoxForLayout(layout) {
  if (layout === 'left') return { x: 1040, y: 210, w: 760, h: 560 };
  if (layout === 'right') return { x: 120, y: 210, w: 760, h: 560 };
  if (layout === 'split') return { x: 960, y: 220, w: 780, h: 540 };
  if (layout === 'grid') return { x: 1020, y: 220, w: 660, h: 520 };
  return { x: 1040, y: 210, w: 760, h: 560 };
}

function deriveLabels(text, fallback) {
  const parts = normalizeInlineText(text)
    .split(/\b(?:then|next|after|before|finally|eventually)\b|[,;:]/i)
    .map(part => part.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(part => part.split(' ').slice(0, 4).join(' '))
    .slice(0, 5);
  return parts.length >= 2 ? parts : fallback;
}

function processStepsFor(scene) {
  const supplied = Array.isArray(scene.steps)
    ? scene.steps.filter(step => step && String(step.label || '').trim()).slice(0, 4)
    : [];
  if (supplied.length >= 2) return supplied;
  return deriveLabels(scene.subtitle || scene.title, ['Source', 'Transform', 'Result'])
    .slice(0, 4)
    .map((label, i) => ({
      label,
      icon: ['CircleDot', 'RefreshCw', 'Layers', 'CheckCircle'][i] || null,
    }));
}

function milestonesFor(scene) {
  const supplied = Array.isArray(scene.milestones)
    ? scene.milestones.filter(item => item && String(item.label || '').trim()).slice(0, 5)
    : [];
  if (supplied.length >= 2) return supplied;
  const labels = deriveLabels(scene.subtitle || scene.title, ['Beginning', 'Development', 'Current state']);
  return labels.map((label, i) => ({
    label,
    year: i === labels.length - 1 ? 'Now' : '',
  }));
}

function drawCinematicFigure(fb, input, {
  x, y, scale = 1, color = '#FFFFFF', alpha = 0.92, accent = '#3B82F6', pose = 'stand',
}) {
  let cur = input;
  const box = (bx, by, bw, bh, c = color, a = alpha) => {
    const out = fb.next();
    fb.clauses.push(`[${cur}]drawbox=x=${Math.round(bx)}:y=${Math.round(by)}:w=${Math.round(bw)}:h=${Math.round(bh)}:color=${c}@${a}:t=fill[${out}]`);
    cur = out;
  };
  const s = scale;
  box(x + 30 * s, y, 44 * s, 44 * s, color, alpha);
  box(x + 48 * s, y + 48 * s, 8 * s, 88 * s, color, alpha);
  if (pose === 'phone') {
    box(x + 8 * s, y + 62 * s, 44 * s, 7 * s, color, alpha);
    box(x + 82 * s, y + 58 * s, 30 * s, 7 * s, color, alpha);
    box(x + 112 * s, y + 46 * s, 28 * s, 42 * s, accent, 0.88);
  } else if (pose === 'walk') {
    box(x + 8 * s, y + 62 * s, 42 * s, 7 * s, color, alpha);
    box(x + 54 * s, y + 66 * s, 52 * s, 7 * s, color, alpha);
  } else if (pose === 'reassure') {
    box(x - 8 * s, y + 58 * s, 58 * s, 7 * s, color, alpha);
    box(x + 54 * s, y + 78 * s, 54 * s, 7 * s, color, alpha);
  } else {
    box(x + 6 * s, y + 62 * s, 44 * s, 7 * s, color, alpha);
    box(x + 54 * s, y + 62 * s, 44 * s, 7 * s, color, alpha);
  }
  box(x + 18 * s, y + 136 * s, 36 * s, 8 * s, color, alpha);
  box(x + 54 * s, y + 136 * s, 42 * s, 8 * s, color, alpha);
  box(x + 18 * s, y + 144 * s, 8 * s, 66 * s, color, alpha);
  box(x + 88 * s, y + 144 * s, 8 * s, 66 * s, color, alpha);
  return cur;
}

function renderCinematic(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const text = [
    scene.title,
    scene.subtitle,
    scene.visual_goal,
    scene.primary_asset,
    scene.cinematic?.setting,
    scene.cinematic?.action,
  ].join(' ').toLowerCase();
  const isPhone = /\b(phone|app|map|tap|location|request)\b/.test(text);
  const isVolunteer = /\b(volunteer|verified|alert|notification)\b/.test(text);
  const isSafe = /\b(safe|well-lit|relief|smile|reassur|walk together)\b/.test(text);
  const isCommunity = /\b(community|neighborhood|families|together|connected city)\b/.test(text);
  const isFinal = /\b(logo|tagline|download|never walk alone|guardian)\b/.test(text) && scene.beat_role === 'summary';

  let cur = isFinal
    ? fb.addSolidBg({ color: '#F8FAFC', dur })
    : fb.addGradientBg({ gradient: ['#030712', '#07111F', '#102238'], dur });
  const box = (x, y, w, h, color, alpha = 1) => {
    const out = fb.next();
    fb.clauses.push(`[${cur}]drawbox=x=${Math.round(x)}:y=${Math.round(y)}:w=${Math.round(w)}:h=${Math.round(h)}:color=${color}@${alpha}:t=fill[${out}]`);
    cur = out;
  };
  const line = (x1, x2, y, color, thickness = 4, alpha = 1) => box(x1, y, Math.max(2, x2 - x1), thickness, color, alpha);

  if (!isFinal) {
    box(0, 0, W, 78, '#000000', 0.72);
    box(0, H - 78, W, 78, '#000000', 0.72);
    box(0, 640, W, 260, '#020617', 0.32);
  }

  if (isFinal) {
    const logo = addTextBlock(fb, cur, {
      text: displayTitle(scene.title || 'Guardian', 4),
      x: 420,
      y: 330,
      width: 1080,
      maxHeight: 130,
      maxSize: 96,
      minSize: 60,
      maxLines: 1,
      align: 'center',
      font: fontFor('display'),
      color: '#0F172A',
      startAt: 0.2,
    });
    cur = logo.output;
    const tagline = addTextBlock(fb, cur, {
      text: scene.subtitle || 'Never Walk Alone. Help Is Nearby.',
      x: 430,
      y: 485,
      width: 1060,
      maxHeight: 110,
      maxSize: 48,
      minSize: 34,
      maxLines: 2,
      align: 'center',
      font: fontFor('bodySemi'),
      color: '#334155',
      startAt: 0.6,
    });
    cur = tagline.output;
    for (let i = 0; i < 3; i++) {
      const labels = ['Download Today', 'Community Verified', 'Safer Together'];
      box(520 + i * 300, 690, 220, 54, i === 1 ? scene.accent_color : '#E2E8F0', i === 1 ? 0.88 : 1);
      const label = addTextBlock(fb, cur, {
        text: labels[i],
        x: 520 + i * 300,
        y: 704,
        width: 220,
        maxHeight: 40,
        maxSize: 22,
        minSize: 18,
        maxLines: 1,
        align: 'center',
        font: fontFor('bodyBold'),
        color: i === 1 ? '#FFFFFF' : '#334155',
        startAt: 0.9 + i * 0.18,
      });
      cur = label.output;
    }
    return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
  }

  if (isPhone) {
    box(760, 130, 400, 790, '#020617', 0.96);
    box(792, 172, 336, 706, '#0F172A', 1);
    box(820, 214, 280, 390, '#102A43', 1);
    line(850, 1070, 300, '#38BDF8', 3, 0.7);
    line(840, 1050, 390, '#60A5FA', 3, 0.55);
    line(885, 1085, 486, '#22C55E', 3, 0.65);
    for (const [px, py] of [[900, 330], [1018, 422], [950, 512]]) {
      box(px - 12, py - 12, 24, 24, '#22C55E', 1);
      box(px - 28, py - 28, 56, 56, '#22C55E', 0.18);
    }
    box(835, 644, 250, 76, '#22C55E', 0.96);
    const button = addTextBlock(fb, cur, {
      text: 'Request Assistance',
      x: 835,
      y: 668,
      width: 250,
      maxHeight: 42,
      maxSize: 24,
      minSize: 18,
      maxLines: 1,
      align: 'center',
      font: fontFor('bodyBold'),
      color: '#FFFFFF',
      startAt: 0.6,
    });
    cur = button.output;
    cur = drawCinematicFigure(fb, cur, { x: 240, y: 610, scale: 1.25, color: '#E5E7EB', accent: scene.accent_color, pose: 'phone' });
  } else if (isVolunteer) {
    cur = drawCinematicFigure(fb, cur, { x: 300, y: 560, scale: 1.35, color: '#E5E7EB', accent: scene.accent_color, pose: 'stand' });
    cur = drawCinematicFigure(fb, cur, { x: 1290, y: 560, scale: 1.35, color: '#CBD5E1', accent: scene.accent_color_2, pose: 'stand' });
    box(610, 260, 700, 290, '#020617', 0.86);
    box(610, 260, 700, 5, scene.accent_color, 0.95);
    const alert = addTextBlock(fb, cur, {
      text: 'Nearby Assistance Request',
      x: 670,
      y: 330,
      width: 580,
      maxHeight: 80,
      maxSize: 48,
      minSize: 34,
      maxLines: 1,
      align: 'center',
      font: fontFor('displaySemi'),
      color: '#FFFFFF',
      startAt: 0.25,
    });
    cur = alert.output;
    const verified = addTextBlock(fb, cur, {
      text: 'Verified Identity  |  Background Check Complete',
      x: 670,
      y: 430,
      width: 580,
      maxHeight: 70,
      maxSize: 28,
      minSize: 22,
      maxLines: 2,
      align: 'center',
      font: fontFor('bodySemi'),
      color: '#86EFAC',
      startAt: 0.6,
    });
    cur = verified.output;
  } else if (isCommunity) {
    for (let i = 0; i < 9; i++) {
      const bx = 120 + i * 200;
      const bh = 120 + (i % 3) * 55;
      box(bx, 700 - bh, 110, bh, '#0F172A', 0.96);
      box(bx + 18, 720 - bh, 18, 22, '#38BDF8', 0.35);
      box(bx + 64, 750 - bh, 18, 22, '#38BDF8', 0.28);
    }
    const nodes = [[330, 430], [620, 520], [930, 395], [1220, 520], [1520, 425]];
    for (let i = 0; i < nodes.length - 1; i++) line(nodes[i][0], nodes[i + 1][0], nodes[i][1], scene.accent_color, 4, 0.55);
    for (const [nx, ny] of nodes) {
      box(nx - 18, ny - 18, 36, 36, '#22C55E', 1);
      box(nx - 46, ny - 46, 92, 92, '#22C55E', 0.12);
    }
    cur = drawCinematicFigure(fb, cur, { x: 420, y: 650, scale: 0.95, color: '#E5E7EB', accent: scene.accent_color, pose: 'walk' });
    cur = drawCinematicFigure(fb, cur, { x: 1320, y: 650, scale: 0.95, color: '#CBD5E1', accent: scene.accent_color_2, pose: 'walk' });
  } else {
    for (const lx of [260, 980, 1600]) {
      box(lx, 250, 10, 450, '#94A3B8', 0.65);
      box(lx - 40, 235, 90, 18, '#FACC15', isSafe ? 0.55 : 0.28);
      box(lx - 80, 250, 170, 170, '#FACC15', isSafe ? 0.06 : 0.035);
    }
    line(0, W, 780, '#334155', 5, 0.55);
    if (isSafe) {
      cur = drawCinematicFigure(fb, cur, { x: 720, y: 560, scale: 1.35, color: '#E5E7EB', accent: scene.accent_color, pose: 'reassure' });
      cur = drawCinematicFigure(fb, cur, { x: 960, y: 560, scale: 1.35, color: '#CBD5E1', accent: scene.accent_color_2, pose: 'reassure' });
      box(610, 470, 700, 210, '#FACC15', 0.035);
    } else {
      cur = drawCinematicFigure(fb, cur, { x: 530, y: 560, scale: 1.35, color: '#E5E7EB', accent: scene.accent_color, pose: 'walk' });
      cur = drawCinematicFigure(fb, cur, { x: 1300, y: 590, scale: 0.92, color: '#94A3B8', accent: '#64748B', pose: 'stand' });
      cur = drawCinematicFigure(fb, cur, { x: 1410, y: 590, scale: 0.92, color: '#94A3B8', accent: '#64748B', pose: 'stand' });
      box(490, 520, 250, 260, '#38BDF8', 0.035);
    }
  }

  if (scene.subtitle && !scene.spoken_captions?.length) {
    const subtitleBlock = addTextBlock(fb, cur, {
      text: scene.subtitle,
      x: 300,
      y: 910,
      width: 1320,
      maxHeight: 90,
      maxSize: 34,
      minSize: 26,
      maxLines: 2,
      align: 'center',
      font: fontFor('body'),
      color: '#E5E7EB',
      alpha: 0.82,
      startAt: 0.4,
    });
    cur = subtitleBlock.output;
  }
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderHero(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  let imageBox = null;

  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    imageBox = box;
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 24,
      y: box.y - 24,
      w: box.w + 48,
      h: box.h + 48,
      color: scene.accent_color,
      alpha: 0.06,
      borderColor: scene.accent_color_2,
      borderAlpha: 0.20,
      borderW: 1,
      startAt: 0.15,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 0,
      float: false,
    });
  }

  if (!ctx.imagePath && scene.lucide_icon_name && ctx.iconPath) {
    const iconSize = 250;
    const pos = positionForLayout(scene.layout, 'icon', scene);
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: pos.x,
      y: pos.y,
      scaleIn: false,
      pulse: false,
    });
  }

  if (scene.title) {
    const title = displayTitle(scene.title);
    const region = imageBox ? imageTextRegion(imageBox) : titleRegion(scene.layout);
    const titleBlock = addTextBlock(fb, cur, {
      text: title,
      x: region.x,
      y: region.y,
      width: region.width,
      maxHeight: 230,
      maxSize: imageBox ? 84 : 104,
      minSize: imageBox ? 42 : 58,
      maxLines: 3,
      align: region.align,
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0.2,
    });
    cur = titleBlock.output;

    if (scene.subtitle && !scene.spoken_captions?.length) {
      const subtitleBlock = addTextBlock(fb, cur, {
        text: scene.subtitle,
        x: region.x,
        y: region.y + titleBlock.layout.height + 28,
        width: region.width,
        maxHeight: 150,
        maxSize: 42,
        minSize: 30,
        maxLines: 3,
        lineHeight: 1.28,
        align: region.align,
        font: fontFor('body'),
        color: scene.text_color,
        alpha: 0.72,
        startAt: 0.55,
      });
      cur = subtitleBlock.output;
    }
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.025, dur: dur });
  cur = addSpokenCaptions(fb, cur, scene);

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderDefinition(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  let imageBox = null;
  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    imageBox = box;
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 18,
      y: box.y - 18,
      w: box.w + 36,
      h: box.h + 36,
      color: scene.accent_color,
      alpha: 0.06,
      borderColor: scene.accent_color,
      borderAlpha: 0.20,
      borderW: 1,
      startAt: 0.1,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 0,
      float: false,
    });
  }

  if (!ctx.imagePath && ctx.iconPath) {
    const iconSize = 240;
    const pos = positionForLayout(scene.layout, 'icon', scene);
    if (scene.layout === 'left' || scene.layout === 'right') {
      const cardX = scene.layout === 'left' ? 80 : W - 480;
      cur = fb.addCard(cur, fb.next(), { x: cardX, y: 200, w: 400, h: 400, color: scene.accent_color, alpha: 0.06, borderColor: scene.accent_color, borderAlpha: 0.20, borderW: 1 });
    }
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: pos.x,
      y: pos.y,
      scaleIn: false,
    });
  }

  if (scene.title) {
    const title = displayTitle(scene.title);
    const region = imageBox ? imageTextRegion(imageBox) : titleRegion(scene.layout);
    const titleBlock = addTextBlock(fb, cur, {
      text: title,
      x: region.x,
      y: region.y,
      width: region.width,
      maxHeight: 210,
      maxSize: imageBox ? 78 : 92,
      minSize: imageBox ? 40 : 52,
      maxLines: 2,
      align: region.align,
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0.3,
    });
    cur = titleBlock.output;

    if (scene.subtitle && !scene.spoken_captions?.length) {
      const subtitleBlock = addTextBlock(fb, cur, {
        text: scene.subtitle,
        x: region.x,
        y: region.y + titleBlock.layout.height + 28,
        width: region.width,
        maxHeight: 150,
        maxSize: 40,
        minSize: 28,
        maxLines: 3,
        lineHeight: 1.3,
        align: region.align,
        font: fontFor('body'),
        color: scene.text_color,
        alpha: 0.72,
        startAt: 0.65,
      });
      cur = subtitleBlock.output;
    }
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.02, dur: dur });
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderCallout(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  let imageBox = null;
  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    imageBox = box;
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 18,
      y: box.y - 18,
      w: box.w + 36,
      h: box.h + 36,
      color: scene.accent_color,
      alpha: 0.06,
      borderColor: scene.accent_color,
      borderAlpha: 0.20,
      borderW: 1,
      startAt: 0.1,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 0,
      float: false,
    });
  }

  const cardX = Math.round(W * 0.12);
  const cardY = Math.round(H * 0.18);
  const cardW = Math.round(W * 0.76);
  const cardH = Math.round(H * 0.64);
  if (!imageBox) {
    cur = fb.addCard(cur, fb.next(), {
      x: cardX, y: cardY, w: cardW, h: cardH,
      color: '#FFFFFF', alpha: 0.04,
      borderColor: '#FFFFFF', borderAlpha: 0.14, borderW: 1,
    });
  }

  if (!imageBox && ctx.iconPath) {
    const iconSize = 180;
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: cardX + (cardW - iconSize) / 2,
      y: cardY + 60,
      scaleIn: false,
      pulse: false,
    });
  }

  if (scene.title) {
    const title = displayTitle(scene.title);
    const region = imageBox
      ? imageTextRegion(imageBox)
      : { x: cardX + 100, y: Math.round(H * 0.52), width: cardW - 200, align: 'center' };
    const titleBlock = addTextBlock(fb, cur, {
      text: title,
      x: region.x,
      y: region.y,
      width: region.width,
      maxHeight: 170,
      maxSize: imageBox ? 76 : 88,
      minSize: imageBox ? 40 : 50,
      maxLines: 3,
      align: region.align,
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0.3,
    });
    cur = titleBlock.output;
    if (scene.subtitle && !scene.spoken_captions?.length) {
      const subtitleBlock = addTextBlock(fb, cur, {
        text: scene.subtitle,
        x: region.x,
        y: region.y + titleBlock.layout.height + 28,
        width: region.width,
        maxHeight: 120,
        maxSize: 38,
        minSize: 28,
        maxLines: 2,
        lineHeight: 1.3,
        align: region.align,
        font: fontFor('body'),
        color: scene.text_color,
        alpha: 0.72,
        startAt: 0.6,
      });
      cur = subtitleBlock.output;
    }
  }
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderStat(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  const statValue = normalizeInlineText(scene.value || '0');
  const valueBlock = addTextBlock(fb, cur, {
    text: statValue,
    x: 180,
    y: 300,
    width: 1560,
    maxHeight: 430,
    maxSize: 360,
    minSize: 150,
    maxLines: 1,
    align: 'center',
    font: fontFor('stat'),
    color: scene.accent_color,
    startAt: 0.2,
  });
  cur = valueBlock.output;

  if (scene.label) {
    const labelBlock = addTextBlock(fb, cur, {
      text: scene.label,
      x: 260,
      y: Math.round(H * 0.80),
      width: 1400,
      maxHeight: 120,
      maxSize: 48,
      minSize: 30,
      maxLines: 2,
      align: 'center',
      font: fontFor('displaySemi'),
      color: scene.text_color,
      alpha: 0.78,
      startAt: 1.3,
    });
    cur = labelBlock.output;
  }

  if (scene.title) {
    const titleBlock = addTextBlock(fb, cur, {
      text: displayTitle(scene.title),
      x: 240,
      y: Math.round(H * 0.10),
      width: 1440,
      maxHeight: 90,
      maxSize: 42,
      minSize: 30,
      maxLines: 1,
      align: 'center',
      font: fontFor('displaySemi'),
      color: scene.text_color,
      alpha: 0.62,
      startAt: 0,
    });
    cur = titleBlock.output;
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.025, dur });
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderProcess(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const titleBlock = addTextBlock(fb, cur, {
      text: displayTitle(scene.title),
      x: 220,
      y: Math.round(H * 0.10),
      width: 1480,
      maxHeight: 110,
      maxSize: 64,
      minSize: 42,
      maxLines: 1,
      align: 'center',
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0,
    });
    cur = titleBlock.output;
  }

  const steps = processStepsFor(scene);
  const n = steps.length;
  const cardW = 300;
  const cardH = 340;
  const gap = Math.round((W - n * cardW) / (n + 1));
  const yTop = Math.round(H * 0.30);

  const stepStart = 0.4;
  const perStep = Math.min(1.0, Math.max(0.25, (dur - 1.2) / Math.max(n + 1, 1)));

  for (let i = 0; i < n; i++) {
    const cx = gap + i * (cardW + gap) + cardW / 2;
    const start = stepStart + i * perStep;
    const end = Math.min(dur - 0.1, start + perStep);

    const boxX = cx - cardW / 2;
    const color2 = palette.colors[i % palette.colors.length] || scene.accent_color;
    const color3 = palette.colors[(i + 1) % palette.colors.length] || scene.accent_color_2;

    cur = addDirectPanel(fb, cur, {
      x: boxX, y: yTop, w: cardW, h: cardH,
      color: '#FFFFFF', alpha: 0.04,
      borderColor: color2, borderAlpha: 0.24, borderW: 1,
      startAt: start,
    });

    if (steps[i].icon && ctx.iconPaths && ctx.iconPaths[steps[i].icon]) {
      const ip = ctx.iconPaths[steps[i].icon];
      const iconSize = 100;
      const ix = cx - iconSize / 2;
      const iy = yTop + 40;
      const next = fb.next();
      cur = fb.addIcon(cur, next, {
        path: ip,
        box: iconSize,
        x: ix,
        y: iy,
        scaleIn: true,
        scaleInDur: 0.4,
        glow: true,
        enable: `between(t,${(start + 0.1).toFixed(2)},${(dur - 0.1).toFixed(2)})`,
      });
    }

    const num = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${i + 1}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${color3}:fontsize=80:x=${cx - 40}:y=${yTop + 150}:enable='between(t,${(start+0.2).toFixed(2)},${(dur-0.1).toFixed(2)})'[${num}]`);
    cur = num;

    const labelBlock = addTextBlock(fb, cur, {
      text: displayTitle(steps[i].label || '', 4),
      x: boxX + 20,
      y: yTop + 238,
      width: cardW - 40,
      maxHeight: 82,
      maxSize: 32,
      minSize: 24,
      maxLines: 2,
      align: 'center',
      font: fontFor('displaySemi'),
      color: scene.text_color,
      startAt: start + 0.3,
    });
    cur = labelBlock.output;

    if (i < n - 1) {
      const ax1 = boxX + cardW + 15;
      const ax2 = boxX + cardW + gap - 15;
      const ay = yTop + cardH / 2;
      const arrow = fb.next();
      fb.clauses.push(
        `[${cur}]drawbox=x=${ax1}:y=${ay - 3}:w=${ax2 - ax1}:h=6:color=${color2}@0.8:t=fill:enable='between(t,${(end).toFixed(2)},${(dur-0.1).toFixed(2)})',` +
        `drawbox=x=${ax2 - 12}:y=${ay - 12}:w=12:h=12:color=${color2}:t=fill:enable='between(t,${(end).toFixed(2)},${(dur-0.1).toFixed(2)})',` +
        `drawbox=x=${ax2 - 18}:y=${ay - 6}:w=18:h=6:color=${color2}:t=fill:enable='between(t,${(end).toFixed(2)},${(dur-0.1).toFixed(2)})'[${arrow}]`
      );
      cur = arrow;
    }
  }

  if (scene.subtitle && !scene.spoken_captions?.length) {
    const subtitleBlock = addTextBlock(fb, cur, {
      text: scene.subtitle,
      x: 260,
      y: Math.round(H * 0.89),
      width: 1400,
      maxHeight: 90,
      maxSize: 32,
      minSize: 26,
      maxLines: 2,
      align: 'center',
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.62,
      startAt: 0.6,
    });
    cur = subtitleBlock.output;
  }
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderTimeline(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const titleBlock = addTextBlock(fb, cur, {
      text: displayTitle(scene.title),
      x: 220,
      y: Math.round(H * 0.12),
      width: 1480,
      maxHeight: 110,
      maxSize: 64,
      minSize: 42,
      maxLines: 1,
      align: 'center',
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0,
    });
    cur = titleBlock.output;
  }

  const ms = milestonesFor(scene);
  const n = ms.length;
  const lineY = Math.round(H * 0.55);
  const lineX1 = Math.round(W * 0.10);
  const lineX2 = Math.round(W * 0.90);

  const line = fb.next();
  fb.clauses.push(`[${cur}]drawbox=x=${lineX1}:y=${lineY - 4}:w=${lineX2 - lineX1}:h=8:color=${scene.accent_color}@0.7:t=fill[${line}]`);
  cur = line;

  const perMs = Math.min(0.7, (dur - 0.6) / Math.max(n, 1));
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(n - 1, 1));
    const cx = Math.round(lineX1 + t * (lineX2 - lineX1));
    const start = 0.4 + i * perMs;
    const end = Math.min(dur - 0.1, start + perMs);
    const dotColor = palette.colors[i % palette.colors.length] || scene.accent_color;

    const dot = fb.next();
    fb.clauses.push(`[${cur}]drawbox=x=${cx - 36}:y=${lineY - 36}:w=72:h=72:color=${dotColor}@0.25:t=fill:enable='between(t,${(start).toFixed(2)},${(dur-0.1).toFixed(2)})',drawbox=x=${cx - 20}:y=${lineY - 20}:w=40:h=40:color=${dotColor}:t=fill:enable='between(t,${(start).toFixed(2)},${(dur-0.1).toFixed(2)})'[${dot}]`);
    cur = dot;

    if (ms[i].year) {
      const y = fb.next();
      fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext((ms[i].year || '').toUpperCase())}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${dotColor}:fontsize=64:x=${cx - 80}:y=${lineY - 150}:enable='between(t,${(start+0.1).toFixed(2)},${(dur-0.1).toFixed(2)})'[${y}]`);
      cur = y;
    }

    if (ms[i].label) {
      const labelY = lineY + 60;
      const labelBlock = addTextBlock(fb, cur, {
        text: displayTitle(ms[i].label || '', 4),
        x: Math.max(60, Math.min(W - 280, cx - 110)),
        y: labelY,
        width: 220,
        maxHeight: 100,
        maxSize: 32,
        minSize: 24,
        maxLines: 2,
        align: 'center',
        font: fontFor('displaySemi'),
        color: scene.text_color,
        startAt: start + 0.15,
      });
      cur = labelBlock.output;
    }
  }

  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderComparison(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const titleBlock = addTextBlock(fb, cur, {
      text: displayTitle(scene.title),
      x: 220,
      y: Math.round(H * 0.08),
      width: 1480,
      maxHeight: 100,
      maxSize: 58,
      minSize: 38,
      maxLines: 1,
      align: 'center',
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0,
    });
    cur = titleBlock.output;
  }

  const left = scene.left || { title: 'Before', points: [], color: '#EF4444', icon: null };
  const right = scene.right || { title: 'After', points: [], color: '#10B981', icon: null };

  const cardW = Math.round(W * 0.40);
  const leftX = Math.round(W * 0.06);
  const rightX = Math.round(W * 0.54);
  const yTop = Math.round(H * 0.20);
  const cardH = Math.round(H * 0.72);

  cur = fb.addCard(cur, fb.next(), { x: leftX, y: yTop, w: cardW, h: cardH, color: left.color, alpha: 0.06, borderColor: left.color, borderAlpha: 0.28, borderW: 1 });
  cur = fb.addCard(cur, fb.next(), { x: rightX, y: yTop, w: cardW, h: cardH, color: right.color, alpha: 0.06, borderColor: right.color, borderAlpha: 0.28, borderW: 1 });

  const lblL = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext(displayTitle(left.title || '', 3))}':fontfile='${fontFor('display')}':fontcolor=${left.color}:fontsize=60:x=${leftX + 50}:y=${yTop + 30}[${lblL}]`);
  cur = lblL;
  const lblR = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext(displayTitle(right.title || '', 3))}':fontfile='${fontFor('display')}':fontcolor=${right.color}:fontsize=60:x=${rightX + 50}:y=${yTop + 30}[${lblR}]`);
  cur = lblR;

  const pointsLeft = (left.points || []).slice(0, 4);
  const pointsRight = (right.points || []).slice(0, 4);
  const perPoint = Math.min(0.4, (dur - 1.2) / Math.max(Math.max(pointsLeft.length, pointsRight.length), 1));

  for (let i = 0; i < pointsLeft.length; i++) {
    const pointBlock = addTextBlock(fb, cur, {
      text: `-  ${pointsLeft[i] || ''}`,
      x: leftX + 50,
      y: yTop + 150 + i * 120,
      width: cardW - 100,
      maxHeight: 90,
      maxSize: 34,
      minSize: 26,
      maxLines: 2,
      lineHeight: 1.25,
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.82,
      startAt: 0.5 + i * perPoint,
    });
    cur = pointBlock.output;
  }
  for (let i = 0; i < pointsRight.length; i++) {
    const pointBlock = addTextBlock(fb, cur, {
      text: `+  ${pointsRight[i] || ''}`,
      x: rightX + 50,
      y: yTop + 150 + i * 120,
      width: cardW - 100,
      maxHeight: 90,
      maxSize: 34,
      minSize: 26,
      maxLines: 2,
      lineHeight: 1.25,
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.82,
      startAt: 0.7 + i * perPoint,
    });
    cur = pointBlock.output;
  }

  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderSummary(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const titleBlock = addTextBlock(fb, cur, {
      text: displayTitle(scene.title),
      x: 220,
      y: Math.round(H * 0.10),
      width: 1480,
      maxHeight: 110,
      maxSize: 64,
      minSize: 42,
      maxLines: 1,
      align: 'center',
      font: titleFontFor(scene),
      color: scene.text_color,
      accent: scene.accent_color,
      startAt: 0,
    });
    cur = titleBlock.output;
  }

  const takeaways = (scene.takeaways || []).slice(0, 3);
  const n = takeaways.length;
  const cardW = 460;
  const cardH = Math.round(H * 0.55);
  const totalW = n * cardW + (n - 1) * 80;
  const startX = Math.round((W - totalW) / 2);
  const yTop = Math.round(H * 0.30);

  for (let i = 0; i < n; i++) {
    const cx = startX + i * (cardW + 80);
    const start = 0.4 + i * 0.25;
    const c2 = palette.colors[i % palette.colors.length] || scene.accent_color;
    const c3 = palette.colors[(i + 2) % palette.colors.length] || scene.accent_color_3;

    cur = fb.addCard(cur, fb.next(), {
      x: cx, y: yTop, w: cardW, h: cardH,
      color: '#FFFFFF', alpha: 0.04,
      borderColor: c2, borderAlpha: 0.24, borderW: 1,
      startAt: start, endAt: dur - 0.1,
    });

    const num = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${i + 1}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${c3}:fontsize=140:x=${cx + 30}:y=${yTop + 30}:enable='between(t,${(start+0.05).toFixed(2)},${(dur-0.1).toFixed(2)})'[${num}]`);
    cur = num;

    if (takeaways[i].icon && ctx.iconPaths && ctx.iconPaths[takeaways[i].icon]) {
      const ip = ctx.iconPaths[takeaways[i].icon];
      const next = fb.next();
      cur = fb.addIcon(cur, next, {
        path: ip,
        box: 80,
        x: cx + cardW - 100,
        y: yTop + 30,
        scaleIn: true,
        scaleInDur: 0.3,
        glow: true,
        enable: `between(t,${(start+0.2).toFixed(2)},${(dur-0.1).toFixed(2)})`,
      });
    }

    const textBlock = addTextBlock(fb, cur, {
      text: takeaways[i].text || '',
      x: cx + 30,
      y: yTop + 250,
      width: cardW - 60,
      maxHeight: cardH - 280,
      maxSize: 32,
      minSize: 24,
      maxLines: 5,
      lineHeight: 1.3,
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.82,
      startAt: start + 0.25,
    });
    cur = textBlock.output;
  }

  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function addDirectPanel(fb, input, {
  x, y, w, h, color = '#FFFFFF', alpha = 0.06,
  borderColor = '#FFFFFF', borderAlpha = 0.18, borderW = 2,
  startAt = 0,
}) {
  const out = fb.next();
  const enable = startAt > 0 ? `:enable='gte(t,${startAt.toFixed(2)})'` : '';
  fb.clauses.push(
    `[${input}]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@${alpha}:t=fill${enable},` +
    `drawbox=x=${x}:y=${y}:w=${w}:h=${borderW}:color=${borderColor}@${borderAlpha}:t=fill${enable},` +
    `drawbox=x=${x}:y=${y + h - borderW}:w=${w}:h=${borderW}:color=${borderColor}@${borderAlpha}:t=fill${enable},` +
    `drawbox=x=${x}:y=${y}:w=${borderW}:h=${h}:color=${borderColor}@${borderAlpha}:t=fill${enable},` +
    `drawbox=x=${x + w - borderW}:y=${y}:w=${borderW}:h=${h}:color=${borderColor}@${borderAlpha}:t=fill${enable}[${out}]`
  );
  return out;
}

function addEducationalTitle(fb, input, scene) {
  if (!scene.title) return input;
  return addTextBlock(fb, input, {
    text: displayTitle(scene.title),
    x: 180,
    y: 120,
    width: 1560,
    maxHeight: 100,
    maxSize: 62,
    minSize: 38,
    maxLines: 1,
    align: 'center',
    font: titleFontFor(scene),
    color: scene.text_color,
    accent: scene.accent_color,
    startAt: 0.05,
  }).output;
}

function addFlowArrow(fb, input, x1, x2, y, color, startAt) {
  const out = fb.next();
  const timing = `enable='gte(t,${startAt.toFixed(2)})'`;
  fb.clauses.push(
    `[${input}]drawbox=x=${x1}:y=${y - 3}:w=${Math.max(8, x2 - x1 - 16)}:h=6:color=${color}@0.78:t=fill:${timing},` +
    `drawbox=x=${x2 - 16}:y=${y - 10}:w=16:h=20:color=${color}@0.78:t=fill:${timing}[${out}]`
  );
  return out;
}

function renderConcept(scene, ctx) {
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, ctx.palette), dur: ctx.durSec });
  cur = addDecorations(fb, cur, scene, ctx.palette);
  cur = addEducationalTitle(fb, cur, scene);

  const items = (scene.concept_items || []).slice(0, 5);
  const n = Math.max(2, items.length);
  const gap = 34;
  const cardW = Math.min(340, Math.floor((W - 240 - gap * (n - 1)) / n));
  const totalW = cardW * n + gap * (n - 1);
  const startX = Math.round((W - totalW) / 2);
  const y = 310;
  const cardH = 430;

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const start = 0.25 + i * 0.35;
    const color = ctx.palette.colors[i % ctx.palette.colors.length] || scene.accent_color;
    const raw = items[i] || `Stage ${i + 1}`;
    const [name, ...detailParts] = raw.split(':');
    const detail = detailParts.join(':').trim();
    cur = addDirectPanel(fb, cur, {
      x, y, w: cardW, h: cardH,
      color, alpha: 0.06, borderColor: color, borderAlpha: 0.35, startAt: start,
    });

    const label = addTextBlock(fb, cur, {
      text: name,
      x: x + 22,
      y: y + 32,
      width: cardW - 44,
      maxHeight: 70,
      maxSize: 34,
      minSize: 24,
      maxLines: 2,
      align: 'center',
      font: fontFor('displaySemi'),
      color,
      startAt: start + 0.08,
    });
    cur = label.output;

    const symbolText = detail || String(i + 1).padStart(2, '0');
    const symbol = addTextBlock(fb, cur, {
      text: symbolText,
      x: x + 22,
      y: y + 175,
      width: cardW - 44,
      maxHeight: 150,
      maxSize: i === 0 ? 86 : 44,
      minSize: 26,
      maxLines: 3,
      align: 'center',
      font: detail ? fontFor('bodyBold') : fontFor('stat'),
      color: scene.text_color,
      startAt: start + 0.18,
    });
    cur = symbol.output;

    if (i >= 2) {
      for (let layer = 0; layer < Math.min(3, i); layer++) {
        const cube = fb.next();
        const inset = 74 + layer * 12;
        fb.clauses.push(
          `[${cur}]drawbox=x=${x + inset}:y=${y + 278 - layer * 10}:w=${cardW - inset * 2}:h=82:` +
          `color=${color}@${0.08 + layer * 0.04}:t=fill:enable='gte(t,${(start + 0.25).toFixed(2)})'[${cube}]`
        );
        cur = cube;
      }
    }

    if (i < n - 1) {
      cur = addFlowArrow(fb, cur, x + cardW + 5, x + cardW + gap - 5, y + cardH / 2, color, start + 0.28);
    }
  }

  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderCode(scene, ctx) {
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, ctx.palette), dur: ctx.durSec });
  cur = addDecorations(fb, cur, scene, ctx.palette);
  cur = addEducationalTitle(fb, cur, scene);

  const panelX = 100;
  const panelY = 255;
  const panelW = 1040;
  const panelH = 610;
  cur = addDirectPanel(fb, cur, {
    x: panelX, y: panelY, w: panelW, h: panelH,
    color: '#020617', alpha: 0.72,
    borderColor: scene.accent_color, borderAlpha: 0.38,
  });

  const topBar = fb.next();
  fb.clauses.push(
    `[${cur}]drawbox=x=${panelX}:y=${panelY}:w=${panelW}:h=62:color=${scene.accent_color}@0.18:t=fill,` +
    `drawbox=x=${panelX + 24}:y=${panelY + 24}:w=14:h=14:color=#EF4444:t=fill,` +
    `drawbox=x=${panelX + 50}:y=${panelY + 24}:w=14:h=14:color=#FACC15:t=fill,` +
    `drawbox=x=${panelX + 76}:y=${panelY + 24}:w=14:h=14:color=#22C55E:t=fill[${topBar}]`
  );
  cur = topBar;

  const lines = (scene.code_lines || []).slice(0, 8);
  for (let i = 0; i < lines.length; i++) {
    const start = 0.25 + i * 0.18;
    const number = fb.next();
    cur = fb.addText(cur, number, {
      text: String(i + 1),
      x: panelX + 28,
      y: panelY + 92 + i * 58,
      font: fontFor('body'),
      color: scene.accent_color_2,
      size: 25,
      alpha: 0.60,
      startAt: start,
      endAt: 999,
    });
    const codeLine = addTextBlock(fb, cur, {
      text: lines[i],
      x: panelX + 78,
      y: panelY + 88 + i * 58,
      width: panelW - 110,
      maxHeight: 48,
      maxSize: 30,
      minSize: 22,
      maxLines: 1,
      font: fontFor('bodySemi'),
      color: i === lines.length - 1 ? scene.accent_color_3 : scene.text_color,
      startAt: start,
    });
    cur = codeLine.output;
  }

  const outputX = 1220;
  cur = addDirectPanel(fb, cur, {
    x: outputX, y: panelY, w: 600, h: panelH,
    color: scene.accent_color, alpha: 0.05,
    borderColor: scene.accent_color_2, borderAlpha: 0.30,
    startAt: 0.55,
  });
  const outputTitle = addTextBlock(fb, cur, {
    text: 'RESULT',
    x: outputX + 40,
    y: panelY + 42,
    width: 520,
    maxHeight: 60,
    maxSize: 34,
    minSize: 26,
    maxLines: 1,
    align: 'center',
    font: fontFor('displaySemi'),
    color: scene.accent_color_2,
    startAt: 0.65,
  });
  cur = outputTitle.output;

  const rows = 4;
  const cols = 5;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = fb.next();
      const color = ctx.palette.colors[(row + col) % ctx.palette.colors.length] || scene.accent_color;
      fb.clauses.push(
        `[${cur}]drawbox=x=${outputX + 95 + col * 82}:y=${panelY + 180 + row * 78}:w=56:h=52:` +
        `color=${color}@${0.28 + (row + col) * 0.02}:t=fill:enable='gte(t,${(0.8 + row * 0.12 + col * 0.04).toFixed(2)})'[${cell}]`
      );
      cur = cell;
    }
  }

  const outputLabel = addTextBlock(fb, cur, {
    text: displayTitle(scene.result_label || scene.subtitle || 'Generated output', 4),
    x: outputX + 55,
    y: panelY + 535,
    width: 490,
    maxHeight: 42,
    maxSize: 30,
    minSize: 24,
    maxLines: 1,
    align: 'center',
    font: fontFor('bodyBold'),
    color: scene.text_color,
    startAt: 1.25,
  });
  cur = outputLabel.output;
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderArchitecture(scene, ctx) {
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, ctx.palette), dur: ctx.durSec });
  cur = addDecorations(fb, cur, scene, ctx.palette);
  cur = addEducationalTitle(fb, cur, scene);

  const layers = (scene.layers || []).slice(0, 6);
  const n = Math.max(2, layers.length);
  const cardW = Math.min(270, Math.floor((W - 260) / n) - 34);
  const gap = 34;
  const totalW = cardW * n + gap * (n - 1);
  const startX = Math.round((W - totalW) / 2);
  const y = 355;
  const h = 320;

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const start = 0.25 + i * 0.30;
    const color = ctx.palette.colors[i % ctx.palette.colors.length] || scene.accent_color;
    cur = addDirectPanel(fb, cur, {
      x, y, w: cardW, h,
      color, alpha: i === n - 1 ? 0.12 : 0.06,
      borderColor: color, borderAlpha: 0.42, startAt: start,
    });

    for (let node = 0; node < 4; node++) {
      const dot = fb.next();
      const size = 28;
      const nx = x + Math.round(cardW / 2) - size / 2;
      const ny = y + 38 + node * 56;
      fb.clauses.push(
        `[${cur}]drawbox=x=${nx}:y=${ny}:w=${size}:h=${size}:color=${color}@0.88:t=fill:` +
        `enable='gte(t,${(start + node * 0.06).toFixed(2)})'[${dot}]`
      );
      cur = dot;
    }

    const label = addTextBlock(fb, cur, {
      text: layers[i] || `Layer ${i + 1}`,
      x: x + 18,
      y: y + 262,
      width: cardW - 36,
      maxHeight: 52,
      maxSize: 30,
      minSize: 22,
      maxLines: 2,
      align: 'center',
      font: fontFor('displaySemi'),
      color: scene.text_color,
      startAt: start + 0.12,
    });
    cur = label.output;

    if (i < n - 1) {
      cur = addFlowArrow(fb, cur, x + cardW + 4, x + cardW + gap - 4, y + h / 2, color, start + 0.22);
    }
  }

  if (scene.subtitle && !scene.spoken_captions?.length) {
    cur = addTextBlock(fb, cur, {
      text: scene.subtitle,
      x: 300,
      y: 760,
      width: 1320,
      maxHeight: 80,
      maxSize: 34,
      minSize: 26,
      maxLines: 2,
      align: 'center',
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.72,
      startAt: 0.7,
    }).output;
  }
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderFormula(scene, ctx) {
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, ctx.palette), dur: ctx.durSec });
  cur = addDecorations(fb, cur, scene, ctx.palette);
  cur = addEducationalTitle(fb, cur, scene);

  cur = addDirectPanel(fb, cur, {
    x: 110, y: 300, w: 800, h: 430,
    color: scene.accent_color, alpha: 0.07,
    borderColor: scene.accent_color, borderAlpha: 0.35,
  });
  const formula = addFormulaBlock(fb, cur, {
    text: normalizeInlineText(scene.formula || scene.subtitle || scene.title || 'Relationship'),
    x: 155,
    y: 335,
    width: 710,
    maxHeight: 360,
    maxSize: 60,
    minSize: 18,
    maxLines: 5,
    font: fontFor('displaySemi'),
    color: scene.text_color,
    startAt: 0.2,
  });
  cur = formula.output;

  const graphX = 1080;
  const graphY = 300;
  const graphW = 720;
  const graphH = 430;
  cur = addDirectPanel(fb, cur, {
    x: graphX, y: graphY, w: graphW, h: graphH,
    color: '#FFFFFF', alpha: 0.025,
    borderColor: scene.accent_color_2, borderAlpha: 0.25,
    startAt: 0.25,
  });
  const axes = fb.next();
  const originX = graphX + 300;
  const originY = graphY + 300;
  fb.clauses.push(
    `[${cur}]drawbox=x=${graphX + 70}:y=${originY}:w=${graphW - 140}:h=3:color=#FFFFFF@0.45:t=fill,` +
    `drawbox=x=${originX}:y=${graphY + 55}:w=3:h=${graphH - 105}:color=#FFFFFF@0.45:t=fill,` +
    `drawbox=x=${graphX + 90}:y=${originY - 3}:w=${originX - graphX - 90}:h=7:color=${scene.accent_color}@0.85:t=fill[${axes}]`
  );
  cur = axes;

  for (let i = 0; i < 7; i++) {
    const segment = fb.next();
    const sx = originX + i * 46;
    const sy = originY - i * 38;
    fb.clauses.push(
      `[${cur}]drawbox=x=${sx}:y=${sy}:w=54:h=8:color=${scene.accent_color_2}@0.95:t=fill:` +
      `enable='gte(t,${(0.55 + i * 0.08).toFixed(2)})'[${segment}]`
    );
    cur = segment;
  }

  const blocked = addTextBlock(fb, cur, {
    text: 'INPUT',
    x: graphX + 70,
    y: graphY + 350,
    width: 280,
    maxHeight: 40,
    maxSize: 24,
    minSize: 20,
    maxLines: 1,
    align: 'center',
    font: fontFor('bodyBold'),
    color: scene.accent_color,
    startAt: 0.7,
  });
  cur = blocked.output;
  const passed = addTextBlock(fb, cur, {
    text: 'OUTPUT',
    x: graphX + 380,
    y: graphY + 90,
    width: 270,
    maxHeight: 40,
    maxSize: 24,
    minSize: 20,
    maxLines: 1,
    align: 'center',
    font: fontFor('bodyBold'),
    color: scene.accent_color_2,
    startAt: 1.0,
  });
  cur = passed.output;
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderPrediction(scene, ctx) {
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, ctx.palette), dur: ctx.durSec });
  cur = addDecorations(fb, cur, scene, ctx.palette);
  cur = addEducationalTitle(fb, cur, scene);

  const steps = (scene.flow_steps || []).slice(0, 6);
  const n = Math.max(3, steps.length);
  const cardW = Math.min(270, Math.floor((W - 220) / n) - 28);
  const gap = 28;
  const totalW = cardW * n + gap * (n - 1);
  const startX = Math.round((W - totalW) / 2);
  const y = 390;
  const h = 250;

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const start = 0.25 + i * 0.28;
    const isFinal = i === n - 1;
    const color = isFinal ? '#22C55E' : (ctx.palette.colors[i % ctx.palette.colors.length] || scene.accent_color);
    cur = addDirectPanel(fb, cur, {
      x, y, w: cardW, h,
      color, alpha: isFinal ? 0.16 : 0.06,
      borderColor: color, borderAlpha: isFinal ? 0.65 : 0.36,
      borderW: isFinal ? 4 : 2,
      startAt: start,
    });

    const indexText = fb.next();
    cur = fb.addText(cur, indexText, {
      text: String(i + 1).padStart(2, '0'),
      x: x + 24,
      y: y + 28,
      font: fontFor('stat'),
      color,
      size: 52,
      alpha: 0.78,
      startAt: start,
      endAt: 999,
    });
    cur = addTextBlock(fb, cur, {
      text: steps[i] || `Step ${i + 1}`,
      x: x + 20,
      y: y + 130,
      width: cardW - 40,
      maxHeight: 70,
      maxSize: 30,
      minSize: 22,
      maxLines: 2,
      align: 'center',
      font: fontFor('displaySemi'),
      color: scene.text_color,
      startAt: start + 0.10,
    }).output;

    if (i < n - 1) {
      cur = addFlowArrow(fb, cur, x + cardW + 3, x + cardW + gap - 3, y + h / 2, color, start + 0.18);
    }
  }

  const result = addTextBlock(fb, cur, {
    text: displayTitle(scene.result_label || scene.subtitle || 'Input to result', 6),
    x: 350,
    y: 745,
    width: 1220,
    maxHeight: 90,
    maxSize: 48,
    minSize: 34,
    maxLines: 1,
    align: 'center',
    font: fontFor('playful'),
    color: '#22C55E',
    startAt: 1.25,
  });
  cur = result.output;
  cur = addSpokenCaptions(fb, cur, scene);
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function appendPresenterOverlay(result, scene) {
  const presenter = scene.presenter;
  if (!presenter || presenter.enabled === false) return result;
  const finalMatch = result.filterGraph.match(/\[([^\]]+)\]\s*$/);
  if (!finalMatch) return result;

  let input = finalMatch[1];
  let idx = 0;
  const next = () => `presenter_${idx++}`;
  const clauses = [];
  const accent = scene.accent_color || '#3B82F6';
  const accent2 = scene.accent_color_2 || '#8B5CF6';
  const textColor = scene.text_color || '#FFFFFF';
  const isLeft = presenter.position === 'left';
  const cardHeavy = ['process', 'diagram', 'network', 'data_flow'].includes(scene.scene_type);
  const x = isLeft ? 48 : W - 250;
  const y = 680;
  const stick = '#FFFFFF';

  const draw = (expr) => {
    const out = next();
    clauses.push(`[${input}]${expr}[${out}]`);
    input = out;
  };
  const box = (bx, by, bw, bh, color = stick, alpha = 1) => {
    draw(`drawbox=x=${Math.round(bx)}:y=${Math.round(by)}:w=${Math.round(bw)}:h=${Math.round(bh)}:color=${color}@${alpha}:t=fill`);
  };

  // Soft stage keeps the character visible without stealing focus.
  box(x - 26, y - 32, 292, 342, '#000000', 0.18);
  box(x - 24, y - 30, 288, 338, accent, 0.08);
  box(x - 24, y - 30, 288, 4, accent, 0.45);

  const headX = x + 90;
  const headY = y + 18;
  box(headX, headY, 78, 78, stick, 1);
  box(headX + 18, headY + 30, 10, 10, '#020617', 1);
  box(headX + 50, headY + 30, 10, 10, '#020617', 1);

  const mouthY = presenter.emotion === 'concerned' || presenter.emotion === 'serious'
    ? headY + 58
    : headY + 62;
  box(headX + 28, mouthY, 26, 6, '#020617', 1);

  const bodyX = x + 129;
  box(bodyX - 5, y + 100, 10, 108, stick, 1);

  const gesture = presenter.gesture || 'explain';
  if (gesture === 'point') {
    box(bodyX - 4, y + 128, 8, 56, stick, 1);
    if (isLeft) {
      box(bodyX, y + 130, 96, 8, stick, 1);
      box(bodyX - 58, y + 165, 58, 8, stick, 1);
    } else {
      box(bodyX - 96, y + 130, 96, 8, stick, 1);
      box(bodyX, y + 165, 58, 8, stick, 1);
    }
  } else if (gesture === 'alert' || gesture === 'celebrate') {
    box(bodyX - 84, y + 88, 8, 76, stick, 1);
    box(bodyX + 76, y + 88, 8, 76, stick, 1);
    box(bodyX - 84, y + 88, 52, 8, stick, 1);
    box(bodyX + 32, y + 88, 52, 8, stick, 1);
  } else if (gesture === 'think') {
    box(bodyX - 76, y + 130, 70, 8, stick, 1);
    box(bodyX + 44, y + 82, 8, 58, stick, 1);
  } else {
    box(bodyX - 74, y + 132, 74, 8, stick, 1);
    box(bodyX, y + 132, 74, 8, stick, 1);
  }

  box(bodyX - 70, y + 208, 70, 8, stick, 1);
  box(bodyX, y + 208, 70, 8, stick, 1);
  box(bodyX - 70, y + 216, 8, 70, stick, 1);
  box(bodyX + 62, y + 216, 8, 70, stick, 1);
  if (gesture === 'walk') {
    box(bodyX - 106, y + 250, 44, 8, stick, 1);
    box(bodyX + 62, y + 250, 54, 8, stick, 1);
  }

  const speech = String(presenter.speech || scene.subtitle || scene.title || '').trim();
  if (speech && !cardHeavy) {
    const bubbleW = 430;
    const bubbleX = isLeft ? x + 292 : x - bubbleW - 34;
    const bubbleY = y - 34;
    const layout = fitTextBlock(speech, {
      maxWidth: bubbleW - 56,
      maxHeight: 118,
      maxSize: 30,
      minSize: 22,
      maxLines: 3,
      lineHeight: 1.16,
    });
    const bubbleH = Math.max(96, layout.height + 40);
    box(bubbleX, bubbleY, bubbleW, bubbleH, '#020617', 0.84);
    box(bubbleX, bubbleY, bubbleW, 4, accent2, 0.88);
    box(bubbleX, bubbleY + bubbleH - 4, bubbleW, 4, accent, 0.55);
    box(isLeft ? bubbleX - 18 : bubbleX + bubbleW, bubbleY + bubbleH - 38, 18, 18, accent2, 0.85);

    let textInput = input;
    const textBlock = addTextBlock(
      { next, clauses, addText: (inp, out, opts) => {
        const parts = [
          `text='${escapeDrawtext(opts.text)}'`,
          `fontcolor=${opts.color}`,
          `fontsize=${opts.size}`,
          `x=${opts.x}`,
          `y=${opts.y}`,
        ];
        if (opts.font) parts.splice(3, 0, `fontfile='${opts.font}'`);
        clauses.push(`[${inp}]drawtext=${parts.join(':')}[${out}]`);
        return out;
      }},
      textInput,
      {
        text: speech,
        x: bubbleX + 28,
        y: bubbleY + 20,
        width: bubbleW - 56,
        maxHeight: 118,
        maxSize: 30,
        minSize: 22,
        maxLines: 3,
        lineHeight: 1.16,
        align: 'center',
        font: fontFor('bodyBold'),
        color: textColor,
        startAt: 0,
        stagger: 0,
        fadeInDur: 0,
      }
    );
    input = textBlock.output;
  }

  return {
    ...result,
    filterGraph: `${result.filterGraph};${clauses.join(';')}`,
  };
}

const RENDERERS = {
  hero: renderHero,
  visual_metaphor: renderHero,
  definition: renderDefinition,
  callout: renderCallout,
  stat: renderStat,
  process: renderProcess,
  network: renderProcess,
  data_flow: renderProcess,
  diagram: renderProcess,
  timeline: renderTimeline,
  comparison: renderComparison,
  relationship: renderComparison,
  summary: renderSummary,
  concept: renderConcept,
  code: renderCode,
  architecture: renderArchitecture,
  formula: renderFormula,
  prediction: renderPrediction,
};

export function renderSceneType(scene, ctx) {
  const fn = RENDERERS[scene.scene_type] || RENDERERS.definition;
  return appendPresenterOverlay(fn(scene, ctx), scene);
}
