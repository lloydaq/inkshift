import { defineConfig } from 'vite';

// Serves the repository root so the fixture can load the built package from /dist.
export default defineConfig({ root: new URL('../..', import.meta.url).pathname, server: { port: 4175, strictPort: true } });
