/**
 * Ink splats for the theme switch: an irregular drop with a few tendrils and satellite
 * droplets, drawn as an SVG used as a CSS mask. Everything is in viewBox units on a
 * 200 × 200 box centred on 0,0.
 *
 * Extracted unchanged from the original portfolio implementation. The geometry is
 * pinned by a parity test (tests/inkSplat.test.ts): change it only on purpose.
 */

import type { Point } from './types';

export type { Point };

export interface Splat {
  /** `url("data:image/svg+xml,…")`, ready for `mask-image`. */
  url: string;
  /** Smallest distance from the centre to the edge of the drop (viewBox units). */
  minRadius: number;
}

const POINTS = 240;
const BASE = 62;
const MAX_RADIUS = 96;
/** Margin for the smoothed outline dipping between sample points. */
const SMOOTHING_SLACK = 1.5;

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Shortest signed distance between two angles. */
function angleDelta(a: number, b: number): number {
  const d = (a - b) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

/** Outline radius sampled at POINTS evenly spaced angles. */
export function splatRadii(seed: number): number[] {
  const rand = mulberry32(seed);
  // Broad lobes make the drop lopsided; fine ripples roughen the edge.
  const waves = [
    { k: 2, amp: 4 + rand() * 3 },
    { k: 3, amp: 3 + rand() * 3 },
    { k: 5, amp: 1.5 + rand() * 2 },
    { k: 7, amp: 1 + rand() * 1.2 },
    { k: 11, amp: 0.8 + rand() * 0.8 },
    { k: 17, amp: 0.5 + rand() * 0.6 },
    { k: 26, amp: 0.35 + rand() * 0.4 },
    { k: 39, amp: 0.25 + rand() * 0.3 },
  ].map((w) => ({ ...w, phase: rand() * Math.PI * 2 }));
  // A few long fingers and more short ones, like ink wicking along paper fibres.
  const tendrils = Array.from({ length: 10 + Math.floor(rand() * 6) }, (_, i) => ({
    angle: rand() * Math.PI * 2,
    width: 0.012 + rand() * 0.03,
    reach: i < 4 ? 12 + rand() * 18 : 3 + rand() * 7,
  }));

  return Array.from({ length: POINTS }, (_, i) => {
    const theta = (i / POINTS) * Math.PI * 2;
    let r = BASE;
    for (const w of waves) r += w.amp * Math.sin(w.k * theta + w.phase);
    for (const t of tendrils) {
      const d = angleDelta(theta, t.angle) / t.width;
      r += t.reach * Math.exp(-d * d);
    }
    return Math.min(MAX_RADIUS, r);
  });
}

/** Closed Catmull-Rom spline through the points, as cubic Béziers. */
function smoothPath(points: Point[]): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n]!;
  let d = `M${round(at(0).x)} ${round(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return `${d}Z`;
}

/** One ink splat for `seed`: the same seed always gives the same drop. */
export function inkSplat(seed: number): Splat {
  const radii = splatRadii(seed);
  const outline = radii.map((r, i) => {
    const theta = (i / POINTS) * Math.PI * 2;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  });

  // Satellite droplets thrown just beyond the edge.
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const drops: string[] = [];
  for (let i = 0, count = 8 + Math.floor(rand() * 8); i < count; i++) {
    const index = Math.floor(rand() * POINTS);
    const theta = (index / POINTS) * Math.PI * 2;
    const size = 0.3 + rand() * 0.6;
    const dist = Math.min(100 - size, radii[index]! + 1.2 + rand() * 3.5);
    drops.push(`<circle cx="${round(dist * Math.cos(theta))}" cy="${round(dist * Math.sin(theta))}" r="${round(size)}"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200"><path d="${smoothPath(outline)}"/>${drops.join('')}</svg>`;
  return {
    url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    minRadius: Math.min(...radii) - SMOOTHING_SLACK,
  };
}

export interface SplatFlow {
  /** Offset of each layer's centre from the origin at time `t`. */
  drift?: (t: number, layer: number, reach: number) => Point;
  /**
   * Exponent applied to the spread curve. Above 1 the front starts slower, which suits
   * a soft-edged splat whose visible front runs well ahead of its solid core.
   */
  pace?: number;
}

/** Distance from `p` to the farthest corner of a `width` × `height` viewport. */
export function farthestCorner(p: Point, width: number, height: number): number {
  return Math.max(Math.hypot(p.x, p.y), Math.hypot(width - p.x, p.y), Math.hypot(p.x, height - p.y), Math.hypot(width - p.x, height - p.y));
}

/** Mask size (px) at which a splat's innermost edge reaches `distance` from its centre. */
export function coveringSize(splat: Splat, distance: number): number {
  return (2 * distance * 100) / splat.minRadius;
}

/**
 * Keyframes for `mask-image/-size/-position` that grow two splats from `origin` until
 * together they cover the whole viewport. The second drop trails the first, so the
 * outline keeps changing as it spreads instead of simply scaling.
 *
 * Without `flow` the output is the original's, byte for byte.
 */
export function splatKeyframes(
  splats: [Splat, Splat],
  origin: Point,
  width: number,
  height: number,
  steps = 32,
  /** Optional fluid motion (see fluid.ts). Without it the output is the original's. */
  flow?: SplatFlow,
): Keyframe[] {
  // A few px past the corner so antialiasing never leaves a hairline of the old theme.
  const reach = farthestCorner(origin, width, height) + 4;
  // 6% headroom: the corners are inked a little before the end, while the drop still moves.
  const ends = splats.map((s) => coveringSize(s, reach) * 1.06);
  // Quick first bloom, then a steady soak that slows as it reaches the far corners.
  const soak = (t: number) => 0.45 * t + 0.55 * (1 - (1 - t) ** 2.4);
  const spread = [soak, (t: number) => soak(t) ** 1.35];
  const image = splats.map((s) => s.url).join(', ');

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const sizes = ends.map((end, layer) => end * (flow?.pace ? spread[layer]!(t) ** flow.pace : spread[layer]!(t)));
    return {
      offset: t,
      maskImage: image,
      maskSize: sizes.map((s) => `${round(s)}px ${round(s)}px`).join(', '),
      maskPosition: sizes
        .map((s, layer) => {
          const d = flow?.drift ? flow.drift(t, layer, reach) : { x: 0, y: 0 };
          return `${round(origin.x + d.x - s / 2)}px ${round(origin.y + d.y - s / 2)}px`;
        })
        .join(', '),
    };
  });
}
