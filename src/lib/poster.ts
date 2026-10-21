import { hexToOklch, hueDistance, mixHex, tonalPalette, withAlpha, type TonalPalette } from './color';
import type { Swatch } from './palette';

export type Template = 'immersive' | 'editorial' | 'film' | 'lyric';

export type PosterInput = {
  image: CanvasImageSource;
  swatches: Swatch[];
  seed: string;
  highKey: boolean;
  edge: string;
  template: Template;
  tone: 'light' | 'dark';
  width: number;
  height: number;
  blur: number;
  darkness: number;
  grain: number;
  title: string;
  subtitle: string;
  artist: string;
  album: string;
  duration: string;
  year: string;
  note: string;
  dateLabel: string;
  serial: string;
};

export const SANS = 'Roboto, "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", sans-serif';
export const SERIF = '"Noto Serif SC", "Noto Serif CJK SC", "Songti SC", serif';

type Ink = {
  ink: string;
  mute: string;
  accent: string;
  paper: string;
  scrim: string;
  pin?: string;
  primary: TonalPalette;
};

let noiseTile: HTMLCanvasElement | null = null;

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
  if (source instanceof SVGImageElement) return { width: 800, height: 800 };
  if ('width' in source && 'height' in source) return { width: source.width, height: source.height };
  return { width: 800, height: 800 };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  align: 'center' | 'top' = 'center',
) {
  const { width, height } = sourceSize(image);
  if (!width || !height) return;
  const scale = Math.max(w / width, h / height);
  const dw = width * scale;
  const dh = height * scale;
  const dx = x + (w - dw) / 2;
  const dy = align === 'top' ? y : y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function drawContainWidth(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  maxH: number,
): number {
  const { width, height } = sourceSize(image);
  if (!width || !height) return y;
  const dh = Math.min(maxH, w * (height / width));
  const scale = dh / height;
  const dw = width * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y, dw, dh);
  return dh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    if (char === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char.trim() ? char : '';
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, light: boolean) {
  if (amount <= 0.01) return;
  if (!noiseTile) {
    noiseTile = document.createElement('canvas');
    noiseTile.width = 160;
    noiseTile.height = 160;
    const nctx = noiseTile.getContext('2d');
    if (!nctx) return;
    const image = nctx.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.random() * 255;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    nctx.putImageData(image, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = light ? 'multiply' : 'overlay';
  ctx.globalAlpha = light ? amount * 0.45 : amount;
  const pattern = ctx.createPattern(noiseTile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, withAlpha(color, alpha));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function buildInk(input: PosterInput): Ink {
  const seed = hexToOklch(input.seed);
  const chroma = seed.C < 0.03 ? 0.02 : Math.min(0.16, Math.max(0.08, seed.C));
  const primary = tonalPalette(seed.H, chroma);
  const neutral = tonalPalette(seed.H, 0.012);
  const pin = input.swatches.find(
    (swatch) => swatch.C > 0.055 && hueDistance(swatch.H, seed.H) > 26 && swatch.L > 0.28 && swatch.L < 0.75,
  );
  const tintedPaper = mixHex(input.edge || '#F7F7F7', neutral[98] ?? '#F7F7F7', 0.42);
  return {
    primary,
    ink: input.tone === 'light' ? (neutral[12] ?? '#1A1C1C') : (neutral[98] ?? '#F6F7F7'),
    mute: input.tone === 'light' ? (neutral[36] ?? '#555') : (neutral[80] ?? '#D5D8D8'),
    accent: input.tone === 'light' ? (primary[38] ?? input.seed) : (primary[80] ?? input.seed),
    paper: input.tone === 'light' ? tintedPaper : (neutral[8] ?? '#121414'),
    scrim: neutral[10] ?? '#161818',
    pin: pin?.hex,
  };
}

function metaLine(input: PosterInput): string {
  return [input.artist, input.album, input.duration, input.year].filter(Boolean).join('   ·   ');
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  ink: Ink,
  x: number,
  y: number,
  width: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = withAlpha(ink.accent, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + width, y - 22);
  ctx.stroke();

  ctx.font = `500 15px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '4px';
  ctx.fillText('DAILY', x, y);
  const brandWidth = ctx.measureText('DAILY').width;
  ctx.letterSpacing = '0px';

  const dots = input.swatches.slice(0, 5);
  let dx = x + brandWidth + 22;
  for (const swatch of dots) {
    ctx.beginPath();
    ctx.fillStyle = swatch.hex;
    ctx.arc(dx + 7, y, 7, 0, Math.PI * 2);
    ctx.fill();
    if (swatch.L > 0.9) {
      ctx.strokeStyle = withAlpha(ink.ink, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    dx += 22;
  }

  ctx.font = `500 15px ${SANS}`;
  ctx.fillStyle = color;
  const credit = '网易云音乐';
  const creditWidth = ctx.measureText(credit).width;
  ctx.fillText(credit, x + width - creditWidth, y);
  ctx.restore();
}

function drawKicker(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  ink: Ink,
  x: number,
  y: number,
  width: number,
) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = `500 18px ${SANS}`;
  ctx.fillStyle = ink.accent;
  ctx.letterSpacing = '2px';
  ctx.fillText('今日推荐', x, y);
  const labelWidth = ctx.measureText('今日推荐').width;
  ctx.letterSpacing = '0px';
  ctx.fillStyle = ink.ink;
  ctx.font = `400 18px ${SANS}`;
  const date = `   ${input.dateLabel}`;
  ctx.fillText(date, x + labelWidth, y);
  const dateWidth = ctx.measureText(date).width;
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = ink.ink;
  ctx.letterSpacing = '2px';
  const serial = input.serial;
  const serialWidth = ctx.measureText(serial).width;
  ctx.fillText(serial, x + width - serialWidth, y + 1);
  ctx.letterSpacing = '0px';
  if (ink.pin) {
    ctx.beginPath();
    ctx.fillStyle = ink.pin;
    ctx.arc(x + labelWidth + dateWidth + 14, y + 10, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function titleSizeFor(title: string): number {
  const length = [...title].length;
  if (length <= 3) return 104;
  if (length <= 6) return 78;
  if (length <= 10) return 62;
  return 50;
}

export function renderPoster(canvas: HTMLCanvasElement, input: PosterInput) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = input.width;
  canvas.height = input.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const ink = buildInk(input);
  ctx.clearRect(0, 0, input.width, input.height);

  if (input.template === 'editorial') drawEditorial(ctx, input, ink);
  else if (input.template === 'film') drawFilm(ctx, input, ink);
  else if (input.template === 'lyric') drawLyric(ctx, input, ink);
  else drawImmersive(ctx, input, ink);

  grain(ctx, input.width, input.height, input.grain, input.tone === 'light');
}

function drawImmersive(ctx: CanvasRenderingContext2D, input: PosterInput, ink: Ink) {
  const { width: w, height: h, image } = input;
  const paperLayout = input.tone === 'light' && input.highKey;
  const pad = Math.round(w * 0.068);

  if (paperLayout) {
    const minBand = Math.round(h * (h / w > 1.55 ? 0.32 : 0.3));
    ctx.fillStyle = ink.paper;
    ctx.fillRect(0, 0, w, h);
    const { width: iw, height: ih } = sourceSize(image);
    const artH = iw ? Math.min(h - minBand, w * (ih / iw)) : h - minBand;
    ctx.save();
    if (input.blur > 0) ctx.filter = `blur(${input.blur}px)`;
    const bleed = input.blur;
    drawContainWidth(ctx, image, -bleed, 0, w + bleed * 2, artH + bleed);
    ctx.filter = 'none';
    ctx.restore();
    const fade = ctx.createLinearGradient(0, artH - 70, 0, artH + 8);
    fade.addColorStop(0, withAlpha(ink.paper, 0));
    fade.addColorStop(1, ink.paper);
    ctx.fillStyle = fade;
    ctx.fillRect(0, artH - 70, w, 86);
    const wash = mixHex(ink.paper, ink.scrim, input.darkness * 0.16);
    ctx.fillStyle = withAlpha(wash, 0.55);
    ctx.fillRect(0, artH, w, h - artH);

    const top = artH + Math.round((h - artH) * 0.08);
    drawKicker(ctx, input, ink, pad, top, w - pad * 2);
    let y = top + 46;
    ctx.textBaseline = 'top';
    ctx.fillStyle = ink.ink;
    let size = titleSizeFor(input.title);
    ctx.font = `700 ${size}px ${SERIF}`;
    while (size > 42 && ctx.measureText(input.title).width > w - pad * 2) {
      size -= 2;
      ctx.font = `700 ${size}px ${SERIF}`;
    }
    ctx.fillText(input.title, pad, y);
    y += size + 10;
    if (input.subtitle) {
      ctx.fillStyle = ink.accent;
      ctx.font = `600 ${Math.round(size * 0.34)}px ${SERIF}`;
      ctx.fillText(input.subtitle, pad, y);
      y += Math.round(size * 0.34) + 22;
    } else y += 8;
    ctx.fillStyle = ink.mute;
    ctx.font = `400 20px ${SANS}`;
    const meta = wrapText(ctx, metaLine(input), w - pad * 2);
    for (const line of meta.slice(0, 2)) {
      ctx.fillText(line, pad, y);
      y += 30;
    }
    if (input.note) {
      y += 8;
      ctx.fillStyle = ink.ink;
      ctx.font = `600 28px ${SERIF}`;
      const notes = wrapText(ctx, input.note, w - pad * 2).slice(0, 2);
      for (const line of notes) {
        ctx.fillText(line, pad, y);
        y += 40;
      }
    }
    drawFooter(ctx, input, ink, pad, h - 52, w - pad * 2, ink.mute);
    return;
  }

  ctx.save();
  if (input.blur > 0) ctx.filter = `blur(${input.blur}px)`;
  const bleed = input.blur > 0 ? input.blur * 2 : 0;
  drawCover(ctx, image, -bleed, -bleed, w + bleed * 2, h + bleed * 2);
  ctx.filter = 'none';
  ctx.restore();

  orb(ctx, w * 0.12, h * 0.18, w * 0.42, ink.accent, input.tone === 'dark' ? 0.28 : 0.16);
  if (ink.pin) orb(ctx, w * 0.86, h * 0.72, w * 0.36, ink.pin, 0.18);

  const strength = Math.min(0.94, (input.tone === 'dark' ? 0.78 : 0.34) + input.darkness * 0.28);
  const scrim = ctx.createLinearGradient(0, h * 0.46, 0, h);
  scrim.addColorStop(0, withAlpha(ink.scrim, 0));
  scrim.addColorStop(0.38, withAlpha(ink.scrim, strength * 0.62));
  scrim.addColorStop(1, withAlpha(ink.scrim, strength));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);
  const topShade = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  topShade.addColorStop(0, withAlpha(ink.scrim, 0.4));
  topShade.addColorStop(1, withAlpha(ink.scrim, 0));
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, w, h * 0.22);

  const padX = Math.round(w * 0.072);
  const textTop = h * 0.62;
  const fadeTop = textTop - 140;
  const fade = ctx.createLinearGradient(0, fadeTop, 0, textTop - 36);
  fade.addColorStop(0, withAlpha(ink.scrim, 0));
  fade.addColorStop(1, withAlpha('#050808', 0.94));
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, w, textTop - 36 - fadeTop);
  ctx.fillStyle = withAlpha('#050808', 0.94);
  ctx.fillRect(0, textTop - 36, w, h - textTop + 36);
  drawKicker(ctx, input, ink, padX, textTop, w - padX * 2);
  ctx.textBaseline = 'top';
  ctx.fillStyle = ink.ink;
  ctx.shadowColor = withAlpha('#000000', input.tone === 'dark' ? 0.45 : 0);
  ctx.shadowBlur = 18;
  let size = Math.min(titleSizeFor(input.title), 92);
  ctx.font = `700 ${size}px ${SERIF}`;
  while (size > 40 && ctx.measureText(input.title).width > w - padX * 2) {
    size -= 2;
    ctx.font = `700 ${size}px ${SERIF}`;
  }
  ctx.fillText(input.title, padX, textTop + 42);
  ctx.shadowBlur = 0;
  let y = textTop + 42 + size + 8;
  if (input.subtitle) {
    ctx.fillStyle = ink.accent;
    ctx.font = `600 ${Math.round(size * 0.32)}px ${SERIF}`;
    ctx.fillText(input.subtitle, padX, y);
    y += Math.round(size * 0.32) + 18;
  }
  ctx.fillStyle = withAlpha(ink.ink, 0.8);
  ctx.font = `400 20px ${SANS}`;
  ctx.fillText(metaLine(input), padX, y);
  y += 36;
  if (input.note) {
    ctx.fillStyle = ink.ink;
    ctx.font = `600 28px ${SERIF}`;
    for (const line of wrapText(ctx, input.note, w - padX * 2).slice(0, 2)) {
      ctx.fillText(line, padX, y);
      y += 40;
    }
  }
  drawFooter(ctx, input, ink, padX, h - 56, w - padX * 2, withAlpha(ink.ink, 0.78));
}

function drawEditorial(ctx: CanvasRenderingContext2D, input: PosterInput, ink: Ink) {
  const { width: w, height: h } = input;
  const margin = Math.round(w * 0.06);
  ctx.fillStyle = input.tone === 'light' ? ink.paper : ink.scrim;
  ctx.fillRect(0, 0, w, h);
  const frameH = Math.round(h * (h / w > 1.55 ? 0.58 : 0.62));
  const frameY = margin;
  ctx.save();
  ctx.shadowColor = withAlpha(ink.scrim, 0.22);
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, margin, frameY, w - margin * 2, frameH, 36);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  if (input.blur > 0) ctx.filter = `blur(${input.blur * 0.6}px)`;
  drawCover(ctx, input.image, margin, frameY, w - margin * 2, frameH, input.highKey ? 'top' : 'center');
  ctx.filter = 'none';
  ctx.restore();

  const chipY = frameY + frameH - 22;
  ctx.font = `500 16px ${SANS}`;
  const chip = '今日推荐';
  const chipW = ctx.measureText(chip).width + 36;
  roundRect(ctx, margin + 28, chipY, chipW, 44, 22);
  ctx.fillStyle = ink.accent;
  ctx.fill();
  ctx.fillStyle = input.tone === 'light' ? '#FFFFFF' : ink.scrim;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.fillText(chip, margin + 46, chipY + 22);
  ctx.letterSpacing = '0px';

  const textInk = input.tone === 'light' ? ink.ink : '#F4F6F6';
  const textMute = input.tone === 'light' ? ink.mute : '#C9D0D0';
  let y = frameY + frameH + 58;
  const pad = margin + 8;
  ctx.textBaseline = 'top';
  ctx.fillStyle = textMute;
  ctx.font = `500 16px ${SANS}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(`${input.dateLabel}    ${input.serial}`, pad, y);
  ctx.letterSpacing = '0px';
  y += 36;
  ctx.fillStyle = textInk;
  let size = Math.min(titleSizeFor(input.title), 92);
  ctx.font = `700 ${size}px ${SERIF}`;
  while (size > 40 && ctx.measureText(input.title).width > w - pad * 2) {
    size -= 2;
    ctx.font = `700 ${size}px ${SERIF}`;
  }
  ctx.fillText(input.title, pad, y);
  y += size + 8;
  if (input.subtitle) {
    ctx.fillStyle = ink.accent;
    ctx.font = `600 ${Math.round(size * 0.36)}px ${SERIF}`;
    ctx.fillText(input.subtitle, pad, y);
    y += Math.round(size * 0.36) + 18;
  }
  ctx.fillStyle = textMute;
  ctx.font = `400 20px ${SANS}`;
  for (const line of wrapText(ctx, metaLine(input), w - pad * 2).slice(0, 2)) {
    ctx.fillText(line, pad, y);
    y += 30;
  }
  if (input.note) {
    y += 6;
    ctx.fillStyle = textInk;
    ctx.font = `600 26px ${SERIF}`;
    for (const line of wrapText(ctx, input.note, w - pad * 2).slice(0, 2)) {
      ctx.fillText(line, pad, y);
      y += 38;
    }
  }
  drawFooter(ctx, input, ink, pad, h - 48, w - pad - margin, textMute);
}

function drawFilm(ctx: CanvasRenderingContext2D, input: PosterInput, ink: Ink) {
  const { width: w, height: h } = input;
  const bar = Math.round(h * (h / w > 1.6 ? 0.16 : 0.13));
  ctx.fillStyle = input.tone === 'light' ? ink.paper : '#090A0A';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bar, w, h - bar * 2);
  ctx.clip();
  if (input.blur > 0) ctx.filter = `blur(${input.blur}px)`;
  drawCover(ctx, input.image, 0, bar, w, h - bar * 2, input.highKey ? 'top' : 'center');
  ctx.filter = 'none';
  ctx.restore();

  const hole = input.tone === 'light' ? withAlpha(ink.scrim, 0.28) : 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 7; i += 1) {
    const y = bar + 28 + i * ((h - bar * 2 - 40) / 7);
    roundRect(ctx, 18, y, 16, 26, 4);
    ctx.fillStyle = hole;
    ctx.fill();
    roundRect(ctx, w - 34, y, 16, 26, 4);
    ctx.fill();
  }

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = input.tone === 'light' ? ink.ink : '#F3F5F5';
  ctx.font = `500 18px ${SANS}`;
  ctx.letterSpacing = '5px';
  ctx.fillText('DAILY MUSIC', 56, bar * 0.5);
  ctx.letterSpacing = '1px';
  const dateWidth = ctx.measureText(input.dateLabel).width;
  ctx.fillText(input.dateLabel, w - 56 - dateWidth, bar * 0.5);
  ctx.letterSpacing = '0px';

  const text = input.tone === 'light' ? ink.ink : '#F4F6F6';
  ctx.textBaseline = 'top';
  ctx.fillStyle = text;
  let size = Math.min(titleSizeFor(input.title), 72);
  ctx.font = `700 ${size}px ${SERIF}`;
  while (size > 36 && ctx.measureText(input.title).width > w - 120) {
    size -= 2;
    ctx.font = `700 ${size}px ${SERIF}`;
  }
  ctx.fillText(input.title, 56, h - bar + 28);
  ctx.fillStyle = ink.accent;
  ctx.font = `500 22px ${SANS}`;
  const sub = [input.subtitle, input.artist].filter(Boolean).join('   ·   ');
  ctx.fillText(sub, 56, h - bar + 28 + size + 8);
  ctx.fillStyle = input.tone === 'light' ? ink.mute : '#C5CDCD';
  ctx.font = `400 18px ${SANS}`;
  ctx.fillText([input.album, input.note].filter(Boolean).join('    '), 56, h - bar + 28 + size + 42);
  ctx.restore();

  const vignette = ctx.createLinearGradient(0, bar, 0, bar + 50);
  vignette.addColorStop(0, withAlpha('#000000', input.darkness * 0.25));
  vignette.addColorStop(1, withAlpha('#000000', 0));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, bar, w, 50);
}

function drawLyric(ctx: CanvasRenderingContext2D, input: PosterInput, ink: Ink) {
  const { width: w, height: h } = input;
  const blur = Math.max(26, input.blur);
  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  drawCover(ctx, input.image, -40, -40, w + 80, h + 80);
  ctx.filter = 'none';
  ctx.restore();
  ctx.fillStyle = withAlpha(input.tone === 'light' ? ink.paper : ink.scrim, 0.55 + input.darkness * 0.25);
  ctx.fillRect(0, 0, w, h);
  orb(ctx, w * 0.5, h * 0.46, w * 0.55, ink.accent, 0.2);

  const r = Math.round(w * 0.11);
  const cx = w / 2;
  const cy = h * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  drawCover(ctx, input.image, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(ink.ink, 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();

  const quote = input.note || input.subtitle || input.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ink.accent;
  ctx.font = `700 72px ${SERIF}`;
  ctx.fillText('“', cx, h * 0.4);
  let size = [...quote].length > 12 ? 48 : 60;
  ctx.fillStyle = ink.ink;
  ctx.font = `600 ${size}px ${SERIF}`;
  let lines = wrapText(ctx, quote, w * 0.78);
  while (lines.length > 3 && size > 32) {
    size -= 2;
    ctx.font = `600 ${size}px ${SERIF}`;
    lines = wrapText(ctx, quote, w * 0.78);
  }
  let y = h * 0.48;
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, cx, y);
    y += size * 1.35;
  }
  ctx.fillStyle = ink.mute;
  ctx.font = `500 20px ${SANS}`;
  ctx.letterSpacing = '2px';
  ctx.fillText([input.title, input.artist].filter(Boolean).join('    ·    '), cx, y + 18);
  ctx.letterSpacing = '0px';
  ctx.font = `400 16px ${SANS}`;
  ctx.fillText(`${input.dateLabel}    ${input.serial}`, cx, h - 56);
  ctx.textAlign = 'left';
}

export const RATIOS = {
  poster: { width: 1080, height: 1350, label: '4:5' },
  story: { width: 1080, height: 1920, label: '9:16' },
  square: { width: 1080, height: 1080, label: '1:1' },
} as const;

export type RatioId = keyof typeof RATIOS;

export function posterDate(date: Date): { dateLabel: string; serial: string } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(date);
  const utc = Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1);
  const start = Date.UTC(year ?? 2026, 0, 1);
  const serial = Math.floor((utc - start) / 86_400_000) + 1;
  return {
    dateLabel: `${year}.${month}.${day} ${weekday}`,
    serial: `NO.${String(serial).padStart(3, '0')}`,
  };
}
