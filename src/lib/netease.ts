import { pickLyricLine } from './lyric';

export const API_BASE = 'https://ncme-vc.vercel.app';

export function apiBase(): string {
  const fromEnv = typeof process !== 'undefined' ? process.env.DAILY_MUSIC_API : undefined;
  return (fromEnv || API_BASE).replace(/\/$/, '');
}
export const DEFAULT_SONG_ID = 1423990087;

export type Track = {
  id: number;
  name: string;
  translation: string;
  alias: string;
  artists: string;
  album: string;
  coverUrl: string;
  duration: string;
  year: string;
  released: string;
  line: string;
};

export type SearchHit = {
  id: number;
  name: string;
  artists: string;
  album: string;
  coverUrl: string;
};

type SongJson = {
  id: number;
  name: string;
  tns?: string[];
  alia?: string[];
  dt?: number;
  publishTime?: number;
  ar?: { name: string }[];
  al?: { name?: string; picUrl?: string };
};

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatYear(timestamp?: number): string {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date(timestamp));
}

export function formatRelease(timestamp?: number): string {
  if (!timestamp) return '';
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
  return iso.replaceAll('-', '.');
}

export function parseShare(input: string): { id?: number; shortUrl?: string; keyword?: string } {
  const trimmed = input.trim();
  const idMatch = trimmed.match(/(?:id=|\/song\/)(\d{4,})/);
  if (idMatch) return { id: Number(idMatch[1]) };
  if (/^\d{5,}$/.test(trimmed)) return { id: Number(trimmed) };
  const shortUrl = trimmed.match(/https?:\/\/163cn\.tv\/[A-Za-z0-9]+/)?.[0];
  const book = trimmed.match(/《([^》]+)》/)?.[1]?.replace(/\s*[（(].*$/, '').trim();
  if (shortUrl) return { shortUrl, keyword: book };
  return { keyword: trimmed };
}

export async function resolveShortLink(shortUrl: string): Promise<number | null> {
  if (typeof window === 'undefined') {
    const response = await fetch(shortUrl, { redirect: 'manual' });
    const id = response.headers.get('location')?.match(/[?&]id=(\d{4,})/)?.[1];
    return id ? Number(id) : null;
  }
  const endpoint = new URL('/api/resolve', window.location.origin);
  endpoint.searchParams.set('url', shortUrl);
  const response = await fetch(endpoint);
  if (!response.ok) return null;
  const data = (await response.json()) as { location?: string };
  const id = data.location?.match(/[?&]id=(\d{4,})/)?.[1];
  return id ? Number(id) : null;
}

function toTrack(song: SongJson, line: string): Track {
  return {
    id: song.id,
    name: song.name,
    translation: song.tns?.[0] ?? '',
    alias: song.alia?.[0] ?? '',
    artists: (song.ar ?? []).map((artist) => artist.name).filter(Boolean).join(' / '),
    album: song.al?.name ?? '',
    coverUrl: song.al?.picUrl ?? '',
    duration: formatDuration(song.dt ?? 0),
    year: formatYear(song.publishTime),
    released: formatRelease(song.publishTime),
    line,
  };
}

export async function fetchTrack(id: number): Promise<Track> {
  const [detailResponse, lyricResponse] = await Promise.all([
    fetch(`${apiBase()}/song/detail?ids=${id}`),
    fetch(`${apiBase()}/lyric?id=${id}`),
  ]);
  if (!detailResponse.ok) throw new Error('曲库没有响应');
  const detail = (await detailResponse.json()) as { songs?: SongJson[] };
  const song = detail.songs?.[0];
  if (!song) throw new Error('没有找到这首歌');

  let line = '';
  if (lyricResponse.ok) {
    const lyric = (await lyricResponse.json()) as {
      tlyric?: { lyric?: string };
      lrc?: { lyric?: string };
    };
    const title = [song.name, song.tns?.[0] ?? ''].filter(Boolean).join(' ');
    line = pickLyricLine(lyric.tlyric?.lyric ?? '', lyric.lrc?.lyric ?? '', title);
  }
  return toTrack(song, line);
}

export async function searchTracks(keyword: string): Promise<SearchHit[]> {
  const endpoint = new URL(`${apiBase()}/cloudsearch`);
  endpoint.searchParams.set('keywords', keyword);
  endpoint.searchParams.set('type', '1');
  endpoint.searchParams.set('limit', '6');
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('搜索失败');
  const data = (await response.json()) as { result?: { songs?: SongJson[] } };
  return (data.result?.songs ?? []).map((song) => ({
    id: song.id,
    name: song.name,
    artists: (song.ar ?? []).map((artist) => artist.name).join(' / '),
    album: song.al?.name ?? '',
    coverUrl: song.al?.picUrl ?? '',
  }));
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('封面加载失败'));
    image.src = url;
  });
}
