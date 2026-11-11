import type { Point, TransitionOrigin } from './types';

/** Default length of the ink bleed, unchanged from the original. */
export const INK_DURATION_MS = 1100;
/** Default length of the colour cross-fade fallback. */
export const FADE_DURATION_MS = 450;
/** Longest the switch waits for images in view to decode in their new theme. */
export const IMAGE_WAIT_MS = 250;

/** Classes Inkshift sets on `<html>`; styled by `inkshift/transitions.css`. */
export const CLASS_NAMES = {
  /** An ink transition is on screen (scopes the `::view-transition-*` rules). */
  transition: 'inkshift-transition',
  /** The theme is being applied for a snapshot: CSS transitions are off. */
  switching: 'inkshift-switching',
  /** The colour cross-fade fallback is running. */
  fade: 'inkshift-fade',
} as const;

/** Elements carrying this attribute are treated as theme toggles during a transition. */
export const TOGGLE_ATTRIBUTE = 'data-inkshift-toggle';

export interface ResolvedOrigin {
  point: Point;
  /** The control that started the transition, when known. */
  trigger: Element | null;
}

const centre = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const isElement = (value: unknown): value is Element => typeof Element !== 'undefined' && value instanceof Element;

/**
 * Turns whatever the caller passed into a viewport point. A pointer press bleeds from the
 * pointer; a keyboard press (`detail === 0`) from the centre of the control; omitted,
 * from the centre of the viewport.
 */
export function resolveOrigin(origin: TransitionOrigin | undefined, win: Window = window): ResolvedOrigin {
  if (!origin) return { point: { x: win.innerWidth / 2, y: win.innerHeight / 2 }, trigger: null };
  if (isElement(origin)) return { point: centre(origin), trigger: origin };
  if ('clientX' in origin) {
    const trigger = isElement(origin.currentTarget) ? origin.currentTarget : null;
    if (origin.detail === 0 && trigger) return { point: centre(trigger), trigger };
    return { point: { x: origin.clientX, y: origin.clientY }, trigger };
  }
  return { point: { x: origin.x, y: origin.y }, trigger: null };
}

/**
 * Applies a theme change with every CSS transition off, so a snapshot shows final
 * colours rather than the first frame of a colour transition.
 */
export function switchInstantly(root: HTMLElement, apply: () => void): void {
  root.classList.add(CLASS_NAMES.switching);
  apply();
  void root.offsetWidth; // flush styles while transitions are off
  root.classList.remove(CLASS_NAMES.switching);
}

interface Fade {
  timer: ReturnType<typeof setTimeout>;
  done: Array<() => void>;
}

const fades = new WeakMap<HTMLElement, Fade>();

/**
 * Colour cross-fade for browsers without the ink transition. A new fade on the same root
 * restarts the timer; every pending fade resolves once the fade class is removed.
 */
export function crossFade(root: HTMLElement, duration: number, apply: () => void): Promise<void> {
  root.classList.add(CLASS_NAMES.fade);
  root.style.setProperty('--inkshift-fade-duration', `${duration}ms`);
  apply();
  const fade = fades.get(root) ?? { timer: undefined as unknown as ReturnType<typeof setTimeout>, done: [] };
  clearTimeout(fade.timer);
  fades.set(root, fade);
  return new Promise((resolve) => {
    fade.done.push(resolve);
    fade.timer = setTimeout(() => {
      root.classList.remove(CLASS_NAMES.fade);
      root.style.removeProperty('--inkshift-fade-duration');
      fades.delete(root);
      for (const fn of fade.done) fn();
    }, duration + 50);
  });
}

/** Resolves on the next task, so frameworks can render the new theme before the snapshot. */
export const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Waits (briefly) until images in view have decoded, so the "after" snapshot shows
 * theme-dependent images in their new form. A failed decode is ignored.
 */
export async function imagesInView(doc: Document = document, timeout = IMAGE_WAIT_MS): Promise<void> {
  const win = doc.defaultView ?? window;
  const visible = Array.from(doc.images).filter((img) => {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < win.innerHeight && r.right > 0 && r.left < win.innerWidth;
  });
  if (visible.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const decoded = Promise.all(visible.map((img) => (typeof img.decode === 'function' ? img.decode() : Promise.resolve()).catch(() => undefined)));
  await Promise.race([decoded, new Promise((resolve) => (timer = setTimeout(resolve, timeout)))]);
  clearTimeout(timer);
}

/**
 * Turns an animation around where it stands.
 *
 * `Animation.reverse()` auto-rewinds: called on an animation that has not advanced yet
 * (current time 0) it jumps to the end and plays back from there, which would show the
 * new theme in full for a frame. Here an animation still at its start simply finishes
 * backwards, and one already at its end finishes forwards.
 */
export function reverseAnimation(animation: Animation): void {
  const time = Number(animation.currentTime ?? 0);
  const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
  const forwards = animation.playbackRate >= 0;
  if (forwards && time <= 0) {
    animation.playbackRate = -animation.playbackRate || -1;
    animation.finish();
  } else if (!forwards && time >= end) {
    animation.playbackRate = -animation.playbackRate;
    animation.finish();
  } else {
    animation.reverse();
  }
}
