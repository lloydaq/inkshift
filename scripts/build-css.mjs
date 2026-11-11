// Copies the stylesheets to dist/ and builds dist/styles.css with the @imports inlined,
// so `import 'inkshift/styles.css'` is one file with no relative imports to resolve.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(import.meta.dirname, '../src/styles');
const out = resolve(import.meta.dirname, '../dist');
mkdirSync(out, { recursive: true });

const read = (name) => readFileSync(resolve(src, name), 'utf8');
for (const name of ['tokens.css', 'transitions.css']) writeFileSync(resolve(out, name), read(name));

const bundled = read('index.css').replace(/@import '\.\/([\w-]+\.css)';\n?/g, (_, name) => `${read(name)}\n`);
writeFileSync(resolve(out, 'styles.css'), bundled);
console.log('css: dist/styles.css, dist/tokens.css, dist/transitions.css');
