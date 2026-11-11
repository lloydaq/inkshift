import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createInitScript } from '../src/core/init';
import { STORAGE_KEY } from './src/links';

const src = resolve(import.meta.dirname, '../src');


/** Inlines the library's own first-paint script, so the demo never flashes the wrong theme. */
function themeInit(): Plugin {
  return {
    name: 'inkshift-init',
    transformIndexHtml: (html) => html.replace('<!--inkshift:init-->', `<script>${createInitScript({ storageKey: STORAGE_KEY })}</script>`),
  };
}

// The demo runs the library from source, so it always shows the real implementation.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), themeInit()],
  resolve: {
    alias: [
      { find: /^inkshift\/react$/, replacement: resolve(src, 'react/index.ts') },
      { find: /^inkshift\/styles\.css$/, replacement: resolve(src, 'styles/index.css') },
      { find: /^inkshift$/, replacement: resolve(src, 'index.ts') },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { port: 4174 },
});
