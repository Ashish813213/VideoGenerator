import { FilterBuilder, W, H, FPS, ICON_BOX, splitWords, parseStatValue } from './base.js';
import { FONTS, COLORS } from '../design.js';
import { existsSync } from 'node:fs';

function fontFor(kind) {
  if (kind === 'display') return FONTS.display || FONTS.bodyBold;
  if (kind === 'displaySemi') return FONTS.displaySemi || FONTS.bodySemi;
  if (kind === 'stat') return FONTS.stat || FONTS.display;
  if (kind === 'body') return FONTS.body || FONTS.bodyBold;
  return FONTS.bodyBold;
}

function entranceWindow(anim, durSec) {
  const e = Math.min(0.5, Math.max(0.25, durSec * 0.25));
  return e;
}

function gradientFor(scene) {
  const bg = scene.bg_color || '#0A0A0A';
  const accent = scene.accent_color || '#3B82F6';
  if (bg === '#0A0A0A' || bg === '#000000') {
    return [bg, shadeColor(accent, -70)];
  }
  return [bg, '#FFFFFF'];
}

function shadeColor(hex, percent) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function renderHero(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', gradient: gradientFor(scene), dur });

  const title = (scene.title || '').toUpperCase();
  const subtitle = scene.subtitle || '';
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';

  let cur = bgOut;
  if (scene.lucide_icon_name && ctx.iconPath) {
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: 360,
      x: '(W-360)/2',
      y: '(H*0.22)',
      scaleIn: true,
      scaleInDur: 0.5,
      pulse: true,
    });
  }

  if (title) {
    const titleFont = fontFor('display');
    const words = splitWords(title);
    const e = entranceWindow(scene.animation, dur);
    const perWord = Math.min(0.45, e / Math.max(words.length, 1));
    const titleY = Math.round(H * 0.50);
    const next = fb.next();

    if (scene.animation === 'wordByWord' || scene.animation === 'kineticTypography') {
      const labels = [cur];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const start = i * perWord;
        const end = start + perWord + 0.05;
        const isHighlight = scene.highlight_words && scene.highlight_words.some(hw => w.toLowerCase().includes(hw.toLowerCase()));
        const tmp = fb.next();
        if (isHighlight) {
          fb.addGlowText(labels[labels.length - 1], tmp, {
            text: w,
            x: '(w-text_w)/2',
            y: titleY,
            font: titleFont,
            color: accent,
            glowColor: accent,
            size: 200,
            startAt: start,
            endAt: dur - 0.1,
          });
        } else {
          fb.addText(labels[labels.length - 1], tmp, {
            text: w,
            x: '(w-text_w)/2',
            y: titleY,
            font: titleFont,
            color: textColor,
            size: 200,
            startAt: start,
            endAt: dur - 0.1,
          });
        }
        labels.push(tmp);
      }
      cur = labels[labels.length - 1];
    } else {
      cur = fb.addGlowText(cur, next, {
        text: title,
        x: '(w-text_w)/2',
        y: titleY,
        font: titleFont,
        color: accent,
        glowColor: accent,
        size: 180,
        startAt: 0,
        endAt: dur - 0.1,
      });
    }
  }

  if (subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: subtitle,
      x: '(w-text_w)/2',
      y: Math.round(H * 0.72),
      font: fontFor('body'),
      color: textColor,
      alpha: 0.8,
      size: 56,
      startAt: 0.5,
      endAt: dur - 0.1,
    });
  }

  const final = fb.next();
  fb.clauses.push(`[${cur}]fade=t=out:st=${Math.max(0, dur - 0.3)}:d=0.3:alpha=1[${final}]`);

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderDefinition(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', gradient: gradientFor(scene), dur });
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';

  let cur = bgOut;
  if (ctx.iconPath) {
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: 300,
      x: '(W-300)/2',
      y: Math.round(H * 0.18),
      scaleIn: true,
      scaleInDur: 0.4,
    });
  }

  if (scene.title) {
    const next = fb.next();
    const isHighlight = true;
    cur = fb.addGlowText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.55),
      font: fontFor('display'),
      color: accent,
      glowColor: accent,
      size: 160,
      startAt: 0.3,
      endAt: dur - 0.1,
    });
  }

  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(w-text_w)/2',
      y: Math.round(H * 0.74),
      font: fontFor('body'),
      color: textColor,
      alpha: 0.85,
      size: 52,
      startAt: 0.7,
      endAt: dur - 0.1,
    });
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderCallout(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', dur });
  let cur = bgOut;

  const cardX = Math.round(W * 0.12);
  const cardY = Math.round(H * 0.18);
  const cardW = Math.round(W * 0.76);
  const cardH = Math.round(H * 0.64);
  const rad = 32;

  fb.clauses.push(
    `color=c=${accent}@0.12:s=${W}x${H}:d=${dur},format=yuva420p[tt];` +
    `[tt]drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=${accent}@0.18:t=fill,drawbox=x=${cardX+4}:y=${cardY+4}:w=${cardW-8}:h=${cardH-8}:color=${accent}@0.55:t=fill[v${fb.idx}]`
  );
  const cardLabel = fb.next();
  cur = cardLabel;

  if (ctx.iconPath) {
    const next = fb.next();
    cur = fb.addIcon(cur, next, {
      path: ctx.iconPath,
      box: 200,
      x: `${cardX + (cardW - 200) / 2}`,
      y: `${cardY + 60}`,
      scaleIn: true,
      scaleInDur: 0.4,
      pulse: true,
    });
  }

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.55),
      font: fontFor('display'),
      color: accent,
      size: 130,
      startAt: 0.3,
      endAt: dur - 0.1,
    });
  }
  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(w-text_w)/2',
      y: Math.round(H * 0.70),
      font: fontFor('body'),
      color: textColor,
      size: 50,
      startAt: 0.6,
      endAt: dur - 0.1,
    });
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderStat(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', gradient: gradientFor(scene), dur });
  let cur = bgOut;

  const meta = parseStatValue(scene.value || '0');
  if (meta) {
    const counterDur = Math.min(1.2, dur * 0.5);
    const final = fb.next();
    const intFmt = meta.isInt ? 'd' : `f`;
    const expr = meta.isInt
      ? `floor(${meta.target}*min(t/${counterDur.toFixed(2)}\\,1))`
      : `(${meta.target}*min(t/${counterDur.toFixed(2)}\\,1))`;
    fb.clauses.push(
      `[${cur}]drawtext=text='${meta.prefix}%{eif::${expr}:${intFmt}}${meta.suffix}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}@0.35:fontsize=540:borderw=80:bordercolor=${accent}@0.35:x=(w-text_w)/2:y=(h-text_h)/2[${fb.next()}];` +
      `[${cur}]drawtext=text='${meta.prefix}%{eif::${expr}:${intFmt}}${meta.suffix}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}@0.25:fontsize=560:x=(w-text_w)/2:y=(h-text_h)/2[${fb.next()}];` +
      `[${cur}]drawtext=text='${meta.prefix}%{eif::${expr}:${intFmt}}${meta.suffix}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}:fontsize=540:x=(w-text_w)/2:y=(h-text_h)/2[${final}]`
    );
    cur = final;
  }

  if (scene.label) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.label.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.78),
      font: fontFor('displaySemi'),
      color: textColor,
      size: 56,
      startAt: 1.2,
      endAt: dur - 0.1,
    });
  }

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.10),
      font: fontFor('displaySemi'),
      color: textColor,
      size: 48,
      alpha: 0.6,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderProcess(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';
  const steps = scene.steps || [];
  const n = steps.length;

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', dur });
  let cur = bgOut;

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.12),
      font: fontFor('display'),
      color: textColor,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  const colW = Math.min(280, Math.round(W * 0.18));
  const gap = Math.round((W - n * colW) / (n + 1));
  const y0 = Math.round(H * 0.45);
  const y1 = Math.round(H * 0.85);
  const lineY = Math.round((y0 + y1) / 2) + 60;

  const stepStart = 0.3;
  const perStep = Math.min(0.6, (dur - 0.8) / Math.max(n, 1));

  for (let i = 0; i < n; i++) {
    const cx = gap + i * (colW + gap) + colW / 2;
    const start = stepStart + i * perStep;
    const end = Math.min(dur - 0.1, start + perStep);

    const boxX = cx - colW / 2;
    const boxY = y0;

    const c1 = fb.next();
    fb.clauses.push(
      `color=c=${accent}@0.16:s=${W}x${H}:d=${dur},format=yuva420p[bg${c1}];` +
      `[bg${c1}]drawbox=x=${boxX}:y=${boxY}:w=${colW}:h=${colW}:color=${accent}@0.18:t=fill,` +
      `drawbox=x=${boxX+3}:y=${boxY+3}:w=${colW-6}:h=${colW-6}:color=${accent}@0.55:t=fill,` +
      `drawbox=x=${boxX+8}:y=${boxY+8}:w=${colW-16}:h=${colW-16}:color=${accent}:t=fill[v${c1}]`
    );
    const cardLabel = fb.next();
    fb.clauses.push(`[${cur}][v${c1}]overlay=x=0:y=0:enable='between(t,${start.toFixed(2)},${(dur-0.1).toFixed(2)})'[${cardLabel}]`);
    cur = cardLabel;

    if (steps[i].icon && ctx.iconPaths && ctx.iconPaths[steps[i].icon]) {
      const iconSize = 110;
      const ix = cx - iconSize / 2;
      const iy = boxY + (colW - iconSize) / 2;
      const ip = ctx.iconPaths[steps[i].icon];
      const next = fb.next();
      cur = fb.addIcon(cur, next, {
        path: ip,
        box: iconSize,
        x: ix,
        y: iy,
        scaleIn: true,
        scaleInDur: 0.4,
      });
    }

    const numLabel = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${i + 1}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}:fontsize=64:x=${cx - 30}:y=${boxY + colW + 12}:enable='between(t,${(start+0.1).toFixed(2)},${(dur-0.1).toFixed(2)})'[${numLabel}]`);
    cur = numLabel;

    const lbl = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${(steps[i].label || '').toUpperCase()}':fontfile='${fontFor('displaySemi') || fontFor('display')}':fontcolor=${textColor}:fontsize=44:x=${cx - colW/2 + 8}:y=${boxY + colW + 80}:box=1:boxcolor=${scene.bg_color || '#0A0A0A'}@0.7:boxborderw=12:enable='between(t,${(start+0.15).toFixed(2)},${(dur-0.1).toFixed(2)})'[${lbl}]`);
    cur = lbl;

    if (i < n - 1) {
      const ax1 = boxX + colW + 10;
      const ax2 = boxX + colW + gap - 10;
      const ay = boxY + colW / 2;
      const arrowStart = end + 0.05;
      const arrowEnd = Math.min(dur - 0.1, arrowStart + 0.4);
      const a = fb.next();
      fb.clauses.push(
        `[${cur}]drawbox=x=${ax1}:y=${ay - 3}:w=${ax2 - ax1}:h=6:color=${accent}@0.7:t=fill:enable='between(t,${arrowStart.toFixed(2)},${(dur-0.1).toFixed(2)})'[${a}]`
      );
      cur = a;
    }
  }

  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(w-text_w)/2',
      y: Math.round(H * 0.92),
      font: fontFor('body'),
      color: textColor,
      alpha: 0.7,
      size: 36,
      startAt: 0.5,
      endAt: dur - 0.1,
    });
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderTimeline(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';
  const ms = scene.milestones || [];
  const n = ms.length;

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', dur });
  let cur = bgOut;

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.15),
      font: fontFor('display'),
      color: textColor,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  const lineY = Math.round(H * 0.55);
  const lineX1 = Math.round(W * 0.10);
  const lineX2 = Math.round(W * 0.90);

  const line = fb.next();
  fb.clauses.push(`[${cur}]drawbox=x=${lineX1}:y=${lineY - 3}:w=${lineX2 - lineX1}:h=6:color=${accent}@0.5:t=fill[${line}]`);
  cur = line;

  const perMs = Math.min(0.7, (dur - 0.5) / Math.max(n, 1));
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(n - 1, 1));
    const cx = Math.round(lineX1 + t * (lineX2 - lineX1));
    const start = 0.3 + i * perMs;
    const end = Math.min(dur - 0.1, start + perMs);

    const dot = fb.next();
    fb.clauses.push(`[${cur}]drawbox=x=${cx - 16}:y=${lineY - 16}:w=32:h=32:color=${accent}:t=fill:enable='between(t,${start.toFixed(2)},${(dur-0.1).toFixed(2)})'[${dot}]`);
    cur = dot;

    const dotRing = fb.next();
    fb.clauses.push(`[${cur}]drawbox=x=${cx - 30}:y=${lineY - 30}:w=60:h=60:color=${accent}@0.35:t=fill:enable='between(t,${(start+0.05).toFixed(2)},${(dur-0.1).toFixed(2)})'[${dotRing}]`);
    cur = dotRing;

    if (ms[i].year) {
      const y = fb.next();
      fb.clauses.push(`[${cur}]drawtext=text='${(ms[i].year || '').toUpperCase()}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}:fontsize=58:x=${cx - 80}:y=${lineY - 130}:box=1:boxcolor=${scene.bg_color || '#0A0A0A'}@0.7:boxborderw=12:enable='between(t,${(start+0.1).toFixed(2)},${(dur-0.1).toFixed(2)})'[${y}]`);
      cur = y;
    }

    if (ms[i].label) {
      const l = fb.next();
      const labelY = lineY + 50;
      fb.clauses.push(`[${cur}]drawtext=text='${(ms[i].label || '').toUpperCase()}':fontfile='${fontFor('displaySemi') || fontFor('display')}':fontcolor=${textColor}:fontsize=38:x=${cx - 110}:y=${labelY}:box=1:boxcolor=${scene.bg_color || '#0A0A0A'}@0.7:boxborderw=10:enable='between(t,${(start+0.15).toFixed(2)},${(dur-0.1).toFixed(2)})'[${l}]`);
      cur = l;
    }
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderComparison(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const textColor = scene.text_color || '#FFFFFF';
  const left = scene.left || { title: 'Before', points: [], color: '#EF4444', icon: null };
  const right = scene.right || { title: 'After', points: [], color: '#10B981', icon: null };

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', dur });
  let cur = bgOut;

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.10),
      font: fontFor('display'),
      color: textColor,
      size: 64,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  const halfW = Math.round(W * 0.40);
  const leftX = Math.round(W * 0.06);
  const rightX = Math.round(W * 0.54);
  const yTop = Math.round(H * 0.22);
  const yBot = Math.round(H * 0.92);

  const cardW = halfW;
  const cardH = yBot - yTop;

  const cardL = fb.next();
  fb.clauses.push(
    `color=c=${left.color}@0.12:s=${W}x${H}:d=${dur},format=yuva420p[bgL${cardL}];` +
    `[bgL${cardL}]drawbox=x=${leftX}:y=${yTop}:w=${cardW}:h=${cardH}:color=${left.color}@0.16:t=fill,` +
    `drawbox=x=${leftX+3}:y=${yTop+3}:w=${cardW-6}:h=${cardH-6}:color=${left.color}@0.5:t=fill[vL${cardL}]`
  );
  const cl = fb.next();
  fb.clauses.push(`[${cur}][vL${cardL}]overlay=x=0:y=0:enable='between(t,0.1,${(dur-0.1).toFixed(2)})'[${cl}]`);
  cur = cl;

  const cardR = fb.next();
  fb.clauses.push(
    `color=c=${right.color}@0.12:s=${W}x${H}:d=${dur},format=yuva420p[bgR${cardR}];` +
    `[bgR${cardR}]drawbox=x=${rightX}:y=${yTop}:w=${cardW}:h=${cardH}:color=${right.color}@0.16:t=fill,` +
    `drawbox=x=${rightX+3}:y=${yTop+3}:w=${cardW-6}:h=${cardH-6}:color=${right.color}@0.5:t=fill[vR${cardR}]`
  );
  const cr = fb.next();
  fb.clauses.push(`[${cur}][vR${cardR}]overlay=x=0:y=0:enable='between(t,0.3,${(dur-0.1).toFixed(2)})'[${cr}]`);
  cur = cr;

  const lblL = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${(left.title || '').toUpperCase()}':fontfile='${fontFor('display') || fontFor('display')}':fontcolor=${left.color}:fontsize=72:x=${leftX + cardW/2 - 100}:y=${yTop + 24}:enable='between(t,0.1,${(dur-0.1).toFixed(2)})'[${lblL}]`);
  cur = lblL;

  const lblR = fb.next();
  fb.clauses.push(`[${cur}]drawtext=text='${(right.title || '').toUpperCase()}':fontfile='${fontFor('display') || fontFor('display')}':fontcolor=${right.color}:fontsize=72:x=${rightX + cardW/2 - 100}:y=${yTop + 24}:enable='between(t,0.3,${(dur-0.1).toFixed(2)})'[${lblR}]`);
  cur = lblR;

  const pointsLeft = (left.points || []).slice(0, 4);
  const pointsRight = (right.points || []).slice(0, 4);
  const pointStartL = 0.4;
  const pointStartR = 0.6;
  const perPoint = Math.min(0.4, (dur - 1.2) / Math.max(Math.max(pointsLeft.length, pointsRight.length), 1));

  for (let i = 0; i < pointsLeft.length; i++) {
    const s = (pointStartL + i * perPoint).toFixed(2);
    const e = (Math.min(dur - 0.1, pointStartL + (i + 1) * perPoint)).toFixed(2);
    const p = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='- ${(pointsLeft[i] || '')}':fontfile='${fontFor('body') || fontFor('display')}':fontcolor=${textColor}:fontsize=42:x=${leftX + 40}:y=${yTop + 140 + i * 90}:enable='between(t,${s},${(dur-0.1).toFixed(2)})'[${p}]`);
    cur = p;
  }
  for (let i = 0; i < pointsRight.length; i++) {
    const s = (pointStartR + i * perPoint).toFixed(2);
    const e = (Math.min(dur - 0.1, pointStartR + (i + 1) * perPoint)).toFixed(2);
    const p = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='- ${(pointsRight[i] || '')}':fontfile='${fontFor('body') || fontFor('display')}':fontcolor=${textColor}:fontsize=42:x=${rightX + 40}:y=${yTop + 140 + i * 90}:enable='between(t,${s},${(dur-0.1).toFixed(2)})'[${p}]`);
    cur = p;
  }

  if (scene.subtitle) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.subtitle,
      x: '(w-text_w)/2',
      y: Math.round(H * 0.95),
      font: fontFor('body'),
      color: textColor,
      alpha: 0.6,
      size: 30,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

function renderSummary(scene, ctx) {
  const dur = ctx.durSec;
  const fb = new FilterBuilder();
  const accent = scene.accent_color || '#3B82F6';
  const textColor = scene.text_color || '#FFFFFF';
  const takeaways = (scene.takeaways || []).slice(0, 3);

  const bgOut = fb.addBg({ color: scene.bg_color || '#0A0A0A', gradient: gradientFor(scene), dur });
  let cur = bgOut;

  if (scene.title) {
    const next = fb.next();
    cur = fb.addText(cur, next, {
      text: scene.title.toUpperCase(),
      x: '(w-text_w)/2',
      y: Math.round(H * 0.12),
      font: fontFor('display'),
      color: textColor,
      size: 72,
      startAt: 0,
      endAt: dur - 0.1,
    });
  }

  const n = takeaways.length;
  const cardW = Math.min(500, Math.round(W * 0.26));
  const cardH = Math.round(H * 0.55);
  const totalW = n * cardW + (n - 1) * 80;
  const startX = Math.round((W - totalW) / 2);
  const yTop = Math.round(H * 0.30);

  for (let i = 0; i < n; i++) {
    const cx = startX + i * (cardW + 80);
    const start = 0.3 + i * 0.25;
    const c = fb.next();
    fb.clauses.push(
      `color=c=${accent}@0.14:s=${W}x${H}:d=${dur},format=yuva420p[bgS${c}];` +
      `[bgS${c}]drawbox=x=${cx}:y=${yTop}:w=${cardW}:h=${cardH}:color=${accent}@0.18:t=fill,` +
      `drawbox=x=${cx+3}:y=${yTop+3}:w=${cardW-6}:h=${cardH-6}:color=${accent}@0.55:t=fill[vS${c}]`
    );
    const cl = fb.next();
    fb.clauses.push(`[${cur}][vS${c}]overlay=x=0:y=0:enable='between(t,${start.toFixed(2)},${(dur-0.1).toFixed(2)})'[${cl}]`);
    cur = cl;

    const num = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${i + 1}':fontfile='${fontFor('stat') || fontFor('display')}':fontcolor=${accent}:fontsize=120:x=${cx + cardW/2 - 36}:y=${yTop + 30}:enable='between(t,${(start+0.05).toFixed(2)},${(dur-0.1).toFixed(2)})'[${num}]`);
    cur = num;

    if (takeaways[i].icon && ctx.iconPaths && ctx.iconPaths[takeaways[i].icon]) {
      const ip = ctx.iconPaths[takeaways[i].icon];
      const next = fb.next();
      cur = fb.addIcon(cur, next, {
        path: ip,
        box: 80,
        x: cx + cardW/2 - 40,
        y: yTop + 180,
        scaleIn: true,
        scaleInDur: 0.3,
      });
    }

    const lbl = fb.next();
    fb.clauses.push(`[${cur}]drawtext=text='${(takeaways[i].text || '').toUpperCase()}':fontfile='${fontFor('displaySemi') || fontFor('display')}':fontcolor=${textColor}:fontsize=34:x=${cx + 24}:y=${yTop + 280}:box=1:boxcolor=${scene.bg_color || '#0A0A0A'}@0.7:boxborderw=10:enable='between(t,${(start+0.15).toFixed(2)},${(dur-0.1).toFixed(2)})'[${lbl}]`);
    cur = lbl;
  }

  return { inputs: fb.inputs(), filterGraph: fb.toGraph() };
}

const RENDERERS = {
  hero: renderHero,
  definition: renderDefinition,
  callout: renderCallout,
  stat: renderStat,
  process: renderProcess,
  timeline: renderTimeline,
  comparison: renderComparison,
  summary: renderSummary,
};

export function renderSceneType(scene, ctx) {
  const fn = RENDERERS[scene.scene_type] || RENDERERS.definition;
  return fn(scene, ctx);
}
