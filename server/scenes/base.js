import path from 'node:path';
import { existsSync } from 'node:fs';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const ICON_BOX = 420;

function safeText(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
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

  addBg({ color = '#0A0A0A', gradient = null, dur }) {
    const out = this.next();
    if (gradient && Array.isArray(gradient) && gradient.length >= 2) {
      const [c0, c1] = gradient.map(hexNoHash);
      this.clauses.push(
        `gradients=size=${W}x${H}:c0=0x${c0}:c1=0x${c1}:x0=0:y0=0:x1=${W}:y1=${H}:nb_colors=2:duration=${dur}[${out}]`
      );
    } else {
      this.clauses.push(`color=c=${color}:s=${W}x${H}:r=${FPS}:d=${dur}[${out}]`);
    }
    return out;
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
      extraKVs = {},
    } = opts;

    const safeFontPath = safeFont(font);
    const parts = [
      `text='${safeText(text)}'`,
      `fontcolor=${color}@${alpha}`,
      `fontsize=${size}`,
    ];
    if (safeFontPath) parts.push(`fontfile='${safeFontPath}'`);
    parts.push(`x=${x}`);
    parts.push(`y=${y}`);
    if (borderW > 0) {
      parts.push(`borderw=${borderW}`);
      parts.push(`bordercolor=${borderColor}`);
    }
    if (enable) parts.push(`enable='${enable}'`);
    else if (startAt != null && endAt != null) parts.push(`enable='between(t,${startAt},${endAt})'`);
    for (const [k, v] of Object.entries(extraKVs)) parts.push(`${k}=${v}`);
    this.clauses.push(`[${input}]drawtext=${parts.join(':')}[${out}]`);
    return out;
  }

  addGlowText(input, out, opts) {
    const glowColor = opts.glowColor || opts.color;
    const big = Math.round(opts.size * 1.6);
    const inter1 = this.next();
    this.addText(input, inter1, {
      ...opts,
      color: glowColor,
      size: big,
      alpha: 0.35,
      borderW: Math.round(opts.size * 0.22),
      borderColor: glowColor,
    });
    this.addText(inter1, out, opts);
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
      finalAlpha = 1,
    } = opts;
    if (!iconPath || !existsSync(iconPath)) return input;
    const inputIdx = this.pushInput(iconPath);
    const inputLabel = `${inputIdx}:v`;
    const fmt = this.next();
    const scaled = this.next();
    const rotated = this.next();
    const pulsed = this.next();

    this.clauses.push(
      `[${inputLabel}]format=rgba,scale=${box}:${box}:force_original_aspect_ratio=decrease,pad=${box}:${box}:(ow-iw)/2:(oh-ih)/2:color=0x00000000[${fmt}]`
    );

    let scaleExpr = '1';
    if (scaleIn) {
      scaleExpr = `if(lt(t\\,${scaleInDur.toFixed(2)})\\,1.4-0.4*t/${scaleInDur.toFixed(2)}\\,1.0)`;
    }
    this.clauses.push(
      `[${fmt}]scale=iw*${scaleExpr}:ih*${scaleExpr}:eval=frame[${scaled}]`
    );

    if (rotate) {
      this.clauses.push(`[${scaled}]rotate=t*0.4:c=0x00000000[${rotated}]`);
    } else {
      this.clauses.push(`[${scaled}]copy[${rotated}]`);
    }

    let lastOverlay = rotated;
    if (pulse) {
      const p = this.next();
      this.clauses.push(
        `[${rotated}]scale='if(lt(sin(2*PI*t)\\,0)\\,0.95\\,1.05)':eval=frame[${p}]`
      );
      lastOverlay = p;
    }

    this.clauses.push(
      `[${input}][${lastOverlay}]overlay=x=${x}:y=${y}:eval=init[${out}]`
    );
    return out;
  }

  addImage(input, out, opts) {
    const { path: imgPath, x = 0, y = 0, w = W, h = H, zoomIn = false, zoomDur = 4, pan = null, finalAlpha = 1 } = opts;
    if (!imgPath || !existsSync(imgPath)) return input;
    const inputIdx = this.pushInput(imgPath);
    const inputLabel = `${inputIdx}:v`;
    const scaled = this.next();
    const zoomed = this.next();
    this.clauses.push(
      `[${inputLabel}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[${scaled}]`
    );
    if (zoomIn) {
      const zExpr = `1+0.0008*in*${Math.max(1, Math.round(FPS * zoomDur * 0.5))}`;
      this.clauses.push(`[${scaled}]zoompan=z='min(${zExpr}\\,1.15)':d=${Math.round(FPS * zoomDur)}:s=${w}x${h}:fps=${FPS}[${zoomed}]`);
      this.clauses.push(`[${input}][${zoomed}]overlay=x=${x}:y=${y}[${out}]`);
    } else {
      this.clauses.push(`[${input}][${scaled}]overlay=x=${x}:y=${y}[${out}]`);
    }
    return out;
  }

  addRect(input, out, opts) {
    const { x = 0, y = 0, w = 100, h = 100, color = '#FFFFFF', alpha = 1, startAt = null, endAt = null, radius = 0 } = opts;
    this.inps.push({ path: null });
    const bgIdx = this.inps.length - 1;
    const rectIdx = this.next();
    const fmt = this.next();
    const enable = (startAt != null && endAt != null) ? `,enable='between(t,${startAt},${endAt})'` : '';
    this.clauses.push(
      `color=c=${color}:s=${w}x${h}:d=10[bg${rectIdx}]`
    );
    this.clauses.push(
      `[${input}][bg${rectIdx}]overlay=x=${x}:y=${y}${enable}[${out}]`
    );
    return out;
  }

  addLine(input, out, opts) {
    const { x1 = 0, y1 = 0, x2 = 100, y2 = 0, color = '#FFFFFF', thickness = 4, startAt = null, endAt = null, drawDur = 0.8 } = opts;
    const dur = drawDur;
    const enable = (startAt != null && endAt != null) ? `,enable='between(t,${startAt},${endAt})'` : '';
    this.clauses.push(
      `[${input}]drawbox=x=${Math.min(x1,x2)}:y=${Math.min(y1,y2)}:w=${Math.abs(x2-x1)}:h=${thickness}:color=${color}:t=fill${enable}[${out}]`
    );
    return out;
  }

  fade(input, out, { in: fadeIn = null, out: fadeOut = null, type = 'in' } = {}) {
    if (fadeIn != null) {
      this.clauses.push(`[${input}]fade=t=in:st=${fadeIn.start || 0}:d=${fadeIn.dur || 0.4}:alpha=1[${out}]`);
    } else if (fadeOut != null) {
      this.clauses.push(`[${input}]fade=t=out:st=${fadeOut.start || 0}:d=${fadeOut.dur || 0.4}:alpha=1[${out}]`);
    } else {
      this.clauses.push(`[${input}]copy[${out}]`);
    }
    return out;
  }

  toGraph() {
    return this.clauses.join(';');
  }

  inputs() {
    return this.inps.filter(i => i.path != null);
  }
}

export function safeFontPath(p) {
  return safeFont(p);
}

export function splitWords(text) {
  if (!text) return [];
  return String(text).split(/\s+/).filter(Boolean);
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
