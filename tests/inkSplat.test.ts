import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { coveringSize, farthestCorner, inkSplat, mulberry32, splatKeyframes, splatRadii, type Splat } from '../src/core/inkSplat';

const px = (value: string) => value.split(',').map((layer) => parseFloat(layer));
const svgOf = (splat: Splat) => decodeURIComponent(splat.url.slice('url("data:image/svg+xml,'.length, -2));
const pair = (seed: number): [Splat, Splat] => [inkSplat(seed), inkSplat(seed + 1000)];

describe('parity with the original portfolio implementation', () => {
  it('produces byte-identical splats and keyframes', () => {
    // Fingerprint computed from lloyd-portfolio/src/components/inkSplat.ts (commit 6eb7a5d):
    // 50 splats plus one keyframe set. Any change to the geometry changes this hash.
    const h = createHash('sha256');
    for (let s = 0; s < 50; s++) {
      const splat = inkSplat(s);
      h.update(splat.url + splat.minRadius);
    }
    h.update(JSON.stringify(splatKeyframes([inkSplat(1), inkSplat(2)], { x: 1250, y: 30 }, 1280, 800)));
    expect(h.digest('hex')).toBe('b8bdbc2bacb2e1de512b8c541f7db077c22897973eae928a266037529b0015de');
  });
});

describe('mulberry32', () => {
  it('is deterministic, in [0, 1), and seed-dependent', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 1000 }, () => c())).not.toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('inkSplat', () => {
  it('is deterministic per seed and varies between seeds', () => {
    expect(inkSplat(7).url).toBe(inkSplat(7).url);
    expect(inkSplat(7).url).not.toBe(inkSplat(8).url);
    const urls = new Set(Array.from({ length: 100 }, (_, seed) => inkSplat(seed).url));
    expect(urls.size).toBe(100);
  });

  it('samples the outline at 240 angles', () => {
    expect(splatRadii(3)).toHaveLength(240);
  });

  it('keeps the drop inside its box and reports a safe inner radius', () => {
    for (let seed = 0; seed < 200; seed++) {
      const radii = splatRadii(seed);
      const { minRadius } = inkSplat(seed);
      expect(Math.max(...radii)).toBeLessThanOrEqual(96);
      expect(minRadius).toBeLessThan(Math.min(...radii));
      expect(minRadius).toBeGreaterThan(30);
      const svg = svgOf(inkSplat(seed));
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">')).toBe(true);
      const numbers = (svg.slice(svg.indexOf('<path')).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      for (const n of numbers) expect(Math.abs(n)).toBeLessThanOrEqual(100);
    }
  });

  it('is an irregular drop, not a circle: lobes and tendrils vary the radius', () => {
    for (let seed = 0; seed < 50; seed++) {
      const radii = splatRadii(seed);
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(10);
    }
  });

  it('draws one closed cubic Bézier outline and 8–15 satellite droplets', () => {
    for (let seed = 0; seed < 100; seed++) {
      const svg = svgOf(inkSplat(seed));
      const d = /<path d="([^"]+)"\/>/.exec(svg)?.[1] ?? '';
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect(d.match(/C/g)).toHaveLength(240);
      const drops = svg.match(/<circle /g) ?? [];
      expect(drops.length).toBeGreaterThanOrEqual(8);
      expect(drops.length).toBeLessThanOrEqual(15);
    }
  });

  it('never emits non-finite geometry', () => {
    for (let seed = -50; seed < 150; seed++) {
      const svg = svgOf(inkSplat(seed * 7919));
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(Number.isFinite(inkSplat(seed).minRadius)).toBe(true);
    }
  });
});

describe('coverage geometry', () => {
  it('finds the farthest viewport corner', () => {
    expect(farthestCorner({ x: 0, y: 0 }, 300, 400)).toBe(500);
    expect(farthestCorner({ x: 150, y: 200 }, 300, 400)).toBe(250);
    expect(farthestCorner({ x: 300, y: 0 }, 300, 400)).toBe(500);
  });

  it('sizes the mask so the innermost edge reaches the distance', () => {
    const splat = inkSplat(1);
    const size = coveringSize(splat, 1000);
    expect((size / 2) * (splat.minRadius / 100)).toBeCloseTo(1000, 6);
  });
});

describe('splatKeyframes', () => {
  const viewports = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 2560, height: 1440 },
  ];
  const origins = (w: number, h: number) => [
    { x: w - 30, y: 30 }, // a header toggle
    { x: w / 2, y: h / 2 },
    { x: 0, y: h },
    { x: -20, y: h + 20 }, // a point just outside the viewport
  ];

  it('stacks two splat layers that both use the same image list', () => {
    const frames = splatKeyframes(pair(5), { x: 10, y: 10 }, 800, 600);
    expect(frames).toHaveLength(33);
    for (const frame of frames) {
      expect(String(frame.maskImage).match(/url\(/g)).toHaveLength(2);
      expect(px(frame.maskSize as string)).toHaveLength(2); // one size per layer
    }
  });

  it('starts from nothing, only grows, and ends covering every corner', () => {
    for (const { width, height } of viewports) {
      for (const origin of origins(width, height)) {
        for (let seed = 0; seed < 25; seed++) {
          const splats = pair(seed);
          const frames = splatKeyframes(splats, origin, width, height);
          expect(frames[0]!.offset).toBe(0);
          expect(frames.at(-1)!.offset).toBe(1);
          expect(px(frames[0]!.maskSize as string)).toEqual([0, 0]);

          let previous = [0, 0];
          for (const frame of frames) {
            const [a, b] = px(frame.maskSize as string) as [number, number];
            expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true);
            expect(a).toBeGreaterThanOrEqual(previous[0]!);
            expect(b).toBeGreaterThanOrEqual(previous[1]!);
            previous = [a, b];
          }

          // Each layer alone reaches every corner with its innermost edge, past the edge.
          const reach = farthestCorner(origin, width, height);
          splats.forEach((splat, layer) => {
            const size = previous[layer]!;
            expect((size / 2) * (splat.minRadius / 100)).toBeGreaterThanOrEqual(reach + 4);
          });

          // Every frame is centred on the press point.
          for (const frame of frames) {
            const sizes = px(frame.maskSize as string);
            const positions = px(frame.maskPosition as string);
            expect(positions[0]! + sizes[0]! / 2).toBeCloseTo(origin.x, 1);
          }
        }
      }
    }
  });

  it('lets the second drop trail the first, so the outline changes as it spreads', () => {
    const splats: [Splat, Splat] = [inkSplat(1), inkSplat(1)];
    const frames = splatKeyframes(splats, { x: 400, y: 300 }, 800, 600);
    const mid = px(frames[16]!.maskSize as string);
    expect(mid[1]!).toBeLessThan(mid[0]!); // layer 2 < layer 1 mid-way
    const end = px(frames.at(-1)!.maskSize as string);
    expect(end[1]).toBeCloseTo(end[0]!, 1); // and catches up at the end
  });

  it('blooms quickly at first, then soaks slowly', () => {
    const frames = splatKeyframes(pair(2), { x: 400, y: 300 }, 800, 600);
    const end = px(frames.at(-1)!.maskSize as string)[0]!;
    const quarter = px(frames[8]!.maskSize as string)[0]! / end;
    expect(quarter).toBeCloseTo(0.387, 2); // soak(0.25): well ahead of linear (0.25)
  });
});
