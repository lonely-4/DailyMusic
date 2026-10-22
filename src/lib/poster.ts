import { mdiPlayCircle, mdiSkipNext, mdiSkipPrevious } from '@mdi/js';
import { withAlpha } from './color';
import type { Swatch } from './palette';

export type Template = 'playlist' | 'kokoro';

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
  released: string;
  note: string;
  dateLabel: string;
  serial: string;
};

export const SANS = 'Roboto, "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", sans-serif';

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (typeof SVGImageElement !== 'undefined' && source instanceof SVGImageElement) return { width: 800, height: 800 };
  if ('width' in source && 'height' in source && typeof source.width === 'number' && typeof source.height === 'number') {
    return { width: source.width, height: source.height };
  }
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

function titleParts(title: string): { main: string; extra: string } {
  const trimmed = title.trim();
  const paren = trimmed.match(/^(.*?)\s*[（(]([^）)]+)[）)]\s*$/);
  let main = (paren ? paren[1] : trimmed).trim();
  let extra = paren ? paren[2].trim() : '';
  const bilingual = main.match(/^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}].*?)[ \u3000]+([A-Za-z].*)$/u);
  if (bilingual) {
    main = bilingual[1].trim();
    extra = [bilingual[2].trim(), extra].filter(Boolean).join('  ');
  }
  return { main: main || trimmed, extra };
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

export function renderPoster(canvas: HTMLCanvasElement, input: PosterInput) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = input.width;
  canvas.height = input.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, input.width, input.height);
  drawPlayer(ctx, input);
}

function drawPlayer(ctx: CanvasRenderingContext2D, input: PosterInput) {
  const { width: w, height: h, image } = input;
  const cream = '#F4EFE4';
  const blur = Math.max(32, input.blur + 26);
  ctx.save();
  ctx.filter = `blur(${blur}px) saturate(1.45) brightness(0.78)`;
  drawCover(ctx, image, -blur * 2, -blur * 2, w + blur * 4, h + blur * 4);
  ctx.filter = 'none';
  ctx.restore();
  ctx.fillStyle = withAlpha('#12100E', 0.16 + input.darkness * 0.22);
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.72, h * 0.48, w * 0.02, w * 0.7, h * 0.5, w * 0.46);
  glow.addColorStop(0, withAlpha(input.seed, 0.28));
  glow.addColorStop(1, withAlpha(input.seed, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const landscape = w / h >= 1.15;
  const margin = Math.round(Math.min(w, h) * 0.075);
  const coverMax = landscape ? Math.min(h - margin * 2, w * 0.4) : Math.min(w - margin * 2, h * 0.46);
  const cover = Math.round(coverMax);
  const coverX = landscape ? Math.round(w * 0.065) : Math.round((w - cover) / 2);
  const coverY = landscape ? Math.round((h - cover) / 2) : margin;
  const radius = Math.max(18, cover * 0.04);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = Math.round(cover * 0.06);
  ctx.shadowOffsetY = Math.round(cover * 0.025);
  roundRect(ctx, coverX, coverY, cover, cover, radius);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, coverX, coverY, cover, cover, radius);
  ctx.clip();
  drawCover(ctx, image, coverX, coverY, cover, cover);
  const shade = ctx.createLinearGradient(0, coverY + cover * 0.58, 0, coverY + cover);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = shade;
  ctx.fillRect(coverX, coverY + cover * 0.5, cover, cover * 0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  const album = `专辑<${input.album || input.title}>`;
  let albumSize = Math.round(cover * 0.04);
  ctx.font = `500 ${albumSize}px ${SANS}`;
  while (albumSize > 14 && ctx.measureText(album).width > cover * 0.84) {
    albumSize -= 1;
    ctx.font = `500 ${albumSize}px ${SANS}`;
  }
  ctx.fillText(album, coverX + cover / 2, coverY + cover * 0.855);
  ctx.font = `400 ${Math.round(albumSize * 0.92)}px ${SANS}`;
  ctx.fillText(input.released || input.year, coverX + cover / 2, coverY + cover * 0.915);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, coverX, coverY, cover, cover, radius);
  ctx.stroke();
  ctx.restore();

  const textLeft = landscape ? coverX + cover + margin : margin;
  const textRight = w - (landscape ? Math.round(w * 0.07) : margin);
  const textWidth = Math.max(120, textRight - textLeft);
  const textCenter = textLeft + textWidth / 2;
  const blockTop = landscape ? 0 : coverY + cover + margin * 0.7;
  const blockHeight = landscape ? h : h - blockTop - margin;

  const hero = Math.round(Math.min(h, w) * (landscape ? 0.112 : 0.078));
  const control = Math.round(hero * 0.72);
  const kickerSize = Math.max(18, Math.round(hero * 0.34));
  const artistSize = Math.max(18, Math.round(hero * 0.36));
  const gap = Math.round(hero * 0.38);
  const kicker = '『日推歌单』';
  const artist = `『${input.artist || '未知艺人'}』`;
  const parts = titleParts(input.title);
  let titleSize = hero;
  ctx.font = `700 ${titleSize}px ${SANS}`;
  const titleFloor = Math.round(hero * 0.56);
  while (titleSize > titleFloor && ctx.measureText(parts.main).width > textWidth) {
    titleSize -= 2;
    ctx.font = `700 ${titleSize}px ${SANS}`;
  }
  const titleLines = wrapText(ctx, parts.main, textWidth).slice(0, 2);
  let extraSize = 0;
  let extraLines: string[] = [];
  if (parts.extra) {
    extraSize = Math.max(22, Math.round(titleSize * 0.42));
    ctx.font = `500 ${extraSize}px ${SANS}`;
    while (extraSize > 18 && ctx.measureText(parts.extra).width > textWidth) {
      extraSize -= 1;
      ctx.font = `500 ${extraSize}px ${SANS}`;
    }
    extraLines = wrapText(ctx, parts.extra, textWidth).slice(0, 2);
  }
  const titleBlock =
    titleLines.length * titleSize * 1.12 +
    (extraLines.length ? gap * 0.35 + extraLines.length * extraSize * 1.25 : 0);
  const block = kickerSize + gap * 0.7 + titleBlock + gap * 0.55 + artistSize + gap + control;
  let y = blockTop + Math.max(margin * 0.4, (blockHeight - block) / 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = cream;
  ctx.font = `500 ${kickerSize}px ${SANS}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(kicker, textCenter, y);
  ctx.letterSpacing = '0px';
  y += kickerSize + gap * 0.7;

  ctx.font = `700 ${titleSize}px ${SANS}`;
  ctx.fillStyle = cream;
  for (const line of titleLines) {
    ctx.fillText(line, textCenter, y);
    y += titleSize * 1.12;
  }
  if (extraLines.length) {
    y += gap * 0.15;
    ctx.font = `500 ${extraSize}px ${SANS}`;
    ctx.fillStyle = withAlpha(cream, 0.88);
    for (const line of extraLines) {
      ctx.fillText(line, textCenter, y);
      y += extraSize * 1.25;
    }
  }
  y += gap * 0.15;
  ctx.font = `500 ${artistSize}px ${SANS}`;
  ctx.fillStyle = withAlpha(cream, 0.92);
  let artistDraw = artist;
  if (ctx.measureText(artistDraw).width > textWidth) {
    ctx.font = `500 ${Math.max(14, artistSize - 6)}px ${SANS}`;
    artistDraw = wrapText(ctx, artist, textWidth)[0] ?? artist;
  }
  ctx.fillText(artistDraw, textCenter, y);
  y += artistSize + gap;
  drawTransport(ctx, textCenter, y + control * 0.45, control, cream);
  ctx.textAlign = 'left';
}

function drawMdiIcon(ctx: CanvasRenderingContext2D, path: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path), 'evenodd');
  ctx.restore();
}

function drawTransport(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const gap = size * 1.15;
  drawMdiIcon(ctx, mdiSkipPrevious, cx - gap, cy, size * 0.62, color);
  drawMdiIcon(ctx, mdiPlayCircle, cx, cy, size, color);
  drawMdiIcon(ctx, mdiSkipNext, cx + gap, cy, size * 0.62, color);
}

export const RATIOS = {
  poster: { width: 1080, height: 1350, label: '4:5' },
  story: { width: 1080, height: 1920, label: '9:16' },
  square: { width: 1080, height: 1080, label: '1:1' },
  wide: { width: 1920, height: 1080, label: '16:9' },
} as const;

export type RatioId = keyof typeof RATIOS;

export type Theme = {
  id: Template;
  label: string;
  name: string;
  ratio: RatioId;
  aliases: string[];
};

export const THEMES: Theme[] = [
  { id: 'playlist', label: '1', name: 'playlist', ratio: 'wide', aliases: ['1', 'playlist', '歌单', 'player'] },
  { id: 'kokoro', label: '2', name: '心予報', ratio: 'wide', aliases: ['2', '心予報', '心予报', 'kokoro'] },
];

export function resolveTheme(name: string): Theme | undefined {
  const raw = name.trim();
  const key = raw.toLowerCase();
  return THEMES.find(
    (theme) =>
      theme.id === key ||
      theme.label === raw ||
      theme.name.toLowerCase() === key ||
      theme.aliases.some((alias) => alias.toLowerCase() === key),
  );
}

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
