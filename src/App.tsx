import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './components/Icons';
import { applyScheme, schemeFromSeed, seedFromSwatch } from './lib/color';
import {
  DEFAULT_SONG_ID,
  fetchTrack,
  loadImage,
  parseShare,
  resolveShortLink,
  searchTracks,
  type SearchHit,
  type Track,
} from './lib/netease';
import { extractPalette, type Swatch } from './lib/palette';
import { RATIOS, THEMES, posterDate, renderPoster, type RatioId, type Template } from './lib/poster';

type Tone = 'light' | 'dark';

type Loaded = {
  track: Track;
  image: HTMLImageElement;
  swatches: Swatch[];
  highKey: boolean;
  edge: string;
  coverUrl: string;
};

function todayInput(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function safeFile(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || '日推';
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [seed, setSeed] = useState('#5E7678');
  const [note, setNote] = useState('');
  const [template, setTemplate] = useState<Template>('kokoro');
  const [ratio, setRatio] = useState<RatioId>('wide');
  const [tone, setTone] = useState<Tone>('light');
  const [appMode, setAppMode] = useState<Tone>('light');
  const [blur, setBlur] = useState(0);
  const [darkness, setDarkness] = useState(0.32);
  const [grain, setGrain] = useState(0.08);
  const [date, setDate] = useState(todayInput);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    applyScheme(schemeFromSeed(seed, appMode), appMode);
  }, [seed, appMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = Number(params.get('id'));
    void openTrack(Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : DEFAULT_SONG_ID);
    // The first song is the page's default recommendation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q || /https?:|163cn\.tv|music\.163\.com|^\d{5,}$/.test(q)) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        setHits(await searchTracks(q));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    let cancel = false;
    setReady(false);
    void (async () => {
      await document.fonts.ready;
      if (cancel) return;
      const size = RATIOS[ratio];
      const stamp = posterDate(new Date(`${date}T12:00:00+08:00`));
      renderPoster(canvas, {
        image: loaded.image,
        swatches: loaded.swatches,
        seed,
        highKey: loaded.highKey,
        edge: loaded.edge,
        template,
        tone,
        width: size.width,
        height: size.height,
        blur,
        darkness,
        grain,
        title: loaded.track.name,
        subtitle: loaded.track.translation,
        artist: loaded.track.artists,
        album: loaded.track.album,
        duration: loaded.track.duration,
        year: loaded.track.year,
        released: loaded.track.released,
        note,
        dateLabel: stamp.dateLabel,
        serial: stamp.serial,
      });
      if (!cancel) {
        canvas.dataset.ready = 'true';
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [loaded, seed, note, template, ratio, tone, blur, darkness, grain, date]);

  async function openTrack(id: number) {
    const token = ++requestId.current;
    setStatus('loading');
    setError('');
    setHits([]);
    try {
      const track = await fetchTrack(id);
      if (!track.coverUrl) throw new Error('这首歌没有封面');
      const image = await loadImage(track.coverUrl);
      if (token !== requestId.current) return;
      const palette = extractPalette(image);
      const nextSeed = palette.swatches[0] ? seedFromSwatch(palette.swatches[0]) : seed;
      setLoaded({
        track,
        image,
        swatches: palette.swatches,
        highKey: palette.highKey,
        edge: palette.edge,
        coverUrl: track.coverUrl,
      });
      setSeed(nextSeed);
      setNote(track.line);
      setTone(palette.highKey ? 'light' : 'dark');
      setAppMode(palette.highKey ? 'light' : 'dark');
      setBlur(0);
      setDarkness(palette.highKey ? 0.28 : 0.62);
      setGrain(0);
      setStatus('ready');
      document.title = `${track.name} · 日推`;
      const url = new URL(window.location.href);
      url.searchParams.set('id', String(track.id));
      window.history.replaceState(null, '', url);
    } catch (cause) {
      if (token !== requestId.current) return;
      setStatus('error');
      setError(cause instanceof Error ? cause.message : '读取失败');
    }
  }

  async function submitQuery() {
    const parsed = parseShare(query);
    if (parsed.id) {
      await openTrack(parsed.id);
      return;
    }
    if (parsed.shortUrl) {
      setStatus('loading');
      const id = await resolveShortLink(parsed.shortUrl).catch(() => null);
      if (id) {
        await openTrack(id);
        return;
      }
      if (parsed.keyword) {
        const found = await searchTracks(parsed.keyword).catch(() => []);
        if (found[0]) {
          await openTrack(found[0].id);
          return;
        }
      }
      setStatus('error');
      setError('短链没有解析出歌曲，换一个歌曲 ID 试试');
      return;
    }
    if (parsed.keyword) {
      const found = await searchTracks(parsed.keyword).catch(() => []);
      setHits(found);
      if (found[0]) await openTrack(found[0].id);
      else {
        setStatus('error');
        setError('没有搜到这首歌');
      }
    }
  }

  async function onFile(file: File) {
    if (!loaded || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const palette = extractPalette(image);
      setLoaded({
        ...loaded,
        image,
        swatches: palette.swatches,
        highKey: palette.highKey,
        edge: palette.edge,
        coverUrl: url,
      });
      if (palette.swatches[0]) setSeed(seedFromSwatch(palette.swatches[0]));
      setTone(palette.highKey ? 'light' : 'dark');
      setAppMode(palette.highKey ? 'light' : 'dark');
    } finally {
      // Keep the object URL while the poster still paints from the element.
    }
  }

  function download() {
    const canvas = canvasRef.current;
    const track = loaded?.track;
    if (!canvas || !track) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFile(track.artists)} - ${safeFile(track.name)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  const size = RATIOS[ratio];
  const track = loaded?.track;

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="music" />
          </span>
          <div>
            <div className="title-large">日推</div>
            <div className="label-medium">封面取色 · Material Design 3</div>
          </div>
        </div>
        <div className="app-bar-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={appMode === 'dark' ? '切换为浅色界面' : '切换为深色界面'}
            onClick={() => setAppMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
          >
            <Icon name={appMode === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="btn-filled" onClick={download} disabled={!ready}>
            <Icon name="download" />
            保存海报
          </button>
        </div>
        {status === 'loading' && (
          <div className="progress" role="progressbar" aria-label="正在取色">
            <span />
          </div>
        )}
      </header>

      <div className="workspace">
        <aside className="panel">
          <section className="card">
            <h2>找一首歌</h2>
            <label className="field">
              <span>搜索或粘贴网易云链接</span>
              <span className="field-box">
                <Icon name="search" />
                <input
                  value={query}
                  placeholder="心予報、歌曲 ID、163cn.tv 短链"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitQuery();
                  }}
                />
              </span>
            </label>
            <button type="button" className="btn-tonal" onClick={() => void submitQuery()}>
              读取
            </button>
            {searching && <p className="support">正在搜索曲库…</p>}
            {hits.length > 0 && (
              <ul className="results">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button type="button" onClick={() => void openTrack(hit.id)}>
                      <img src={hit.coverUrl} alt="" />
                      <span>
                        <strong>{hit.name}</strong>
                        <em>
                          {hit.artists} · {hit.album}
                        </em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>

          {track && (
            <section className="card track-card">
              <img src={loaded?.coverUrl} alt="" />
              <div>
                <h2>{track.name}</h2>
                {track.translation && <p className="translation">{track.translation}</p>}
                <p>
                  {track.artists}
                  <br />
                  {[track.album, track.duration, track.year].filter(Boolean).join(' · ')}
                </p>
                {track.alias && <p className="support">{track.alias}</p>}
                <label className="text-button">
                  <Icon name="image" />
                  更换封面
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onFile(file);
                    }}
                  />
                </label>
              </div>
            </section>
          )}

          <section className="card">
            <h2>动态配色</h2>
            <p className="support">从封面上取一组颜色，界面和海报一起跟着变。</p>
            <div className="swatches" role="listbox" aria-label="封面取色">
              {loaded?.swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  role="option"
                  aria-selected={seed.toUpperCase() === swatch.hex.toUpperCase()}
                  className="swatch"
                  style={{ background: swatch.hex }}
                  title={swatch.hex}
                  onClick={() => setSeed(seedFromSwatch(swatch))}
                />
              ))}
              <label className="seed" title="微调种子色">
                <input
                  type="color"
                  value={seed.toLowerCase()}
                  aria-label="微调种子色"
                  onChange={(event) => setSeed(event.target.value.toUpperCase())}
                />
              </label>
            </div>
            <p className="mono">种子色 {seed.toUpperCase()}</p>
            <div className="roles">
              <div style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
                <b>主色</b>
                <span>Primary</span>
              </div>
              <div style={{ background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' }}>
                <b>辅色</b>
                <span>Secondary</span>
              </div>
              <div style={{ background: 'var(--md-tertiary-container)', color: 'var(--md-on-tertiary-container)' }}>
                <b>点缀</b>
                <span>Tertiary</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>主题</h2>
            <p className="support">1 playlist，2 心予報。</p>
            <div className="segmented" role="radiogroup" aria-label="海报主题">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={template === item.id}
                  title={item.name}
                  onClick={() => {
                    setTemplate(item.id);
                    setRatio(item.ratio);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="chips" role="radiogroup" aria-label="画幅">
              {(Object.keys(RATIOS) as RatioId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  aria-checked={ratio === id}
                  onClick={() => setRatio(id)}
                >
                  {RATIOS[id].label}
                </button>
              ))}
            </div>
            <div className="segmented" role="radiogroup" aria-label="海报明暗">
              {(['light', 'dark'] as Tone[]).map((item) => (
                <button key={item} type="button" role="radio" aria-checked={tone === item} onClick={() => setTone(item)}>
                  {item === 'light' ? '浅底' : '深底'}
                </button>
              ))}
            </div>
            <Slider label="柔光" min={0} max={40} step={1} value={blur} display={`${blur}`} onChange={setBlur} />
            <Slider
              label="压暗"
              min={0}
              max={1}
              step={0.01}
              value={darkness}
              display={`${Math.round(darkness * 100)}`}
              onChange={setDarkness}
            />
            <Slider
              label="颗粒"
              min={0}
              max={0.4}
              step={0.01}
              value={grain}
              display={`${Math.round(grain * 100)}`}
              onChange={setGrain}
            />
          </section>

          <section className="card">
            <h2>海报文字</h2>
            <label className="field">
              <span>一句旁白</span>
              <textarea value={note} maxLength={36} rows={2} onChange={(event) => setNote(event.target.value)} />
            </label>
            <label className="field">
              <span>日期</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <p className="support">旁白默认取自歌词里和歌名最接近的一句，可以改成你自己的话。</p>
          </section>

          <div className="panel-actions">
            <button type="button" className="btn-filled wide" onClick={download} disabled={!ready}>
              <Icon name="download" />
              保存 PNG · {size.width}×{size.height}
            </button>
          </div>
        </aside>

        <main className="stage">
          {loaded && <div className="stage-glow" style={{ backgroundImage: `url(${loaded.coverUrl})` }} />}
          <div className="stage-scrim" />
          <figure className="poster-frame">
            <canvas ref={canvasRef} aria-label={track ? `${track.name} 的日推海报` : '日推海报'} />
            <figcaption>
              {ready ? `预览即导出尺寸 ${size.width}×${size.height}` : '正在按封面取色…'}
            </figcaption>
          </figure>
        </main>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-label">
        <span>{label}</span>
        <span>{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
