import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const dir = new URL('./', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8'));
const args = process.argv.slice(2);
const all = args[0] === 'all';
const times = all ? Array.from({ length: 660 }, (_, i) => i / 30) : args.map(Number);
const out = dir + (all ? 'out/' : 'stills/'); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto('file://' + dir + 'compose.html');
await p.evaluate((m) => window.load(m), manifest);
for (const [i, t] of times.entries()) {
  await p.evaluate((t) => window.render(t), t);
  await p.screenshot({ path: out + (all ? String(i).padStart(4, '0') : 't' + t.toFixed(2)) + '.png' });
}
await b.close();
