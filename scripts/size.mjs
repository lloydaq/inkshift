// Measures what Inkshift adds to an app: each entry bundled from dist/ and minified,
// with React left external, then gzipped and brotli-compressed. Run after build:lib.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { build } from 'vite';

const dist = resolve(import.meta.dirname, '../dist');
const dir = mkdtempSync(join(tmpdir(), 'inkshift-size-'));
const entries = {
  'inkshift (everything)': `export * from '${dist}/index.js';`,
  'createThemeController only': `export { createThemeController } from '${dist}/index.js';`,
  'inkshift/react (everything, React external)': `export * from '${dist}/react.js';`,
};

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;
const rows = [];
for (const [name, source] of Object.entries(entries)) {
  const file = join(dir, `${rows.length}.js`);
  writeFileSync(file, source);
  const out = await build({
    logLevel: 'silent',
    configFile: false,
    build: {
      write: false,
      minify: true,
      lib: { entry: file, formats: ['es'], fileName: 'out' },
      rolldownOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
    },
  });
  const code = out[0].output[0].code;
  rows.push([name, kb(code.length), kb(gzipSync(code, { level: 9 }).length), kb(brotliCompressSync(code).length)]);
}
for (const css of ['styles.css', 'tokens.css', 'transitions.css']) {
  const code = readFileSync(join(dist, css));
  rows.push([`inkshift/${css} (unminified)`, kb(code.length), kb(gzipSync(code, { level: 9 }).length), kb(brotliCompressSync(code).length)]);
}

console.log('| Import | Minified | gzip | brotli |\n| --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
