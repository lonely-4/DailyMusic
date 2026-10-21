import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { createCanvas, GlobalFonts, loadImage, Path2D } from '@napi-rs/canvas';
import { seedFromSwatch } from './lib/color';
import { fetchTrack, parseShare, resolveShortLink, searchTracks, type Track } from './lib/netease';
import { extractPalette } from './lib/palette';
import { RATIOS, posterDate, renderPoster, type RatioId, type Template } from './lib/poster';

globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D;
(globalThis as { __dailyCanvas?: (width: number, height: number) => HTMLCanvasElement }).__dailyCanvas = (width, height) => {
  const canvas = createCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLCanvasElement;
};

const TEMPLATES = new Map<string, Template>([
  ['immersive', 'immersive'],
  ['沉浸', 'immersive'],
  ['player', 'player'],
  ['歌单', 'player'],
  ['editorial', 'editorial'],
  ['刊头', 'editorial'],
  ['film', 'film'],
  ['胶片', 'film'],
  ['lyric', 'lyric'],
  ['独白', 'lyric'],
]);

const RATIO_IDS = new Map<string, RatioId>([
  ['4:5', 'poster'],
  ['poster', 'poster'],
  ['9:16', 'story'],
  ['story', 'story'],
  ['1:1', 'square'],
  ['square', 'square'],
  ['16:9', 'wide'],
  ['wide', 'wide'],
]);

const HELP = `日推海报

用法
  daily-music [链接或分享文案] [选项]
  daily-music                  回车后粘贴链接

选项
  -o, --out <文件>        输出 PNG，默认用歌名和艺人命名
  -t, --template <版式>   沉浸 immersive | 歌单 player | 刊头 editorial | 胶片 film | 独白 lyric
  -r, --ratio <画幅>      4:5 | 9:16 | 1:1 | 16:9
      --tone <light|dark> 浅底或深底，默认按封面明暗决定
  -n, --note <文字>       海报上的一句旁白
      --api <地址>        曲库接口，默认 https://ncme-vc.vercel.app
  -h, --help

示例
  daily-music "https://163cn.tv/bi94lQEJ"
  daily-music "https://y.music.163.com/m/song?id=1423990087" -t 歌单 -o 心予報.png
`;

function registerFonts() {
  const pairs: Array<[string, string]> = [
    ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'Noto Sans CJK SC'],
    ['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 'Noto Sans CJK SC'],
    ['/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc', 'Noto Serif CJK SC'],
    ['/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 'Noto Serif CJK SC'],
  ];
  const found = new Set(pairs.filter(([file]) => existsSync(file)).map(([file]) => file));
  if (found.size === 0) {
    for (const family of ['Noto Sans CJK SC', 'Noto Serif CJK SC']) {
      try {
        const listed = execFileSync('fc-list', [family, 'file'], { encoding: 'utf8' });
        for (const line of listed.split('\n')) {
          const file = line.split(':')[0]?.trim();
          if (file && existsSync(file)) found.add(file);
        }
      } catch {
        // fontconfig is optional
      }
    }
  }
  for (const file of found) {
    const family = /Serif/i.test(file) ? 'Noto Serif CJK SC' : 'Noto Sans CJK SC';
    GlobalFonts.registerFromPath(file, family);
  }
  if (found.size === 0) {
    console.error('没有找到 Noto CJK 字体，海报里的中文可能无法显示。可安装 fonts-noto-cjk。');
  }
}

async function readInput(positionals: string[]): Promise<string> {
  if (positionals.length) return positionals.join(' ').trim();
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8').trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question('粘贴网易云链接或分享文案：')).trim();
  } finally {
    rl.close();
  }
}

async function resolveTrackId(text: string): Promise<number> {
  const parsed = parseShare(text);
  if (parsed.id) return parsed.id;
  if (parsed.shortUrl) {
    const id = await resolveShortLink(parsed.shortUrl);
    if (id) return id;
  }
  const keyword = parsed.keyword?.trim();
  if (!keyword) throw new Error('请粘贴歌曲链接、歌曲 ID，或歌名');
  const hits = await searchTracks(keyword);
  const exact = hits.find((hit) => hit.name === keyword || hit.name.startsWith(keyword));
  const chosen = exact ?? hits[0];
  if (!chosen) throw new Error(`没有搜到「${keyword}」`);
  if (hits.length > 1) console.error(`匹配到多首，使用 ${chosen.name} · ${chosen.artists}`);
  return chosen.id;
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || '日推';
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      template: { type: 'string', short: 't' },
      ratio: { type: 'string', short: 'r' },
      tone: { type: 'string' },
      note: { type: 'string', short: 'n' },
      api: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  if (values.api) process.env.DAILY_MUSIC_API = values.api;

  const text = await readInput(positionals);
  if (!text) throw new Error('没有收到链接');

  const template = values.template ? TEMPLATES.get(values.template) : 'immersive';
  if (!template) throw new Error(`未知版式「${values.template}」。可用：沉浸、歌单、刊头、胶片、独白`);
  const ratio = values.ratio ? RATIO_IDS.get(values.ratio) : template === 'player' ? 'wide' : 'poster';
  if (!ratio) throw new Error(`未知画幅「${values.ratio}」。可用：4:5、9:16、1:1、16:9`);
  if (values.tone && values.tone !== 'light' && values.tone !== 'dark') {
    throw new Error('--tone 只能是 light 或 dark');
  }

  registerFonts();
  const track: Track = await fetchTrack(await resolveTrackId(text));
  if (!track.coverUrl) throw new Error('这首歌没有封面');
  const cover = await fetch(track.coverUrl);
  if (!cover.ok) throw new Error('封面下载失败');
  const image = await loadImage(Buffer.from(await cover.arrayBuffer()));
  const palette = extractPalette(image as unknown as CanvasImageSource);
  const seed = palette.swatches[0] ? seedFromSwatch(palette.swatches[0]) : '#5E7678';
  const tone = (values.tone as 'light' | 'dark' | undefined) ?? (palette.highKey ? 'light' : 'dark');
  const size = RATIOS[ratio];
  const canvas = createCanvas(size.width, size.height);
  const stamp = posterDate(new Date());
  renderPoster(canvas as unknown as HTMLCanvasElement, {
    image: image as unknown as CanvasImageSource,
    swatches: palette.swatches,
    seed,
    highKey: palette.highKey,
    edge: palette.edge,
    template,
    tone,
    width: size.width,
    height: size.height,
    blur: 0,
    darkness: palette.highKey ? 0.28 : 0.62,
    grain: template === 'player' ? 0 : palette.highKey ? 0.08 : 0.16,
    title: track.name,
    subtitle: track.translation,
    artist: track.artists,
    album: track.album,
    duration: track.duration,
    year: track.year,
    released: track.released,
    note: values.note ?? track.line,
    dateLabel: stamp.dateLabel,
    serial: stamp.serial,
  });

  const out = resolve(values.out || `${safeName(track.name)}-${safeName(track.artists)}.png`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, canvas.toBuffer('image/png'));
  console.log(`${track.name} · ${track.artists}`);
  console.log(out);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
