import path from 'node:path';
import { existsSync } from 'node:fs';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const ICON_BOX = 380;

export function escapeDrawtext(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019')
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ');
}

function safeFont(p) {
  if (!p) return null;
  if (!existsSync(p)) return null;
  return p.replace(/\\/g, '/').replace(/'/g, "\\'");
}

function hexNoHash(hex) { return String(hex || '#FFFFFF').replace('#', ''); }

export class FilterBuilder {
  constructor() {
    this.clauses = [];
    this.idx = 0;
    this.inps = [];
    this.inputIdx = 0;
  }

  next() { return `v${this.idx++}`; }

  pushInput(path) {
    this.inps.push({ path, loop: 1 });
    return this.inputIdx++;
  }

  addGradientBg({ gradient, dur }) {
    const out = this.next();
    const colors = gradient.map(hexNoHash);
    let cSpec = '';
    if (colors.length === 2) {
      cSpec = `c0=0x${colors[0]}:c1=0x${colors[1]}`;
    } else if (colors.length === 3) {
      cSpec = `c0=0x${colors[0]}:c1=0x${colors[1]}:c2=0x${colors[2]}:nb_colors=3`;
    } else {
      cSpec = colors.map((c, i) => `c${i}=0x${c}`).join(':') + `:nb_colors=${colors.length}`;
    }
    this.clauses.push(`gradients=size=${W}x${H}:r=${FPS}:${cSpec}:x0=0:y0=0:x1=${W}:y1=${H}:duration=${dur}[${out}]`);
    return out;
  }

  addSolidBg({ color = '#020617', dur }) {
    const out = this.next();
    this.clauses.push(`color=c=${color}:s=${W}x${H}:r=${FPS}:d=${dur}[${out}]`);
    return out;
  }

  addBgVignette(input, out, strength = 0.3) {
    this.clauses.push(`[${input}]vignette=angle=PI/2:mode=forward[${out}]`);
    return out;
  }

  addDot(input, out, { x, y, size = 12, color = '#FFFFFF', alpha = 1, pulse = false, startAt = 0, dur = null, glow = false }) {
    const fadeIn = pulse ? this.next() : null;
    const inner = this.next();
    const a = this.next();
    const enable = (startAt != null && dur != null) ? `enable='between(t,${startAt},${(startAt + dur).toFixed(2)})'` : '';
    if (pulse) {
      this.clauses.push(
        `color=c=0x00000000:s=${W}x${H}:d=10,format=rgba[bg${inner}];` +
        `[bg${inner}]drawbox=x=${x - size}:y=${y - size}:w=${size * 2}:h=${size * 2}:color=${color}@${alpha * 0.4}:t=fill,` +
        `drawbox=x=${x - size / 2}:y=${y - size / 2}:w=${size}:h=${size}:color=${color}@${alpha}:t=fill,` +
        `drawbox=x=${x - 4}:y=${y - 4}:w=8:h=8:color=${color}@1:t=fill[v${inner}];` +
        `[v${inner}]scale='1+0.4*sin(2*PI*t*2)':eval=frame[v${a}]`
      );
    } else {
      this.clauses.push(
        `color=c=0x00000000:s=${W}x${H}:d=10,format=rgba[bg${inner}];` +
        `[bg${inner}]drawbox=x=${x - size / 2}:y=${y - size / 2}:w=${size}:h=${size}:color=${color}@${alpha}:t=fill[v${a}]`
      );
    }
    const final = this.next();
    this.clauses.push(`[${input}][v${a}]overlay=x=0:y=0${enable ? ':' + enable : ''}[${final}]`);
    return final;
  }

  addCircle(input, out, { x, y, r = 60, color = '#FFFFFF', alpha = 0.15, blur = false, float = false, floatDur = 4 }) {
    const c = hexNoHash(color);
    const lbl = this.next();
    let expr = '';
    if (float) {
      const dx = Math.round(20);
      const dy = Math.round(15);
      expr = `x='${x - r}+${dx}*sin(2*PI*t/${floatDur.toFixed(2)})':y='${y - r}+${dy}*cos(2*PI*t/${floatDur.toFixed(2)})':eval=frame`;
    } else {
      expr = `x=${x - r}:y=${y - r}`;
    }
    const final = this.next();
    this.clauses.push(
      `color=c=0x${c}@${alpha}:s=${r * 2}x${r * 2}:d=10[disc${lbl}];` +
      `[${input}][disc${lbl}]overlay=${expr}[${final}]`
    );
    return final;
  }

  addBlob(input, out, { x = 0, y = 0, w = 600, h = 600, color = '#FFFFFF', alpha = 0.18, blur = 30, float = true }) {
    const c = hexNoHash(color);
    const lbl = this.next();
    const final = this.next();
    let expr = `x=${x - w / 2}:y=${y - h / 2}`;
    if (float) {
      const dx = Math.round(40);
      const dy = Math.round(30);
      expr = `x='${x - w / 2}+${dx}*sin(2*PI*t/7)':y='${y - h / 2}+${dy}*cos(2*PI*t/5)':eval=frame`;
    }
    this.clauses.push(
      `color=c=0x${c}@${alpha}:s=${w}x${h}:d=10,` +
      `boxblur=${blur}:${blur}[b${lbl}];` +
      `[${input}][b${lbl}]overlay=${expr}[${final}]`
    );
    return final;
  }

  addImage(input, out, { path: imagePath, x = 0, y = 0, w = 720, h = 720, alpha = 1, blur = 0, float = false, floatDur = 6, scaleIn = false, scaleInDur = 0.4 }) {
    if (!imagePath || !existsSync(imagePath)) return input;
    const inputIdx = this.pushInput(imagePath);
    const inputLabel = `${inputIdx}:v`;
    const fmt = this.next();
    const sized = this.next();
    const prepared = this.next();
    const final = this.next();
    this.clauses.push(
      `[${inputLabel}]fps=${FPS},format=rgba,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[${fmt}]`
    );
    // Keep the output dimensions fixed. Per-frame resizes introduce visible
    // one-pixel jumps after FFmpeg rounds the scale and crop coordinates.
    const scaleExpr = '1';
    this.clauses.push(
      `[${fmt}]scale='trunc(${w}*(${scaleExpr})/2)*2':'trunc(${h}*(${scaleExpr})/2)*2':eval=frame,` +
      `crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2[${sized}]`
    );
    if (blur > 0) {
      this.clauses.push(`[${sized}]boxblur=${blur}:${Math.max(1, Math.round(blur / 4))}[${prepared}]`);
    } else {
      this.clauses.push(`[${sized}]copy[${prepared}]`);
    }
    const opacified = this.next();
    if (alpha < 1) {
      this.clauses.push(`[${prepared}]colorchannelmixer=aa=${alpha}[${opacified}]`);
    } else {
      this.clauses.push(`[${prepared}]copy[${opacified}]`);
    }
    let posX = x;
    let posY = y;
    if (float) {
      posX = typeof x === 'string' ? x : `trunc(${x}+4*sin(2*PI*t/${floatDur.toFixed(2)}))`;
      posY = typeof y === 'string' ? y : `trunc(${y}+3*cos(2*PI*t/${floatDur.toFixed(2)}))`;
    }
    this.clauses.push(`[${input}][${opacified}]overlay=x=${posX}:y=${posY}[${final}]`);
    return final;
  }

  addGrid(input, out, { size = 80, color = '#FFFFFF', alpha = 0.05 }) {
    this.clauses.push(`[${input}]drawgrid=w=${W}/${Math.floor(W / size)}:h=${H}/${Math.floor(H / size)}:t=${size}:c=${color}@${alpha}[${out}]`);
    return out;
  }

  addLine(input, out, { x1, y1, x2, y2, color = '#FFFFFF', thickness = 4, alpha = 1, drawDur = 0.8, startAt = 0 }) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (h < 1) {
      this.clauses.push(
        `[${input}]drawbox=x=${minX}:y=${minY - thickness / 2}:w=${w}:h=${thickness}:color=${color}@${alpha}:t=fill[${out}]`
      );
    } else if (w < 1) {
      this.clauses.push(
        `[${input}]drawbox=x=${minX - thickness / 2}:y=${minY}:w=${thickness}:h=${h}:color=${color}@${alpha}:t=fill[${out}]`
      );
    } else {
      this.clauses.push(
        `[${input}]drawbox=x=${minX}:y=${minY - thickness / 2}:w=${w}:h=${thickness}:color=${color}@${alpha}:t=fill[${out}]`
      );
    }
    return out;
  }

  addGlowDot(input, out, { x, y, size = 8, color = '#FFFFFF', pulse = true, startAt = 0 }) {
    const halo = this.next();
    this.clauses.push(
      `color=c=0x00000000:s=${W}x${H}:d=10,format=rgba[hb${halo}];` +
      `[hb${halo}]drawbox=x=${x - size * 3}:y=${y - size * 3}:w=${size * 6}:h=${size * 6}:color=${color}@0.15:t=fill,` +
      `drawbox=x=${x - size * 2}:y=${y - size * 2}:w=${size * 4}:h=${size * 4}:color=${color}@0.3:t=fill,` +
      `drawbox=x=${x - size}:y=${y - size}:w=${size * 2}:h=${size * 2}:color=${color}@0.6:t=fill[v${halo}]`
    );
    const final = this.next();
    this.clauses.push(`[${input}][v${halo}]overlay=x=0:y=0[${final}]`);
    return final;
  }

  addText(input, out, opts) {
    const {
      text = '',
      x = '(w-text_w)/2',
      y = '(h-text_h)/2',
      font = null,
      color = '#FFFFFF',
      size = 64,
      enable = null,
      alpha = 1,
      borderW = 0,
      borderColor = '#000000',
      startAt = null,
      endAt = null,
      fadeInDur = 0.32,
      extraKVs = {},
    } = opts;

    const safeFontPath = safeFont(font);
    const parts = [
      `text='${escapeDrawtext(text)}'`,
      `fontcolor=${color}`,
      `fontsize=${size}`,
    ];
    if (safeFontPath) parts.push(`fontfile='${safeFontPath}'`);
    parts.push(`x=${x}`);
    parts.push(`y=${y}`);
    if (borderW > 0) {
      parts.push(`borderw=${borderW}`);
      parts.push(`bordercolor=${borderColor}`);
    }
    if (startAt != null && fadeInDur > 0) {
      const d = Math.max(0.05, fadeInDur).toFixed(2);
      const fade = `min(max((t-${startAt})/${d}\\,0)\\,1)`;
      parts.push(`alpha='${alpha}*${fade}'`);
    } else if (alpha < 1) {
      parts.push(`alpha=${alpha}`);
    }
    if (enable) parts.push(`enable='${enable}'`);
    else if (startAt != null && endAt != null) parts.push(`enable='gte(t,${startAt})'`);
    for (const [k, v] of Object.entries(extraKVs)) parts.push(`${k}=${v}`);
    this.clauses.push(`[${input}]drawtext=${parts.join(':')}[${out}]`);
    return out;
  }

  addNeonText(input, out, opts) {
    const { color = '#FFFFFF', size = 100 } = opts;
    return this.addText(input, out, { ...opts, color, size, alpha: 1, borderW: 0 });
  }

  addGradientTextFake(input, out, { text, x, y, font, size, colors, enable = null, startAt = null, endAt = null }) {
    if (!colors || colors.length < 2) {
      return this.addText(input, out, { text, x, y, font, size, color: colors?.[0] || '#FFFFFF', enable, startAt, endAt });
    }
    const e = enable || (startAt != null && endAt != null ? `between(t,${startAt},${endAt})` : null);
    let cur = input;
    for (let i = 0; i < colors.length; i++) {
      const inter = this.next();
      cur = this.addText(cur, inter, {
        text,
        x,
        y,
        font,
        color: colors[i],
        size: size - i * 4,
        alpha: 1 - i * 0.05,
        startAt,
        endAt,
        enable: e,
      });
    }
    const final = this.next();
    this.clauses.push(`[${cur}]copy[${final}]`);
    return final;
  }

  addCard(input, out, { x, y, w, h, color = '#FFFFFF', alpha = 0.08, borderColor = '#FFFFFF', borderAlpha = 0.2, borderW = 2, radius = 0, enable = null, startAt = null, endAt = null }) {
    const c = hexNoHash(color);
    const bc = hexNoHash(borderColor);
    const lbl = this.next();
    const e = enable || (startAt != null && endAt != null ? `enable='gte(t,${startAt})'` : '');
    this.clauses.push(
      `color=c=0x00000000:s=${W}x${H}:d=10,format=rgba[bg${lbl}];` +
      `[bg${lbl}]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@${alpha}:t=fill,` +
      `drawbox=x=${x}:y=${y}:w=${w}:h=${borderW}:color=${borderColor}@${borderAlpha}:t=fill,` +
      `drawbox=x=${x}:y=${y + h - borderW}:w=${w}:h=${borderW}:color=${borderColor}@${borderAlpha}:t=fill,` +
      `drawbox=x=${x}:y=${y}:w=${borderW}:h=${h}:color=${borderColor}@${borderAlpha}:t=fill,` +
      `drawbox=x=${x + w - borderW}:y=${y}:w=${borderW}:h=${h}:color=${borderColor}@${borderAlpha}:t=fill[v${lbl}]`
    );
    const final = this.next();
    this.clauses.push(`[${input}][v${lbl}]overlay=x=0:y=0${e ? ':' + e : ''}[${final}]`);
    return final;
  }

  addLightSweep(input, out, { color = '#FFFFFF', alpha = 0.15, dur = 0.8, startAt = 0 }) {
    const sw = 200;
    const sweepX = `'(W+${sw})*((t-${startAt})/${dur})-${sw}'`;
    const lbl = this.next();
    this.clauses.push(
      `color=c=${color}:s=${sw}x${H}:d=10,` +
      `format=yuva420p,geq=lum=255:cb=128:cr=128,drawbox=x=0:y=0:w=${sw / 4}:h=${H}:color=${color}@1:t=fill,` +
      `boxblur=20:1[sweep${lbl}];` +
      `[${input}][sweep${lbl}]overlay=x=${sweepX}:y=0:enable='between(t,${startAt},${startAt + dur})'[${out}]`
    );
    return out;
  }

  addIcon(input, out, opts) {
    const {
      path: iconPath,
      x = '(W-w)/2',
      y = '(H-h)/2',
      box = ICON_BOX,
      scaleIn = false,
      scaleInDur = 0.35,
      rotate = false,
      pulse = false,
      float = false,
      glow = false,
      enable = null,
    } = opts;
    if (!iconPath || !existsSync(iconPath)) return input;
    const inputIdx = this.pushInput(iconPath);
    const inputLabel = `${inputIdx}:v`;
    const fmt = this.next();
    const scaled = this.next();
    const rotated = this.next();
    const framed = this.next();
    const final = this.next();

    this.clauses.push(
      `[${inputLabel}]format=rgba,scale=${box}:${box}:force_original_aspect_ratio=decrease,pad=${box}:${box}:(ow-iw)/2:(oh-ih)/2:color=0x00000000[${fmt}]`
    );

    // Icons stay at a fixed raster size; opacity and staging provide motion
    // without the shimmer caused by resizing a stroked PNG every frame.
    const scaleExpr = '1';
    this.clauses.push(
      `[${fmt}]scale=iw*${scaleExpr}:ih*${scaleExpr}:eval=frame[${scaled}]`
    );

    if (rotate) {
      this.clauses.push(`[${scaled}]rotate=t*0.4:c=0x00000000[${rotated}]`);
    } else {
      this.clauses.push(`[${scaled}]copy[${rotated}]`);
    }

    const frameSize = Math.ceil(box * 1.12 / 2) * 2;
    this.clauses.push(
      `color=c=0x00000000:s=${frameSize}x${frameSize}:r=${FPS}:d=10,format=rgba[iconbg${framed}];` +
      `[iconbg${framed}][${rotated}]overlay=x=(W-w)/2:y=(H-h)/2[${framed}]`
    );

    let posX = x, posY = y;
    const frameOffset = Math.round((frameSize - box) / 2);
    posX = typeof posX === 'string' ? `(${posX})-${frameOffset}` : posX - frameOffset;
    posY = typeof posY === 'string' ? `(${posY})-${frameOffset}` : posY - frameOffset;
    if (float) {
      posX = `trunc(${posX}+4*sin(2*PI*t/3.5))`;
      posY = `trunc(${posY}+3*cos(2*PI*t/3.5))`;
    }

    const enabled = enable ? `:enable='${enable}'` : '';
    this.clauses.push(
      `[${input}][${framed}]overlay=x=${posX}:y=${posY}${enabled}[${final}]`
    );
    return final;
  }

  addCameraZoom(input, out, { from = 1.0, to = 1.025, dur = 4 }) {
    const final = this.next();
    this.clauses.push(`[${input}]copy[${final}]`);
    return final;
  }

  addRetentionPulse(input, out, { at = 2, color = '#FFFFFF' }) {
    const lbl = this.next();
    this.clauses.push(
      `color=c=0x00000000:s=${W}x${H}:d=10,format=rgba[bg${lbl}];` +
      `[bg${lbl}]drawbox=x=0:y=0:w=${W}:h=${H}:color=${color}@0:t=fill,` +
      `drawbox=x=0:y=0:w=${W}:h=${H}:color=${color}@0.15:t=fill:enable='between(t,${at},${(at + 0.15).toFixed(2)})'[v${lbl}]`
    );
    const final = this.next();
    this.clauses.push(`[${input}][v${lbl}]overlay=x=0:y=0[${final}]`);
    return final;
  }

  fadeOut(input, out, { start = 0, dur = 0.3 }) {
    this.clauses.push(`[${input}]fade=t=out:st=${start}:d=${dur}:alpha=1[${out}]`);
    return out;
  }

  toGraph() {
    return this.clauses.join(';');
  }

  inputs() {
    return this.inps.filter(i => i.path != null);
  }
}

export function splitWords(text) {
  if (!text) return [];
  return String(text).split(/\s+/).filter(Boolean);
}

export function wrapWords(text, maxChars = 24, maxLines = 4) {
  const words = splitWords(text);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    if (!line) {
      line = word.slice(0, maxChars);
      continue;
    }
    if (lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
      continue;
    }
    const remaining = [line, ...words.slice(i)].join(' ');
    line = remaining.length > maxChars
      ? `${remaining.slice(0, Math.max(1, maxChars - 3)).trim()}...`
      : remaining;
    break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}

export function parseStatValue(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^([^\d.,-]*)([\d.,]+)([^\d]*)$/);
  if (!m) return null;
  const [, prefix, num, suffix] = m;
  const target = parseFloat(num.replace(/,/g, ''));
  if (Number.isNaN(target)) return null;
  return {
    prefix: prefix || '',
    suffix: suffix || '',
    target,
    decimals: (num.split('.')[1] || '').length,
    isInt: Number.isInteger(target),
  };
}
