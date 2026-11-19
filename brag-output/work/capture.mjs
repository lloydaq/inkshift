// Captures the real Inkshift demo frame by frame. The ink is the library's own Web Animation
// on ::view-transition-new(root); it is paused and stepped via currentTime so every frame is exact.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const SITE = 'http://localhost:5180/';
const KEY = 'inkshift-demo-theme';
const FPS = 30;
const OUT = new URL('./frames/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const INK = `(a) => a.effect && a.effect.pseudoElement === '::view-transition-new(root)'`;

const browser = await chromium.launch();
const manifest = {};

async function open(theme) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'no-preference' });
  await ctx.addInitScript(([k, t]) => { try { localStorage.setItem(k, t); } catch {} }, [KEY, theme]);
  const page = await ctx.newPage();
  await page.goto(SITE);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none}' });
  return { ctx, page };
}

async function centreOn(page, selector, y = 540) {
  await page.evaluate(([s, y]) => {
    const r = document.querySelector(s).getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - y, behavior: 'instant' });
  }, [selector, y]);
  await page.waitForTimeout(300);
}

const frames2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function shot(page, name) {
  await frames2(page);
  await page.screenshot({ path: OUT + name + '.png' });
  return name;
}

async function setInk(page, ms) {
  await page.evaluate(`(() => { const a = document.getAnimations().find(${INK}); a.pause(); a.currentTime = ${ms}; })()`);
}

/**
 * progressAt(localSeconds) -> { press?: true, ms } ; null means "before the press".
 * events: list of { at: localSeconds, action: async (page) => void } run once when reached.
 */
async function scene(id, { theme, setup, frames, press, progressAt, events = [] }) {
  const { ctx, page } = await open(theme);
  const meta = await setup(page);
  const list = [];
  const pre = await shot(page, `${id}-pre`);
  let started = false;
  const cache = new Map();
  const done = new Set();
  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    for (const [k, ev] of events.entries()) if (!done.has(k) && t >= ev.at && started) { done.add(k); await ev.action(page); }
    if (t < press) { list.push(pre); continue; }
    if (!started) {
      await page.mouse.click(meta.press.x, meta.press.y);
      await page.waitForFunction(`document.getAnimations().some(${INK})`);
      await setInk(page, 0);
      await page.waitForTimeout(200);
      started = true;
      for (const [k, ev] of events.entries()) if (!done.has(k) && t >= ev.at) { done.add(k); await ev.action(page); }
    }
    const ms = Math.round(progressAt(t) * 10) / 10;
    if (cache.has(ms)) { list.push(cache.get(ms)); continue; }
    await setInk(page, ms);
    const name = await shot(page, `${id}-${String(i).padStart(3, '0')}`);
    cache.set(ms, name);
    list.push(name);
  }
  manifest[id] = { frames: list, ...meta };
  await ctx.close();
  console.log(id, 'done', cache.size, 'unique ink frames');
}

const box = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
};

// 1. Hook: hero, light -> dark from the drop, real speed.
await scene('s1', {
  theme: 'light', frames: 120, press: 0.5,
  setup: async (page) => ({ press: await box(page, '.hero__toggle') }),
  progressAt: (t) => Math.min(1100, (t - 0.5) * 1000),
});

// 3. Press anywhere on the sheet: dark -> light, 0.45x so the tendrils read.
await scene('s3', {
  theme: 'dark', frames: 120, press: 0.5,
  setup: async (page) => {
    await centreOn(page, '.sheet', 560);
    const b = await page.locator('.sheet').boundingBox();
    return { press: { x: Math.round(b.x + b.width * 0.3), y: Math.round(b.y + b.height * 0.32) } };
  },
  progressAt: (t) => Math.min(1100, (t - 0.5) * 1000 * 0.45),
});

// 4. Reversal: hero, dark -> light, 0.6x, pressed again at 300 ms: the same animation runs back.
let reversedAt = null;
await scene('s4', {
  theme: 'dark', frames: 120, press: 0.5,
  setup: async (page) => ({ press: await box(page, '.hero__toggle'), second: 1.0 }),
  events: [{
    at: 1.0,
    action: async (page) => {
      const p = await box(page, '.hero__toggle');
      await page.mouse.click(p.x, p.y);
      reversedAt = await page.evaluate(`(() => { const a = document.getAnimations().find(${INK}); a.pause(); return a.playbackRate; })()`);
    },
  }],
  progressAt: (t) => (t < 1.0 ? (t - 0.5) * 600 : Math.max(0, 300 - (t - 1.0) * 600)),
});
console.log('s4 playbackRate after second press', reversedAt);

// 5. Smoke: fluid section, Smoke preset, light -> dark, real 2 s.
await scene('s5', {
  theme: 'light', frames: 105, press: 0.5,
  setup: async (page) => {
    await centreOn(page, '#fluid .config', 520);
    await page.locator('#fluid button', { hasText: 'Smoke' }).click();
    await page.mouse.move(1700, 1000);
    await page.waitForTimeout(400);
    return { press: await box(page, '#fluid .config__try .inkshift-toggle') };
  },
  progressAt: (t) => Math.min(2000, (t - 0.5) * 1000),
});

writeFileSync(new URL('./manifest.json', import.meta.url), JSON.stringify(manifest, null, 1));
await browser.close();
