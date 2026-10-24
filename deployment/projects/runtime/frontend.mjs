import { createServer } from 'vite';
// Keep generated dependency caches writable without making installed packages writable.
const server = await createServer({
  configLoader: 'native',
  cacheDir: '/tmp/codeskill-vite-cache',
  base: process.env.PROJECT_PREVIEW_BASE || '/',
  clearScreen: false,
  server: { host: '127.0.0.1', port: 4173, strictPort: true, hmr: false, allowedHosts: ['localhost', '127.0.0.1'], cors: { origin: 'null' } },
});
await server.listen();
server.printUrls();
