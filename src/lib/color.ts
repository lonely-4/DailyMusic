export type RGB = { r: number; g: number; b: number };
export type Oklab = { L: number; a: number; b: number };
export type Oklch = { L: number; C: number; H: number };

const TONES = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];

export function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '').trim();
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function srgbToLinear(channel: number): number {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const x = Math.min(1, Math.max(0, channel));
  const encoded = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

export function rgbToOklab({ r, g, b }: RGB): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return {
    L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function oklabToLinear({ L, a, b }: Oklab): [number, number, number] {
  const lRoot = L + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = L - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = L - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToRgb(lab: Oklab): RGB {
  const [r, g, b] = oklabToLinear(lab);
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

export function rgbToOklch(rgb: RGB): Oklch {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  if (!Number.isFinite(H)) H = 0;
  return { L, C, H };
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(hexToRgb(hex));
}

function inGamut(linear: [number, number, number]): boolean {
  return linear.every((channel) => channel >= -0.0008 && channel <= 1.0008);
}

export function oklchToHex(L: number, C: number, H: number): string {
  const hue = (H * Math.PI) / 180;
  const fits = (chroma: number) =>
    inGamut(oklabToLinear({ L, a: Math.cos(hue) * chroma, b: Math.sin(hue) * chroma }));
  let lo = 0;
  let hi = Math.max(0, C);
  if (!fits(hi)) {
    for (let i = 0; i < 22; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return rgbToHex(oklabToRgb({ L, a: Math.cos(hue) * hi, b: Math.sin(hue) * hi }));
}

export function mixHex(a: string, b: string, amount: number): string {
  const from = rgbToOklab(hexToRgb(a));
  const to = rgbToOklab(hexToRgb(b));
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex(
    oklabToRgb({
      L: from.L + (to.L - from.L) * t,
      a: from.a + (to.a - from.a) * t,
      b: from.b + (to.b - from.b) * t,
    }),
  );
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return distance > 180 ? 360 - distance : distance;
}

export type TonalPalette = Record<number, string>;

export function tonalPalette(hue: number, chroma: number): TonalPalette {
  const palette: TonalPalette = {};
  for (const tone of TONES) {
    const lightness = tone / 100;
    const window = Math.sin(Math.PI * lightness) ** 0.42;
    palette[tone] = oklchToHex(lightness, chroma * window, hue);
  }
  palette[0] = '#000000';
  palette[100] = '#FFFFFF';
  return palette;
}

export type SchemeName =
  | 'primary'
  | 'onPrimary'
  | 'primaryContainer'
  | 'onPrimaryContainer'
  | 'secondary'
  | 'onSecondary'
  | 'secondaryContainer'
  | 'onSecondaryContainer'
  | 'tertiary'
  | 'onTertiary'
  | 'tertiaryContainer'
  | 'onTertiaryContainer'
  | 'error'
  | 'onError'
  | 'errorContainer'
  | 'onErrorContainer'
  | 'background'
  | 'onBackground'
  | 'surface'
  | 'onSurface'
  | 'surfaceVariant'
  | 'onSurfaceVariant'
  | 'outline'
  | 'outlineVariant'
  | 'surfaceDim'
  | 'surfaceBright'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest'
  | 'inverseSurface'
  | 'inverseOnSurface'
  | 'inversePrimary'
  | 'shadow'
  | 'scrim';

export type Scheme = Record<SchemeName, string>;

function role(palette: TonalPalette, tone: number): string {
  return palette[tone] ?? '#000000';
}

export function schemeFromSeed(seed: string, mode: 'light' | 'dark'): Scheme {
  const { L, C, H } = hexToOklch(seed);
  const hue = Number.isFinite(H) ? H : 200;
  const chroma = C < 0.025 ? 0.012 : Math.min(0.145, Math.max(0.07, C));
  const primary = tonalPalette(hue, L < 0.08 ? 0.02 : chroma);
  const secondary = tonalPalette((hue + 18) % 360, chroma * 0.58);
  const tertiary = tonalPalette((hue + 58) % 360, Math.min(0.15, chroma * 0.82));
  const neutral = tonalPalette(hue, Math.min(0.012, chroma));
  const neutralVariant = tonalPalette(hue, Math.min(0.03, chroma * 0.36));
  const error = tonalPalette(28, 0.14);

  if (mode === 'dark') {
    return {
      primary: role(primary, 80),
      onPrimary: role(primary, 20),
      primaryContainer: role(primary, 30),
      onPrimaryContainer: role(primary, 90),
      secondary: role(secondary, 80),
      onSecondary: role(secondary, 20),
      secondaryContainer: role(secondary, 30),
      onSecondaryContainer: role(secondary, 90),
      tertiary: role(tertiary, 80),
      onTertiary: role(tertiary, 20),
      tertiaryContainer: role(tertiary, 30),
      onTertiaryContainer: role(tertiary, 90),
      error: role(error, 80),
      onError: role(error, 20),
      errorContainer: role(error, 30),
      onErrorContainer: role(error, 90),
      background: role(neutral, 6),
      onBackground: role(neutral, 90),
      surface: role(neutral, 6),
      onSurface: role(neutral, 90),
      surfaceVariant: role(neutralVariant, 30),
      onSurfaceVariant: role(neutralVariant, 80),
      outline: role(neutralVariant, 60),
      outlineVariant: role(neutralVariant, 30),
      surfaceDim: role(neutral, 6),
      surfaceBright: role(neutral, 24),
      surfaceContainerLowest: role(neutral, 4),
      surfaceContainerLow: role(neutral, 10),
      surfaceContainer: role(neutral, 12),
      surfaceContainerHigh: role(neutral, 17),
      surfaceContainerHighest: role(neutral, 22),
      inverseSurface: role(neutral, 90),
      inverseOnSurface: role(neutral, 20),
      inversePrimary: role(primary, 40),
      shadow: '#000000',
      scrim: '#000000',
    };
  }

  return {
    primary: role(primary, 40),
    onPrimary: role(primary, 100),
    primaryContainer: role(primary, 90),
    onPrimaryContainer: role(primary, 10),
    secondary: role(secondary, 40),
    onSecondary: role(secondary, 100),
    secondaryContainer: role(secondary, 90),
    onSecondaryContainer: role(secondary, 10),
    tertiary: role(tertiary, 40),
    onTertiary: role(tertiary, 100),
    tertiaryContainer: role(tertiary, 90),
    onTertiaryContainer: role(tertiary, 10),
    error: role(error, 40),
    onError: role(error, 100),
    errorContainer: role(error, 90),
    onErrorContainer: role(error, 10),
    background: role(neutral, 98),
    onBackground: role(neutral, 10),
    surface: role(neutral, 98),
    onSurface: role(neutral, 10),
    surfaceVariant: role(neutralVariant, 90),
    onSurfaceVariant: role(neutralVariant, 30),
    outline: role(neutralVariant, 50),
    outlineVariant: role(neutralVariant, 80),
    surfaceDim: role(neutral, 87),
    surfaceBright: role(neutral, 98),
    surfaceContainerLowest: role(neutral, 100),
    surfaceContainerLow: role(neutral, 96),
    surfaceContainer: role(neutral, 94),
    surfaceContainerHigh: role(neutral, 92),
    surfaceContainerHighest: role(neutral, 90),
    inverseSurface: role(neutral, 20),
    inverseOnSurface: role(neutral, 95),
    inversePrimary: role(primary, 80),
    shadow: '#000000',
    scrim: '#000000',
  };
}

export function applyScheme(scheme: Scheme, mode: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  for (const [key, value] of Object.entries(scheme)) {
    const name = `--md-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    root.style.setProperty(name, value);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme.surface);
}

export function seedFromSwatch(swatch: Oklch): string {
  if (swatch.C < 0.03) return oklchToHex(0.55, 0.014, swatch.H || 200);
  return oklchToHex(0.56, Math.min(0.14, Math.max(0.075, swatch.C)), swatch.H);
}
