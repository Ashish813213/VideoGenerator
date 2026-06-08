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

  const steps = scene.steps || [];
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

    const card = fb.next();
    cur = fb.addCard(cur, card, {
      x: boxX, y: yTop, w: cardW, h: cardH,
      color: '#FFFFFF', alpha: 0.04,
      borderColor: color2, borderAlpha: 0.24, borderW: 1,
      startAt: start, endAt: dur - 0.1,
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

  const ms = scene.milestones || [];
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
};

export function renderSceneType(scene, ctx) {
  const fn = RENDERERS[scene.scene_type] || RENDERERS.definition;
  return fn(scene, ctx);
}
