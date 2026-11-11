import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Library build: two ESM entries sharing one core chunk, React left to the app.
// Types come from tsc (tsconfig.build.json), CSS from scripts/build-css.mjs.
export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        react: resolve(import.meta.dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { chunkFileNames: 'chunks/core-[hash].js' },
    },
  },
});
