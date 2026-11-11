/**
 * Test doubles for the browser APIs jsdom lacks: matchMedia, View Transitions and Web
 * Animations. The animation double follows the WAAPI timing model closely enough to
 * exercise reversal: a manual clock, playbackRate, finish(), and reverse() with the
 * spec's auto-rewind (which is what makes reversing at time 0 jump to the end).
 */
import { vi } from 'vitest';

// ---------- matchMedia ----------

interface MediaState {
  light: boolean;
  reducedMotion: boolean;
}

const media: MediaState = { light: false, reducedMotion: false };
const mediaListeners = new Set<(event: { matches: boolean; media: string }) => void>();

function mediaMatches(query: string): boolean {
  if (query.includes('prefers-color-scheme: light')) return media.light;
  if (query.includes('prefers-color-scheme: dark')) return !media.light;
  if (query.includes('prefers-reduced-motion: reduce')) return media.reducedMotion;
  return false;
}

export function installMatchMedia(initial: Partial<MediaState> = {}) {
  Object.assign(media, initial);
  window.matchMedia = ((query: string) =>
    ({
      media: query,
      get matches() {
        return mediaMatches(query);
      },
      onchange: null,
      addEventListener: (_: string, fn: (event: { matches: boolean; media: string }) => void) => {
        if (query.includes('prefers-color-scheme')) mediaListeners.add(fn);
      },
      removeEventListener: (_: string, fn: (event: { matches: boolean; media: string }) => void) => mediaListeners.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

export const mediaListenerCount = () => mediaListeners.size;

/** Changes the OS theme and notifies listeners, as the browser would. */
export function setSystemTheme(theme: 'light' | 'dark') {
  media.light = theme === 'light';
  for (const fn of [...mediaListeners]) fn({ matches: media.light, media: '(prefers-color-scheme: light)' });
}

export function setReducedMotion(value: boolean) {
  media.reducedMotion = value;
}

// ---------- Web Animations ----------

export const animations: FakeAnimation[] = [];

export class FakeAnimation {
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: AnimationPlayState = 'running';
  onfinish: ((event: unknown) => void) | null = null;
  readonly effect: { getComputedTiming: () => { endTime: number }; pseudoElement: string | null; getKeyframes: () => Keyframe[] };
  /** Every currentTime the animation has been seen at (to catch jumps). */
  readonly history: number[] = [0];
  private finishedNotified = false;
  finishedResolve!: () => void;
  readonly finished = new Promise<void>((resolve) => (this.finishedResolve = resolve));

  constructor(
    readonly target: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions,
  ) {
    const duration = Number(options.duration ?? 0);
    this.effect = {
      getComputedTiming: () => ({ endTime: duration }),
      pseudoElement: options.pseudoElement ?? null,
      getKeyframes: () => keyframes,
    };
    animations.push(this);
  }

  get duration() {
    return Number(this.options.duration ?? 0);
  }

  private seek(time: number) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.history.push(this.currentTime);
  }

  /** Advances the clock; finishes when it reaches the boundary in its direction. */
  tick(ms: number) {
    if (this.playState !== 'running') return;
    this.seek(Number(this.currentTime) + ms * this.playbackRate);
    this.checkFinished();
  }

  private checkFinished() {
    const t = Number(this.currentTime);
    if ((this.playbackRate > 0 && t >= this.duration) || (this.playbackRate < 0 && t <= 0)) {
      this.playState = 'finished';
      if (!this.finishedNotified) {
        this.finishedNotified = true;
        queueMicrotask(() => {
          this.onfinish?.({});
          this.finishedResolve();
        });
      }
    }
  }

  /** WAAPI reverse(): negate the rate, then play with auto-rewind. */
  reverse() {
    this.playbackRate = -this.playbackRate;
    const t = Number(this.currentTime);
    if (this.playbackRate > 0 && (t < 0 || t >= this.duration)) this.seek(0);
    else if (this.playbackRate < 0 && (t <= 0 || t > this.duration)) this.seek(this.duration);
    this.playState = 'running';
    this.finishedNotified = false;
  }

  finish() {
    this.seek(this.playbackRate > 0 ? this.duration : 0);
    this.checkFinished();
  }

  cancel() {
    this.playState = 'idle';
    this.currentTime = null;
  }
}

// ---------- View Transitions ----------

export const transitions: FakeViewTransition[] = [];
let activeTransition: FakeViewTransition | null = null;

export class FakeViewTransition {
  readonly updateCallbackDone: Promise<void>;
  readonly ready: Promise<void>;
  readonly finished: Promise<void>;
  skipped = false;
  animations: FakeAnimation[] = [];
  private resolveFinished!: () => void;
  private readyDone = false;

  constructor(callback: () => unknown) {
    transitions.push(this);
    if (activeTransition) activeTransition.skipTransition();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the fake is the active transition
    activeTransition = this;
    this.finished = new Promise((resolve) => (this.resolveFinished = resolve));
    this.updateCallbackDone = Promise.resolve().then(() => callback()).then(() => undefined);
    this.ready = this.updateCallbackDone.then(() => {
      if (this.skipped) throw new DOMException('Transition was skipped', 'AbortError');
      this.readyDone = true;
      // The browser checks for running pseudo-element animations on the next frame.
      setTimeout(() => this.check(), 0);
    });
    this.updateCallbackDone.catch(() => this.end());
  }

  /** Called when an animation on this transition's pseudo-elements is created or finishes. */
  check() {
    if (!this.readyDone || this.skipped) return;
    if (this.animations.every((a) => a.playState === 'finished')) {
      // Finished animations hold for one frame before the pseudo-elements go.
      setTimeout(() => this.end(), 0);
    }
  }

  ended = false;

  private end() {
    this.ended = true;
    if (activeTransition === this) activeTransition = null;
    this.resolveFinished();
  }

  skipTransition() {
    if (this.skipped) return;
    this.skipped = true;
    for (const a of this.animations) a.cancel();
    void this.updateCallbackDone.catch(() => undefined).then(() => this.end());
  }

  get types() {
    return new Set<string>();
  }
}

export function installViewTransitions() {
  (document as { startViewTransition?: unknown }).startViewTransition = (callback: () => unknown) => new FakeViewTransition(callback);
  (globalThis as { KeyframeEffect?: unknown }).KeyframeEffect = class {
    pseudoElement = null;
  };
  Object.defineProperty((globalThis as unknown as { KeyframeEffect: { prototype: object } }).KeyframeEffect.prototype, 'pseudoElement', {
    value: null,
    configurable: true,
    writable: true,
  });
  (globalThis as { CSS?: unknown }).CSS = { supports: () => true, escape: (s: string) => s };
  Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    const animation = new FakeAnimation(this, keyframes as Keyframe[], (typeof options === 'number' ? { duration: options } : options) ?? {});
    if (activeTransition && animation.options.pseudoElement?.startsWith('::view-transition')) {
      const vt = activeTransition;
      vt.animations.push(animation);
      void animation.finished.then(() => vt.check());
    }
    return animation as unknown as Animation;
  };
}

export function uninstallViewTransitions() {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  delete (globalThis as { KeyframeEffect?: unknown }).KeyframeEffect;
  delete (globalThis as { CSS?: unknown }).CSS;
  delete (Element.prototype as { animate?: unknown }).animate;
}

/** Advances every running animation by `ms` and lets promises settle. */
export async function advance(ms: number, step = 50) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    for (const a of animations) a.tick(Math.min(step, ms - elapsed));
    await flush();
  }
}

/** Lets pending promises and zero-delay timers run. */
export async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Runs the ink until every transition has finished. */
export async function settle() {
  for (let i = 0; i < 100; i++) {
    await advance(100);
    if (!activeTransition && !document.documentElement.classList.contains('inkshift-transition')) return;
  }
  throw new Error('transition did not settle');
}

/** The single splat animation of the most recent transition. */
export const inkAnimation = () => animations.filter((a) => a.options.pseudoElement === '::view-transition-new(root)').at(-1);

export function resetBrowser() {
  vi.useRealTimers();
  activeTransition = null;
  transitions.length = 0;
  animations.length = 0;
  mediaListeners.clear();
  media.light = false;
  media.reducedMotion = false;
  installMatchMedia();
  uninstallViewTransitions();
  const root = document.documentElement;
  for (const name of [...root.getAttributeNames()]) if (name !== 'lang') root.removeAttribute(name);
  root.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  document.body.innerHTML = '';
  try {
    window.localStorage.clear();
  } catch {
    // replaced by a test
  }
}
