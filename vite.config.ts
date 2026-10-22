import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const ALLOWED_HOSTS = new Set(['163cn.tv', 'music.163.com', 'y.music.163.com']);

function resolveShortLink(): Plugin {
  const handler = async (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void,
  ) => {
    if (!req.url?.startsWith('/api/resolve')) {
      next();
      return;
    }
    try {
      const target = new URL(req.url, 'http://localhost').searchParams.get('url');
      const host = target ? new URL(target).host : '';
      if (!target || !ALLOWED_HOSTS.has(host)) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'unsupported url' }));
        return;
      }
      const response = await fetch(target, { redirect: 'manual' });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ location: response.headers.get('location') ?? '' }));
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: String(error) }));
    }
  };

  return {
    name: 'resolve-short-link',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), resolveShortLink()],
  server: { host: '0.0.0.0', port: 5173 },
});
