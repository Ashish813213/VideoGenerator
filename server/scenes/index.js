import { FilterBuilder, W, H, FPS, ICON_BOX, splitWords, wrapWords, parseStatValue, escapeDrawtext } from './base.js';
import { FONTS, COLORS, GRADIENTS, paletteFor } from '../design.js';
import { existsSync } from 'node:fs';

function fontFor(kind) {
  if (kind === 'display') return FONTS.display || FONTS.bodyBold;
  if (kind === 'displaySemi') return FONTS.displaySemi || FONTS.bodySemi;
  if (kind === 'stat') return FONTS.stat || FONTS.display;
  if (kind === 'body') return FONTS.body || FONTS.bodyBold;
  return FONTS.bodyBold;
}

function gradientFor(scene, palette) {
  return palette.gradient || GRADIENTS.dark;
}

function addDecorations(fb, cur, scene, palette) {
  const dec = scene.decorative || [];
  const decColor = scene.decorative_color || scene.accent_color;

  for (const el of dec) {
    if (el === 'floating_circles') {
      cur = fb.addCircle(cur, fb.next(), { x: 250, y: 200, r: 80, color: decColor, alpha: 0.18, float: true, floatDur: 6 });
      cur = fb.addCircle(cur, fb.next(), { x: W - 280, y: H - 220, r: 120, color: palette.colors[1] || decColor, alpha: 0.12, float: true, floatDur: 7 });
      cur = fb.addCircle(cur, fb.next(), { x: W - 400, y: 320, r: 40, color: palette.colors[2] || decColor, alpha: 0.25, float: true, floatDur: 5 });
    } else if (el === 'blobs') {
      cur = fb.addBlob(cur, fb.next(), { x: 200, y: 800, w: 500, h: 500, color: decColor, alpha: 0.22, blur: 40, float: true });
      cur = fb.addBlob(cur, fb.next(), { x: W - 300, y: 200, w: 600, h: 600, color: palette.colors[1] || decColor, alpha: 0.18, blur: 50, float: true });
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
      cur = fb.addLine(cur, fb.next(), { x1: 100, y1: 100, x2: 400, y2: 250, color: decColor, thickness: 2, alpha: 0.4 });
      cur = fb.addLine(cur, fb.next(), { x1: W - 500, y1: H - 200, x2: W - 100, y2: H - 350, color: palette.colors[1] || decColor, thickness: 2, alpha: 0.4 });
    } else if (el === 'grid') {
      cur = fb.addGrid(cur, fb.next(), { size: 100, color: decColor, alpha: 0.05 });
    } else if (el === 'pulse') {
      cur = fb.addGlowDot(cur, fb.next(), { x: W - 150, y: 150, size: 14, color: decColor, pulse: true });
    } else if (el === 'sweep') {
      cur = fb.addLightSweep(cur, fb.next(), { color: '#FFFFFF', alpha: 0.10, dur: 0.7, startAt: 0.8 });
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
      cur = fb.addLine(cur, fb.next(), { x1: 0, y1: 0, x2: W, y2: H, color: decColor, thickness: 1, alpha: 0.15 });
      cur = fb.addLine(cur, fb.next(), { x1: W, y1: 0, x2: 0, y2: H, color: palette.colors[1] || decColor, thickness: 1, alpha: 0.15 });
    }
  }
  return cur;
}

function textSizeFor(scene, kind) {
  const level1 = { hero: 180, definition: 180, callout: 150, stat: 180, process: 92, timeline: 92, comparison: 92, summary: 92 };
  const level2 = { hero: 70, definition: 60, callout: 56, stat: 60, process: 50, timeline: 48, comparison: 52, summary: 50 };
  if (kind === 'title') {
    const s = level1[scene.scene_type] || 160;
    if (scene.scene_type === 'stat') return 80;
    return s;
  }
  if (kind === 'subtitle') {
    return level2[scene.scene_type] || 56;
  }
  if (kind === 'description') return 38;
  if (kind === 'label') return 48;
  return 56;
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
  if (layout === 'top') return { x: 560, y: 250, w: 800, h: 420 };
  if (layout === 'bottom') return { x: 560, y: 180, w: 800, h: 420 };
  if (layout === 'split') return { x: 960, y: 220, w: 780, h: 540 };
  if (layout === 'grid') return { x: 1020, y: 220, w: 660, h: 520 };
  return { x: 980, y: 230, w: 700, h: 500 };
}

function renderHero(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });

  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 24,
      y: box.y - 24,
      w: box.w + 48,
      h: box.h + 48,
      color: scene.accent_color,
      alpha: 0.10,
      borderColor: scene.accent_color_2,
      borderAlpha: 0.30,
      borderW: 3,
      startAt: 0.15,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 6,
      float: true,
      scaleIn: true,
      scaleInDur: 0.6,
    });
  }

  if (scene.lucide_icon_name && ctx.iconPath) {
    const iconSize = 320;
    const pos = positionForLayout(scene.layout, 'icon', scene);
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: pos.x,
      y: pos.y,
      scaleIn: true,
      scaleInDur: 0.5,
      pulse: true,
      glow: true,
    });
  }

  if (scene.title) {
    const next = fb.next();
    const titleSize = textSizeFor(scene, 'title');
    const pos = positionForLayout(scene.layout, 'title', scene);
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: pos.x,
      y: pos.y,
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: titleSize,
      startAt: 0.2,
      endAt: dur - 0.2,
    });
  }

  if (scene.subtitle) {
    const next = fb.next();
    const pos = positionForLayout(scene.layout, 'subtitle', scene);
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: pos.x,
      y: pos.y,
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.85,
      size: textSizeFor(scene, 'subtitle'),
      startAt: 0.6,
      endAt: dur - 0.2,
    });
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.05, dur: dur });

  const final = fb.next();
  fb.fadeOut(cur, final, { start: Math.max(0, dur - 0.3), dur: 0.3 });

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderDefinition(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 18,
      y: box.y - 18,
      w: box.w + 36,
      h: box.h + 36,
      color: scene.accent_color,
      alpha: 0.09,
      borderColor: scene.accent_color,
      borderAlpha: 0.35,
      borderW: 2,
      startAt: 0.1,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 4,
      float: true,
      scaleIn: true,
      scaleInDur: 0.5,
    });
  }

  if (ctx.iconPath) {
    const iconSize = 240;
    const pos = positionForLayout(scene.layout, 'icon', scene);
    if (scene.layout === 'left' || scene.layout === 'right') {
      const cardX = scene.layout === 'left' ? 80 : W - 480;
      cur = fb.addCard(cur, fb.next(), { x: cardX, y: 200, w: 400, h: 400, color: scene.accent_color, alpha: 0.10, borderColor: scene.accent_color, borderAlpha: 0.40, borderW: 3 });
    }
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: pos.x,
      y: pos.y,
      scaleIn: true,
      scaleInDur: 0.5,
      glow: true,
    });
  }

  if (scene.title) {
    const next = fb.next();
    const pos = positionForLayout(scene.layout, 'title', scene);
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: pos.x,
      y: pos.y,
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: textSizeFor(scene, 'title'),
      startAt: 0.3,
      endAt: dur - 0.1,
    });
  }

  if (scene.subtitle) {
    const next = fb.next();
    const pos = positionForLayout(scene.layout, 'subtitle', scene);
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: pos.x,
      y: pos.y,
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.85,
      size: textSizeFor(scene, 'subtitle'),
      startAt: 0.7,
      endAt: dur - 0.1,
    });
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.04, dur: dur });
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderCallout(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (ctx.imagePath) {
    const box = imageBoxForLayout(scene.layout);
    cur = fb.addCard(cur, fb.next(), {
      x: box.x - 18,
      y: box.y - 18,
      w: box.w + 36,
      h: box.h + 36,
      color: scene.accent_color,
      alpha: 0.10,
      borderColor: scene.accent_color,
      borderAlpha: 0.40,
      borderW: 3,
      startAt: 0.1,
      endAt: dur - 0.1,
    });
    cur = fb.addImage(cur, fb.next(), {
      path: ctx.imagePath,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      blur: 5,
      float: true,
      scaleIn: true,
      scaleInDur: 0.5,
    });
  }

  const cardX = Math.round(W * 0.12);
  const cardY = Math.round(H * 0.18);
  const cardW = Math.round(W * 0.76);
  const cardH = Math.round(H * 0.64);
  cur = fb.addCard(cur, fb.next(), {
    x: cardX, y: cardY, w: cardW, h: cardH,
    color: scene.accent_color, alpha: 0.10,
    borderColor: scene.accent_color, borderAlpha: 0.50, borderW: 3,
  });

  if (ctx.iconPath) {
    const iconSize = 180;
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: iconSize,
      x: cardX + (cardW - iconSize) / 2,
      y: cardY + 60,
      scaleIn: true,
      scaleInDur: 0.5,
      pulse: true,
      glow: true,
    });
  }

  if (scene.title) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.52),
      font: fontFor('display'),
      color: scene.accent_color,
      glowColor: scene.accent_color,
      size: 130,
      startAt: 0.3,
      endAt: dur - 0.1,
    });
  }

  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(W-text_w)/2',
      y: Math.round(H * 0.70),
      font: fontFor('body'),
      color: scene.text_color,
      size: 50,
      startAt: 0.6,
      endAt: dur - 0.1,
    });
  }
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderStat(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  const meta = parseStatValue(scene.value || '0');
  if (meta) {
    const counterDur = Math.min(1.4, dur * 0.5);
    const intFmt = meta.isInt ? 'd' : 'f';
    const expr = meta.isInt
      ? `floor(${meta.target}*min(t/${counterDur.toFixed(2)}\\,1))`
      : `(${meta.target}*min(t/${counterDur.toFixed(2)}\\,1))`;
    const statFont = fontFor('stat') || fontFor('display');
    const counterText = `${escapeDrawtext(meta.prefix)}%{eif\\:${expr}\\:${intFmt}}${escapeDrawtext(meta.suffix)}`;
    const gl2 = fb.next();
    const main = fb.next();
    fb.clauses.push(
      `[${cur}]drawtext=text='${counterText}':fontfile='${statFont}':fontcolor=${scene.accent_color}@0.30:fontsize=540:borderw=80:bordercolor=${scene.accent_color}@0.40:x=(w-text_w)/2:y=(h-text_h)/2-20[${gl2}]`,
      `[${gl2}]drawtext=text='${counterText}':fontfile='${statFont}':fontcolor=${scene.accent_color}:fontsize=540:x=(w-text_w)/2:y=(h-text_h)/2-20[${main}]`
    );
    cur = main;
  }

  if (scene.label) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.label.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.80),
      font: fontFor('displaySemi'),
      color: scene.text_color,
      glowColor: scene.accent_color_3,
      size: 60,
      startAt: 1.3,
      endAt: dur - 0.1,
    });
  }

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.10),
      font: fontFor('displaySemi'),
      color: scene.text_color,
      size: 44,
      alpha: 0.7,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  cur = fb.addCameraZoom(cur, fb.next(), { from: 1.0, to: 1.06, dur });
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderProcess(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.10),
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
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
      color: scene.accent_color, alpha: 0.12,
      borderColor: color2, borderAlpha: 0.55, borderW: 3,
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

    const lbl = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext((steps[i].label || '').toUpperCase())}':fontfile='${fontFor('displaySemi') || fontFor('display')}':fontcolor=${scene.text_color}:fontsize=36:x=${boxX + 12}:y=${yTop + 240}:enable='between(t,${(start+0.3).toFixed(2)},${(dur-0.1).toFixed(2)})'[${lbl}]`);
    cur = lbl;

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

  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(W-text_w)/2',
      y: Math.round(H * 0.92),
      font: fontFor('body'),
      color: scene.text_color,
      alpha: 0.7,
      size: 36,
      startAt: 0.6,
      endAt: dur - 0.1,
    });
  }
  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderTimeline(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.12),
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
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
      const l = fb.next();
      const labelY = lineY + 60;
      fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext((ms[i].label || '').toUpperCase())}':fontfile='${fontFor('displaySemi') || fontFor('display')}':fontcolor=${scene.text_color}:fontsize=38:x=${cx - 110}:y=${labelY}:box=1:boxcolor=#0F172A@0.7:boxborderw=10:enable='between(t,${(start+0.15).toFixed(2)},${(dur-0.1).toFixed(2)})'[${l}]`);
      cur = l;
    }
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderComparison(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.08),
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: 60,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  const left = scene.left || { title: 'Before', points: [], color: '#EF4444', icon: null };
  const right = scene.right || { title: 'After', points: [], color: '#10B981', icon: null };

  const cardW = Math.round(W * 0.40);
  const leftX = Math.round(W * 0.06);
  const rightX = Math.round(W * 0.54);
  const yTop = Math.round(H * 0.20);
  const cardH = Math.round(H * 0.72);

  cur = fb.addCard(cur, fb.next(), { x: leftX, y: yTop, w: cardW, h: cardH, color: left.color, alpha: 0.10, borderColor: left.color, borderAlpha: 0.60, borderW: 4 });
  cur = fb.addCard(cur, fb.next(), { x: rightX, y: yTop, w: cardW, h: cardH, color: right.color, alpha: 0.10, borderColor: right.color, borderAlpha: 0.60, borderW: 4 });

  const lblL = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext((left.title || '').toUpperCase())}':fontfile='${fontFor('display')}':fontcolor=${left.color}:fontsize=72:x=${leftX + 50}:y=${yTop + 30}[${lblL}]`);
  cur = lblL;
  const lblR = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${escapeDrawtext((right.title || '').toUpperCase())}':fontfile='${fontFor('display')}':fontcolor=${right.color}:fontsize=72:x=${rightX + 50}:y=${yTop + 30}[${lblR}]`);
  cur = lblR;

  const pointsLeft = (left.points || []).slice(0, 4);
  const pointsRight = (right.points || []).slice(0, 4);
  const perPoint = Math.min(0.4, (dur - 1.2) / Math.max(Math.max(pointsLeft.length, pointsRight.length), 1));

  for (let i = 0; i < pointsLeft.length; i++) {
    const s = (0.5 + i * perPoint).toFixed(2);
    const p = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='X  ${escapeDrawtext(pointsLeft[i] || '')}':fontfile='${fontFor('body') || fontFor('display')}':fontcolor=${scene.text_color}:fontsize=40:x=${leftX + 50}:y=${yTop + 150 + i * 80}:enable='between(t,${s},${(dur-0.1).toFixed(2)})'[${p}]`);
    cur = p;
  }
  for (let i = 0; i < pointsRight.length; i++) {
    const s = (0.7 + i * perPoint).toFixed(2);
    const p = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='+  ${escapeDrawtext(pointsRight[i] || '')}':fontfile='${fontFor('body') || fontFor('display')}':fontcolor=${scene.text_color}:fontsize=40:x=${rightX + 50}:y=${yTop + 150 + i * 80}:enable='between(t,${s},${(dur-0.1).toFixed(2)})'[${p}]`);
    cur = p;
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderSummary(scene, ctx) {
  const dur = ctx.durSec;
  const palette = ctx.palette;
  const fb = new FilterBuilder();
  let cur = fb.addGradientBg({ gradient: gradientFor(scene, palette), dur });
  cur = addDecorations(fb, cur, scene, palette);

  if (scene.title) {
    const next = fb.next();
    cur = fb.addNeonText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(W-text_w)/2',
      y: Math.round(H * 0.10),
      font: fontFor('display'),
      color: scene.text_color,
      glowColor: scene.accent_color,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
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
      color: scene.accent_color, alpha: 0.10,
      borderColor: c2, borderAlpha: 0.55, borderW: 3,
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

    const lines = wrapWords((takeaways[i].text || '').toUpperCase(), 22, 4);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lbl = fb.next();
      cur = fb.addText(cur, lbl, {
        text: lines[lineIndex],
        x: cx + 30,
        y: yTop + 250 + lineIndex * 54,
        font: fontFor('displaySemi') || fontFor('display'),
        color: scene.text_color,
        size: 30,
        startAt: start + 0.25 + lineIndex * 0.08,
        endAt: dur - 0.1,
      });
    }
  }

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
