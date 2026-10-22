import { rgbToHex, rgbToOklch, type Oklch } from './color';
import { createSurface } from './surface';

export type Swatch = Oklch & {
  hex: string;
  r: number;
  g: number;
  b: number;
  n: number;
};

export type Palette = {
  swatches: Swatch[];
  meanL: number;
  brightRatio: number;
  highKey: boolean;
  edge: string;
};

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

export function extractPalette(source: CanvasImageSource, count = 5): Palette {
  const sample = 96;
  const canvas = createSurface(sample, sample);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return { swatches: [], meanL: 0.5, brightRatio: 0, highKey: false, edge: '#F4F4F4' };
  }

  const { width, height } = sourceSize(source);
  const scale = Math.max(sample / width, sample / height);
  const dw = width * scale;
  const dh = height * scale;
  context.drawImage(source, (sample - dw) / 2, (sample - dh) / 2, dw, dh);
  const { data } = context.getImageData(0, 0, sample, sample);

  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let lightnessSum = 0;
  let pixels = 0;
  let bright = 0;
  let edgeR = 0;
  let edgeG = 0;
  let edgeB = 0;
  let edgeN = 0;
  const edgeStart = Math.floor(sample * 0.9);

  for (let y = 0; y < sample; y += 1) {
    for (let x = 0; x < sample; x += 1) {
      const index = (y * sample + x) * 4;
      const alpha = data[index + 3] ?? 0;
      if (alpha < 200) continue;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const { L } = rgbToOklch({ r, g, b });
      lightnessSum += L;
      pixels += 1;
      if (L > 0.84) bright += 1;
      if (y >= edgeStart) {
        edgeR += r;
        edgeG += g;
        edgeB += b;
        edgeN += 1;
      }
      const qr = Math.round(r / 14) * 14;
      const qg = Math.round(g / 14) * 14;
      const qb = Math.round(b / 14) * 14;
      const key = `${qr},${qg},${qb}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.n += 1;
      else buckets.set(key, { r: qr, g: qg, b: qb, n: 1 });
    }
  }

  const scored: Swatch[] = [...buckets.values()].map((bucket) => {
    const oklch = rgbToOklch(bucket);
    return { ...bucket, ...oklch, hex: rgbToHex(bucket) };
  });

  const chromatic = scored
    .filter((swatch) => swatch.C >= 0.028 && swatch.L > 0.16 && swatch.L < 0.88)
    .sort((a, b) => score(b) - score(a));

  const picked: Swatch[] = [];
  for (const swatch of chromatic) {
    const distinct = picked.every(
      (current) => hueGap(current.H, swatch.H) >= 22 || Math.abs(current.L - swatch.L) > 0.26,
    );
    if (distinct) picked.push(swatch);
    if (picked.length >= count) break;
  }

  if (!picked.length) {
    const fallback = [...scored].sort((a, b) => b.n - a.n).slice(0, count);
    picked.push(...fallback);
  }

  const meanL = pixels ? lightnessSum / pixels : 0.5;
  const brightRatio = pixels ? bright / pixels : 0;
  const edge = edgeN
    ? rgbToHex({ r: edgeR / edgeN, g: edgeG / edgeN, b: edgeB / edgeN })
    : '#F5F5F5';

  return {
    swatches: picked,
    meanL,
    brightRatio,
    highKey: brightRatio > 0.34 || meanL > 0.74,
    edge,
  };
}

function score(swatch: Swatch): number {
  const light = Math.max(0.2, 1 - Math.abs(swatch.L - 0.55) * 1.15);
  return swatch.n ** 0.62 * swatch.C ** 0.9 * light;
}

function hueGap(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return distance > 180 ? 360 - distance : distance;
}
