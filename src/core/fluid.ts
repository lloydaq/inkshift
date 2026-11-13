/**
 * Fluidity: turns the ink into something closer to smoke.
 *
 * At 0 nothing here runs and the transition is the original ink. Above 0, each splat's
 * outline is warped by fractal noise into wisps and its edge is blurred into a soft
 * gradient, and the two layers curl away from the press point as they spread before
 * settling back, so the front billows instead of soaking outward evenly.
 */
import { inkSplat, mulberry32, type Splat, type SplatFlow } from './inkSplat';

const PREFIX = 'url("data:image/svg+xml,';
/** Floor for the fully opaque radius, so the covering size stays bounded. */
const MIN_SOLID_RADIUS = 12;

export const clampFluidity = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value as number)) : 0;

/**
 * A splat for `seed`, softened by `fluidity` (0–1). At 0 this is exactly `inkSplat(seed)`.
 *
 * The filter lives inside the SVG, so the wisps and the soft edge scale with the mask.
 * `minRadius` shrinks to the radius that is still fully opaque after warping and
 * blurring, which keeps the viewport-coverage guarantee intact.
 */
export function fluidSplat(seed: number, fluidity = 0): Splat {
  const base = inkSplat(seed);
  const f = clampFluidity(fluidity);
  if (f === 0) return base;

  // All in viewBox units of the original 200 × 200 box.
  const warp = 16 * f; // feDisplacementMap scale: moves the outline by up to ±warp/2 per axis
  const blur = 1 + 4.5 * f; // Gaussian standard deviation
  const frequency = 0.02 + 0.012 * f;
  // How far the shape can now reach beyond, or be eaten into from, its original outline.
  const spill = (warp / 2) * Math.SQRT2 + blur * 3;
  const half = 100 + spill; // a larger box, so the soft edge is never clipped

  const svg = decodeURIComponent(base.url.slice(PREFIX.length, -2));
  const shapes = svg.slice(svg.indexOf('<path'), svg.lastIndexOf('</svg>'));
  const noiseSeed = (seed >>> 0) % 9973;
  const fluid =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}">` +
    `<filter id="f" filterUnits="userSpaceOnUse" x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${frequency.toFixed(4)}" numOctaves="2" seed="${noiseSeed}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="${warp.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>` +
    `<feGaussianBlur stdDeviation="${blur.toFixed(2)}"/>` +
    `</filter><g filter="url(#f)">${shapes}</g></svg>`;

  // Still solid after the edge has been warped inward and blurred; rescaled because the
  // mask box now spans `half` units from its centre instead of 100.
  const solid = Math.max(MIN_SOLID_RADIUS, base.minRadius - spill);
  return { url: `${PREFIX}${encodeURIComponent(fluid)}")`, minRadius: (solid * 100) / half };
}

/**
 * How a fluid transition moves, or `undefined` for crisp ink.
 *
 * - Each layer's centre curls away from the press point, swelling mid-way and returning
 *   to nothing at both ends, so the transition still starts at the press and ends exactly
 *   covering the viewport. The two layers curl opposite ways.
 * - The spread is paced more gently: a soft front runs well ahead of the solid core that
 *   must reach the corners, so without this it would cross the screen in the first third of the duration.
 */
export function fluidFlow(seed: number, fluidity: number): SplatFlow | undefined {
  const f = clampFluidity(fluidity);
  if (f === 0) return undefined;
  const rand = mulberry32(seed ^ 0x51ed270b);
  const layers = [0, 1].map((i) => ({
    angle: rand() * Math.PI * 2,
    turn: (i === 0 ? 1 : -1) * (0.9 + rand() * 0.8) * Math.PI,
    swell: 0.035 + rand() * 0.03,
  }));
  return {
    pace: 1 + f,
    drift: (t, layer, reach) => {
      const l = layers[layer % layers.length]!;
      const size = f * l.swell * reach * Math.sin(Math.PI * t);
      const angle = l.angle + l.turn * t;
      return { x: size * Math.cos(angle), y: size * Math.sin(angle) };
    },
  };
}

/** Side of the bitmap a fluid splat is baked into. The soft edge hides the upscaling. */
const BAKE_SIZE = 1024;
/** Longest the transition waits for the bake before falling back to crisp ink. */
const BAKE_TIMEOUT_MS = 400;

/**
 * Renders a fluid splat to a bitmap once. Animating the SVG directly would make the
 * browser re-run the noise and blur filter on a multi-thousand-pixel mask every frame;
 * a bitmap is a texture the compositor only has to scale.
 *
 * Rejects if the browser cannot rasterise it (no canvas, a tainted canvas, a decode
 * failure, or a timeout); the caller then falls back to the crisp ink splat.
 */
export function bakeSplat(splat: Splat, doc: Document = document, size = BAKE_SIZE, timeout = BAKE_TIMEOUT_MS): Promise<Splat> {
  return new Promise((resolve, reject) => {
    const view = doc.defaultView;
    const ImageCtor = view?.Image;
    if (!ImageCtor) {
      reject(new Error('inkshift: no Image constructor'));
      return;
    }
    const timer = setTimeout(() => reject(new Error('inkshift: baking the splat timed out')), timeout);
    const image = new ImageCtor();
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('inkshift: the splat could not be decoded'));
    };
    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = doc.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('inkshift: no 2D canvas');
        context.drawImage(image, 0, 0, size, size);
        resolve({ url: `url("${canvas.toDataURL('image/png')}")`, minRadius: solidRadius(context, size) ?? splat.minRadius });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    image.width = image.height = size;
    image.src = splat.url.slice(5, -2); // strip url(" … ")
  });
}

/** Alpha at or above this counts as covered: under 1.5% of the old theme left. */
const SOLID_ALPHA = 252;

/**
 * The radius (in the mask's ±100 units) inside which the baked splat is solid, measured
 * from its pixels. The analytic bound in `fluidSplat` has to assume the worst case of the
 * noise everywhere, which would make the mask several times larger than needed and send
 * the visible front off-screen early; the real shape is far more compact.
 */
function solidRadius(context: CanvasRenderingContext2D, size: number): number | null {
  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  const c = (size - 1) / 2;
  let nearest = Infinity;
  for (let y = 0, i = 3; y < size; y++) {
    const dy = (y - c) * (y - c);
    for (let x = 0; x < size; x++, i += 4) {
      if (data[i]! < SOLID_ALPHA) {
        const d = (x - c) * (x - c) + dy;
        if (d < nearest) nearest = d;
      }
    }
  }
  if (!Number.isFinite(nearest)) return null;
  // One unit of slack for resampling when the bitmap is scaled up.
  const radius = (Math.sqrt(nearest) / (size / 2)) * 100 - 1;
  return radius > 1 ? radius : null;
}

/**
 * The pair of splats for one ink run. Crisp ink is ready at once; fluid splats are baked
 * first, falling back to the crisp pair for the same seeds if that fails.
 */
export function splatPair(seed: number, fluidity: number, doc: Document = document): [Splat, Splat] | Promise<[Splat, Splat]> {
  const f = clampFluidity(fluidity);
  const crisp: [Splat, Splat] = [inkSplat(seed), inkSplat(seed + 1)];
  if (f === 0) return crisp;
  return Promise.all([bakeSplat(fluidSplat(seed, f), doc), bakeSplat(fluidSplat(seed + 1, f), doc)]).then(
    (pair) => pair as [Splat, Splat],
    () => crisp,
  );
}
