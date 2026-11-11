import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'http://127.0.0.1:4175/tests/browser/fixture.html';

const errors = (page: Page) => {
  const list: string[] = [];
  page.on('pageerror', (e) => list.push(e.message));
  page.on('console', (m) => m.type() === 'error' && list.push(m.text()));
  return list;
};

const supported = (page: Page) =>
  page.evaluate(() => typeof document.startViewTransition === 'function' && 'pseudoElement' in KeyframeEffect.prototype);

/** The splat animation on the new snapshot, if one is running. */
const ink = (page: Page) =>
  page.evaluate(() => {
    const a = document.getAnimations().find((x) => (x.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)');
    if (!a) return null;
    const frames = (a.effect as KeyframeEffect).getKeyframes();
    const last = frames.at(-1)!;
    return {
      layers: String(last.maskSize).split(',').length,
      duration: a.effect!.getTiming().duration,
      time: Number(a.currentTime),
      rate: a.playbackRate,
      size: parseFloat(String(last.maskSize)),
      position: String(last.maskPosition).split(',')[0]!.trim().split(' ').map(parseFloat),
    };
  });

const settled = (page: Page) => expect(page.locator('html')).not.toHaveClass(/inkshift-transition/, { timeout: 5000 });
const themeAttr = (page: Page) => page.locator('html').getAttribute('data-theme');

async function open(page: Page, scheme: 'light' | 'dark' = 'dark', reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion });
  await page.goto(FIXTURE);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
}

test.describe('built package in a real browser', () => {
  test('init script sets the theme and theme-color', async ({ page }) => {
    await open(page, 'light');
    await page.evaluate(() => localStorage.setItem('fx', 'dark'));
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
      new Function((window as unknown as { __initScript: string }).__initScript)();
    });
    expect(await themeAttr(page)).toBe('dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161a');
  });

  test('bleeds two splats from the pointer over 1100ms, covering the viewport', async ({ page }) => {
    const errs = errors(page);
    await open(page);
    test.skip(!(await supported(page)), 'No View Transitions in this browser');
    await page.evaluate(() => (window as unknown as { theme: { toggleTheme(o: unknown): void } }).theme.toggleTheme({ x: 300, y: 200 }));
    const handle = await page.waitForFunction(() => {
      const a = document.getAnimations().find((x) => (x.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)');
      return a ? true : null;
    });
    expect(await handle.jsonValue()).toBe(true);
    const info = (await ink(page))!;
    expect(info.layers).toBe(2);
    expect(info.duration).toBe(1100);
    expect(info.position[0]! + info.size / 2).toBeCloseTo(300, 0);
    expect(info.position[1]! + info.size / 2).toBeCloseTo(200, 0);
    const viewport = page.viewportSize()!;
    expect(info.size / 2).toBeGreaterThan(Math.hypot(viewport.width - 300, viewport.height - 200));
    await settled(page);
    expect(await themeAttr(page)).toBe('light');
    expect(errs).toEqual([]);
  });

  test('does not flash the new theme before the ink reaches it', async ({ page }) => {
    await open(page, 'dark');
    test.skip(!(await supported(page)), 'No View Transitions in this browser');
    const box = (await page.locator('#toggle').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => document.getAnimations().some((x) => (x.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)'));
    // Early in the spread the far corner (bottom left) still shows the old, dark theme.
    const shot = await page.screenshot({ clip: { x: 0, y: page.viewportSize()!.height - 4, width: 4, height: 4 } });
    const dark = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const [r, g, b] = ctx.getImageData(1, 1, 1, 1).data;
      return r! + g! + b! < 150;
    }, shot.toString('base64'));
    expect(dark).toBe(true);
    await settled(page);
  });

  test('a second press mid-spread reverses the same animation and keeps the old theme', async ({ page }) => {
    const errs = errors(page);
    await open(page, 'dark');
    test.skip(!(await supported(page)), 'No View Transitions in this browser');
    const box = (await page.locator('#toggle').boundingBox())!;
    const press = () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await press();
    await page.waitForTimeout(350);
    expect(await ink(page)).not.toBeNull();
    await press();
    // reverse() sets a pending playback rate, applied on the next animation frame.
    await page.waitForFunction(() =>
      document.getAnimations().some((x) => (x.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)' && x.playbackRate < 0),
    );
    const after = (await ink(page))!;
    expect(after.rate).toBe(-1);
    expect(after.time).toBeGreaterThan(0);
    // Turned around where it stood: not restarted, not jumped to the end, and now retracting.
    expect(after.time).toBeLessThan(1000);
    await page.waitForTimeout(100);
    const later = await ink(page);
    if (later) expect(later.time).toBeLessThan(after.time);
    await settled(page);
    expect(await themeAttr(page)).toBe('dark');
    const ends = await page.evaluate(() => (window as unknown as { ends: { reversed: boolean }[] }).ends);
    expect(ends).toEqual([expect.objectContaining({ reversed: true, theme: 'dark' })]);
    expect(errs).toEqual([]);
  });

  test('rapid presses end on the theme of the last press', async ({ page }) => {
    await open(page, 'dark');
    const box = (await page.locator('#toggle').boundingBox())!;
    const press = () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 5; i++) await press();
    await settled(page);
    expect(await themeAttr(page)).toBe('light');
    for (let i = 0; i < 4; i++) await press();
    await settled(page);
    expect(await themeAttr(page)).toBe('light');
    expect(await page.evaluate(() => localStorage.getItem('fx'))).toBe('light');
  });

  test('a keyboard press bleeds from the centre of the toggle', async ({ page }) => {
    await open(page, 'dark');
    test.skip(!(await supported(page)), 'No View Transitions in this browser');
    await page.locator('#toggle').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getAnimations().length > 0);
    const info = (await ink(page))!;
    const box = (await page.locator('#toggle').boundingBox())!;
    expect(info.position[0]! + info.size / 2).toBeCloseTo(box.x + box.width / 2, 0);
    await settled(page);
  });

  test('reduced motion switches instantly with no transition', async ({ page }) => {
    await open(page, 'dark', 'reduce');
    await page.locator('#toggle').click();
    expect(await themeAttr(page)).toBe('light');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator('html')).not.toHaveClass(/inkshift-/);
  });

  test('the cross-fade fallback works where View Transitions are missing', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition;
    });
    await open(page, 'dark');
    await page.locator('#toggle').click();
    await expect(page.locator('html')).toHaveClass(/inkshift-fade/);
    expect(await themeAttr(page)).toBe('light');
    await expect(page.locator('html')).not.toHaveClass(/inkshift-fade/);
  });

  test('a hidden tab mid-reversal still ends on the original theme', async ({ page }) => {
    await open(page, 'dark');
    test.skip(!(await supported(page)), 'No View Transitions in this browser');
    const box = (await page.locator('#toggle').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Simulate the tab going away: the browser skips the transition.
    await page.evaluate(() => (document as unknown as { activeViewTransition?: ViewTransition }).activeViewTransition?.skipTransition());
    await settled(page);
    expect(await themeAttr(page)).toBe('dark');
  });
});
