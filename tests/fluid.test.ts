import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThemeController, inkSplat as publicInkSplat } from '../src';
import { bakeSplat, clampFluidity, fluidFlow, fluidSplat, splatPair } from '../src/core/fluid';
import { farthestCorner, inkSplat, splatKeyframes, type Splat } from '../src/core/inkSplat';
import { flush, inkAnimation, installViewTransitions, settle } from './helpers/browser';

const svgOf = (splat: Splat) => decodeURIComponent(splat.url.slice('url("data:image/svg+xml,'.length, -2));
const px = (value: unknown) => String(value).split(',').map((layer) => parseFloat(layer));
const xy = (value: unknown) => String(value).split(',').map((layer) => layer.trim().split(' ').map(parseFloat) as [number, number]);

/** Stands in for the browser's image decoding and canvas, which jsdom lacks. */
function installCanvas({ fail = false, hang = false, solidUntil = 0.3 } = {}) {
  const size = { value: 0 };
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(_: string) {
      if (hang) return;
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
  const context = {
    drawImage: vi.fn(),
    // A disc that is solid out to `solidUntil` of the half-width, transparent beyond.
    getImageData: (_x: number, _y: number, w: number) => {
      const data = new Uint8ClampedArray(w * w * 4);
      const c = (w - 1) / 2;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = Math.hypot(x - c, y - c) <= solidUntil * (w / 2) ? 255 : 0;
      return { data };
    },
  };
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return create(tag);
    return {
      set width(v: number) {
        size.value = v;
      },
      get width() {
        return size.value;
      },
      height: 0,
      getContext: () => context,
      toDataURL: () => 'data:image/png;base64,BAKED',
    } as unknown as HTMLCanvasElement;
  });
  return context;
}

afterEach(() => vi.unstubAllGlobals());

describe('fluidSplat', () => {
  it('is exactly the original ink at fluidity 0', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(fluidSplat(seed, 0)).toEqual(inkSplat(seed));
      expect(fluidSplat(seed)).toEqual(inkSplat(seed));
      expect(publicInkSplat(seed)).toEqual(inkSplat(seed));
    }
  });

  it('clamps fluidity to 0–1 and treats junk as 0', () => {
    expect(clampFluidity(-1)).toBe(0);
    expect(clampFluidity(3)).toBe(1);
    expect(clampFluidity(0.4)).toBe(0.4);
    expect(clampFluidity(Number.NaN)).toBe(0);
    expect(clampFluidity(undefined)).toBe(0);
    expect(fluidSplat(5, 9).url).toBe(fluidSplat(5, 1).url);
  });

  it('warps and blurs the same outline inside a larger box', () => {
    const base = svgOf(inkSplat(3));
    const fluid = svgOf(fluidSplat(3, 1));
    expect(fluid).toContain('<feTurbulence');
    expect(fluid).toContain('<feDisplacementMap');
    expect(fluid).toContain('<feGaussianBlur');
    // The original path and droplets are all still there, inside the filtered group.
    expect(fluid).toContain(base.slice(base.indexOf('<path'), base.lastIndexOf('</svg>')));
    const half = Number(/viewBox="(-?[\d.]+)/.exec(fluid)![1]);
    expect(half).toBeLessThan(-100);
    expect(fluid).not.toMatch(/NaN|Infinity/);
  });

  it('is deterministic and gets softer with fluidity', () => {
    expect(fluidSplat(7, 0.5).url).toBe(fluidSplat(7, 0.5).url);
    expect(fluidSplat(7, 0.5).url).not.toBe(fluidSplat(8, 0.5).url);
    const blur = (f: number) => Number(/stdDeviation="([\d.]+)"/.exec(svgOf(fluidSplat(7, f)))![1]);
    expect(blur(1)).toBeGreaterThan(blur(0.3));
  });

  it('reports a smaller but always usable solid radius', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const f of [0.1, 0.5, 1]) {
        const { minRadius } = fluidSplat(seed, f);
        expect(Number.isFinite(minRadius)).toBe(true);
        expect(minRadius).toBeGreaterThan(5);
        expect(minRadius).toBeLessThan(inkSplat(seed).minRadius);
      }
    }
  });
});

describe('fluidFlow', () => {
  it('is absent for crisp ink', () => {
    expect(fluidFlow(1, 0)).toBeUndefined();
  });

  it('drifts away mid-spread and returns to the press point at both ends', () => {
    const flow = fluidFlow(4, 1)!;
    for (const layer of [0, 1]) {
      expect(Math.hypot(flow.drift!(0, layer, 1000).x, flow.drift!(0, layer, 1000).y)).toBeCloseTo(0, 6);
      expect(Math.hypot(flow.drift!(1, layer, 1000).x, flow.drift!(1, layer, 1000).y)).toBeCloseTo(0, 6);
      const mid = flow.drift!(0.5, layer, 1000);
      expect(Math.hypot(mid.x, mid.y)).toBeGreaterThan(30);
      expect(Math.hypot(mid.x, mid.y)).toBeLessThanOrEqual(65);
    }
    // The layers go different ways.
    expect(flow.drift!(0.5, 0, 1000)).not.toEqual(flow.drift!(0.5, 1, 1000));
  });

  it('scales with fluidity and paces the spread more gently', () => {
    const size = (f: number) => Math.hypot(fluidFlow(4, f)!.drift!(0.5, 0, 1000).x, fluidFlow(4, f)!.drift!(0.5, 0, 1000).y);
    expect(size(0.2)).toBeLessThan(size(1));
    expect(fluidFlow(4, 1)!.pace).toBeGreaterThan(fluidFlow(4, 0.2)!.pace!);
    expect(fluidFlow(4, 0.2)!.pace).toBeGreaterThan(1);
  });
});

describe('splatKeyframes with flow', () => {
  it('still starts at the press, only grows, and ends covering every corner', () => {
    for (const fluidity of [0.3, 1]) {
      for (let seed = 0; seed < 20; seed++) {
        const origin = { x: 1100, y: 60 };
        const splats: [Splat, Splat] = [fluidSplat(seed, fluidity), fluidSplat(seed + 1, fluidity)];
        const frames = splatKeyframes(splats, origin, 1280, 800, undefined, fluidFlow(seed, fluidity));
        expect(px(frames[0]!.maskSize)).toEqual([0, 0]);
        let previous = [0, 0];
        for (const frame of frames) {
          const sizes = px(frame.maskSize);
          expect(sizes[0]!).toBeGreaterThanOrEqual(previous[0]!);
          expect(sizes[1]!).toBeGreaterThanOrEqual(previous[1]!);
          previous = sizes;
        }
        const reach = farthestCorner(origin, 1280, 800);
        const last = frames.at(-1)!;
        splats.forEach((splat, layer) => {
          const size = px(last.maskSize)[layer]!;
          expect((size / 2) * (splat.minRadius / 100)).toBeGreaterThanOrEqual(reach + 4);
          // Back on the press point at the end.
          expect(xy(last.maskPosition)[layer]![0] + size / 2).toBeCloseTo(origin.x, 1);
          expect(xy(last.maskPosition)[layer]![1] + size / 2).toBeCloseTo(origin.y, 1);
        });
        // Off the press point mid-way.
        const mid = frames[16]!;
        const centre = xy(mid.maskPosition)[0]![0] + px(mid.maskSize)[0]! / 2;
        expect(Math.abs(centre - origin.x) + Math.abs(xy(mid.maskPosition)[0]![1] + px(mid.maskSize)[0]! / 2 - origin.y)).toBeGreaterThan(1);
      }
    }
  });

  it('spreads more slowly early on than crisp ink', () => {
    const splats: [Splat, Splat] = [inkSplat(1), inkSplat(2)];
    const crisp = splatKeyframes(splats, { x: 0, y: 0 }, 1000, 800);
    const fluid = splatKeyframes(splats, { x: 0, y: 0 }, 1000, 800, undefined, fluidFlow(1, 1));
    expect(px(fluid[8]!.maskSize)[0]!).toBeLessThan(px(crisp[8]!.maskSize)[0]!);
    expect(px(fluid.at(-1)!.maskSize)[0]!).toBeCloseTo(px(crisp.at(-1)!.maskSize)[0]!, 1);
  });
});

describe('baking', () => {
  it('renders the splat to a bitmap and measures its solid radius from the pixels', async () => {
    const context = installCanvas({ solidUntil: 0.3 });
    const baked = await bakeSplat(fluidSplat(2, 1), document, 64);
    expect(baked.url).toBe('url("data:image/png;base64,BAKED")');
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    // 30% of the half-width, minus the resampling slack: far above the analytic bound.
    expect(baked.minRadius).toBeGreaterThan(24);
    expect(baked.minRadius).toBeLessThanOrEqual(30);
    expect(baked.minRadius).toBeGreaterThan(fluidSplat(2, 1).minRadius);
  });

  it('rejects when the image cannot be decoded, and when it never loads', async () => {
    installCanvas({ fail: true });
    await expect(bakeSplat(fluidSplat(2, 1), document, 64)).rejects.toThrow(/decoded/);
    installCanvas({ hang: true });
    await expect(bakeSplat(fluidSplat(2, 1), document, 64, 20)).rejects.toThrow(/timed out/);
  });

  it('splatPair is synchronous crisp ink at 0, baked at >0, and falls back to crisp on failure', async () => {
    expect(splatPair(10, 0)).toEqual([inkSplat(10), inkSplat(11)]);
    installCanvas();
    const baked = await splatPair(10, 1);
    expect(baked[0].url).toContain('image/png');
    installCanvas({ fail: true });
    expect(await splatPair(10, 1)).toEqual([inkSplat(10), inkSplat(11)]);
  });
});

describe('fluid transitions', () => {
  it('animates baked masks, with the layers drifting, and reverses like ink', async () => {
    installViewTransitions();
    installCanvas();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { fluidity: 1, seed: 21, duration: 2000 } });
    theme.toggleTheme({ x: 400, y: 300 });
    await flush();
    const ink = inkAnimation()!;
    expect(String(ink.keyframes[0]!.maskImage).match(/image\/png/g)).toHaveLength(2);
    expect(ink.options.duration).toBe(2000);
    const mid = ink.keyframes[16]!;
    expect(xy(mid.maskPosition)[0]![0] + px(mid.maskSize)[0]! / 2).not.toBeCloseTo(400, 0);

    for (const a of [ink]) a.tick(600);
    theme.toggleTheme();
    expect(ink.playbackRate).toBe(-1);
    await settle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    theme.destroy();
  });

  it('falls back to crisp ink when the splats cannot be baked', async () => {
    installViewTransitions();
    installCanvas({ fail: true });
    const theme = createThemeController({ defaultTheme: 'dark', animation: { fluidity: 1, seed: 21 } });
    theme.toggleTheme();
    await flush();
    expect(String(inkAnimation()!.keyframes[0]!.maskImage)).toContain(inkSplat(21).url);
    await settle();
    expect(document.documentElement.dataset.theme).toBe('light');
    theme.destroy();
  });

  it('a press before the bake finishes still reverses without showing the new theme', async () => {
    installViewTransitions();
    installCanvas();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { fluidity: 0.6 } });
    theme.toggleTheme();
    theme.toggleTheme();
    await flush();
    expect(Math.max(...inkAnimation()!.history)).toBe(0);
    await settle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    theme.destroy();
  });

  it('leaves crisp ink untouched when fluidity is 0 or omitted', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { seed: 5, fluidity: 0 } });
    theme.toggleTheme({ x: 10, y: 10 });
    await flush();
    expect(inkAnimation()!.keyframes).toEqual(splatKeyframes([inkSplat(5), inkSplat(6)], { x: 10, y: 10 }, window.innerWidth, window.innerHeight));
    await settle();
    theme.destroy();
  });

  it('releases the finished animation, and its mask images, after the transition', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.toggleTheme();
    await settle();
    expect(inkAnimation()!.playState).toBe('idle');
    theme.destroy();
  });
});
