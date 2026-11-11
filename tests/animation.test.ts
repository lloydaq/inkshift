import { describe, expect, it, vi } from 'vitest';
import { createThemeController } from '../src';
import { reverseAnimation, resolveOrigin } from '../src/core/animation';
import { supportsInkTransition } from '../src/core/browserSupport';
import {
  advance,
  animations,
  flush,
  inkAnimation,
  installMatchMedia,
  installViewTransitions,
  settle,
  setReducedMotion,
  transitions,
  FakeAnimation,
} from './helpers/browser';

const root = () => document.documentElement;
const button = (rect = { left: 900, top: 20, width: 40, height: 40 }) => {
  const el = document.createElement('button');
  el.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON() {} }) as DOMRect;
  document.body.append(el);
  return el;
};
const click = (target: Element, x: number, y: number, detail = 1) => ({ clientX: x, clientY: y, detail, currentTarget: target });
const lastFrame = () => inkAnimation()!.keyframes.at(-1)!;
const centreOf = (frame: Keyframe) => {
  const size = parseFloat(String(frame.maskSize));
  const pos = String(frame.maskPosition).split(',')[0]!.trim().split(' ').map(parseFloat);
  return { x: pos[0]! + size / 2, y: pos[1]! + size / 2 };
};

describe('resolveOrigin', () => {
  it('uses the pointer for a pointer press', () => {
    const el = button();
    expect(resolveOrigin(click(el, 911, 33))).toEqual({ point: { x: 911, y: 33 }, trigger: el });
  });

  it('uses the centre of the control for a keyboard press (detail 0)', () => {
    const el = button();
    expect(resolveOrigin(click(el, 0, 0, 0)).point).toEqual({ x: 920, y: 40 });
  });

  it('accepts an element, a point, or nothing (viewport centre)', () => {
    const el = button();
    expect(resolveOrigin(el)).toEqual({ point: { x: 920, y: 40 }, trigger: el });
    expect(resolveOrigin({ x: 3, y: 4 })).toEqual({ point: { x: 3, y: 4 }, trigger: null });
    expect(resolveOrigin(undefined).point).toEqual({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  });
});

describe('feature detection', () => {
  it('needs View Transitions, pseudo-element animation and masks', () => {
    expect(supportsInkTransition()).toBe(false);
    installViewTransitions();
    expect(supportsInkTransition()).toBe(true);
    (globalThis as { CSS?: unknown }).CSS = { supports: () => false };
    expect(supportsInkTransition()).toBe(false);
  });
});

describe('ink transition', () => {
  it('bleeds two splats from the click point over 1100ms, then cleans up', async () => {
    installViewTransitions();
    const onTransitionStart = vi.fn();
    const onTransitionEnd = vi.fn();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { seed: 1 }, onTransitionStart, onTransitionEnd });
    const el = button();

    theme.toggleTheme(click(el, 915, 31));
    expect(transitions).toHaveLength(1);
    expect(root().classList.contains('inkshift-transition')).toBe(true);
    expect(theme.getState().isTransitioning).toBe(true);
    expect(onTransitionStart).toHaveBeenCalledWith({ from: 'dark', to: 'light', type: 'ink' });

    await flush();
    // The theme was applied inside the update callback, transitions off at the time.
    expect(root().dataset.theme).toBe('light');
    expect(root().classList.contains('inkshift-switching')).toBe(false);

    const ink = inkAnimation()!;
    expect(ink.options).toMatchObject({ duration: 1100, easing: 'linear', fill: 'both', pseudoElement: '::view-transition-new(root)' });
    expect(ink.target).toBe(root());
    expect(String(lastFrame().maskSize).split(',')).toHaveLength(2);
    const c = centreOf(lastFrame());
    expect(c.x).toBeCloseTo(915, 1);
    expect(c.y).toBeCloseTo(31, 1);

    await settle();
    expect(root().classList.contains('inkshift-transition')).toBe(false);
    expect(theme.getState()).toMatchObject({ resolvedTheme: 'light', theme: 'light', isTransitioning: false });
    expect(localStorage.getItem('inkshift-theme')).toBe('light');
    expect(onTransitionEnd).toHaveBeenCalledWith({ from: 'dark', to: 'light', type: 'ink', theme: 'light', reversed: false });
    theme.destroy();
  });

  it('bleeds from the centre of the toggle for a keyboard press', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.toggleTheme(click(button(), 0, 0, 0));
    await flush();
    const c = centreOf(lastFrame());
    expect(c.x).toBeCloseTo(920, 1);
    expect(c.y).toBeCloseTo(40, 1);
    await settle();
    theme.destroy();
  });

  it('bleeds from a programmatic point', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.setTheme('light', { x: 300, y: 200 });
    await flush();
    expect(centreOf(lastFrame()).x).toBeCloseTo(300, 1);
    await settle();
    theme.destroy();
  });

  it('uses the configured duration and a reproducible seed', async () => {
    installViewTransitions();
    const a = createThemeController({ defaultTheme: 'dark', animation: { duration: 600, seed: 99 } });
    a.toggleTheme({ x: 1, y: 1 });
    await flush();
    expect(inkAnimation()!.options.duration).toBe(600);
    const first = String(lastFrame().maskImage);
    await settle();
    a.destroy();

    root().removeAttribute('data-theme');
    localStorage.clear();
    const b = createThemeController({ defaultTheme: 'dark', animation: { duration: 600, seed: 99 } });
    b.toggleTheme({ x: 1, y: 1 });
    await flush();
    expect(String(lastFrame().maskImage)).toBe(first);
    await settle();
    b.destroy();
  });

  it('uses new splats for every transition', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { seed: 5 } });
    theme.toggleTheme();
    await settle();
    const first = String(lastFrame().maskImage);
    theme.toggleTheme();
    await settle();
    expect(String(lastFrame().maskImage)).not.toBe(first);
    theme.destroy();
  });

  it('does not animate when the theme in effect does not change', () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.setTheme('dark');
    expect(transitions).toHaveLength(0);
    theme.destroy();
  });

  it('waits briefly for images in view, and tolerates decode failures', async () => {
    installViewTransitions();
    const img = document.createElement('img');
    img.getBoundingClientRect = () => ({ top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;
    img.decode = () => Promise.reject(new Error('broken image'));
    document.body.append(img);
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.toggleTheme();
    await settle();
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });

  it('switches at once if the browser refuses to start a transition', () => {
    installViewTransitions();
    document.startViewTransition = () => {
      throw new DOMException('hidden', 'InvalidStateError');
    };
    const onTransitionEnd = vi.fn();
    const theme = createThemeController({ defaultTheme: 'dark', onTransitionEnd });
    theme.toggleTheme();
    expect(root().dataset.theme).toBe('light');
    expect(root().classList.contains('inkshift-transition')).toBe(false);
    expect(theme.getState().isTransitioning).toBe(false);
    expect(onTransitionEnd).toHaveBeenCalled();
    theme.destroy();
  });
});

describe('fallbacks', () => {
  it('cross-fades colours without View Transitions', async () => {
    vi.useFakeTimers();
    const onTransitionEnd = vi.fn();
    const theme = createThemeController({ defaultTheme: 'dark', onTransitionEnd });
    theme.toggleTheme({ x: 0, y: 0 });
    expect(root().dataset.theme).toBe('light');
    expect(root().classList.contains('inkshift-fade')).toBe(true);
    expect(root().style.getPropertyValue('--inkshift-fade-duration')).toBe('450ms');
    expect(theme.getState().isTransitioning).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(root().classList.contains('inkshift-fade')).toBe(false);
    expect(theme.getState().isTransitioning).toBe(false);
    expect(onTransitionEnd).toHaveBeenCalledWith(expect.objectContaining({ type: 'fade', theme: 'light' }));
    theme.destroy();
  });

  it('cross-fades when asked to, even where the ink could run', async () => {
    vi.useFakeTimers();
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { type: 'fade', duration: 200 } });
    theme.toggleTheme();
    expect(transitions).toHaveLength(0);
    expect(root().style.getPropertyValue('--inkshift-fade-duration')).toBe('200ms');
    await vi.advanceTimersByTimeAsync(300);
    expect(root().classList.contains('inkshift-fade')).toBe(false);
    theme.destroy();
  });

  it('a press mid-fade fades back; the last press wins', async () => {
    vi.useFakeTimers();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.toggleTheme();
    await vi.advanceTimersByTimeAsync(100);
    theme.toggleTheme();
    await vi.advanceTimersByTimeAsync(100);
    theme.toggleTheme();
    expect(root().dataset.theme).toBe('light');
    await vi.advanceTimersByTimeAsync(1000);
    expect(root().classList.contains('inkshift-fade')).toBe(false);
    expect(theme.getState()).toMatchObject({ resolvedTheme: 'light', isTransitioning: false });
    theme.destroy();
  });

  it('switches instantly with reduced motion, with no ink and no fade', () => {
    installViewTransitions();
    setReducedMotion(true);
    const onTransitionStart = vi.fn();
    const theme = createThemeController({ defaultTheme: 'dark', onTransitionStart });
    theme.toggleTheme({ x: 10, y: 10 });
    expect(root().dataset.theme).toBe('light');
    expect(transitions).toHaveLength(0);
    expect(animations).toHaveLength(0);
    expect(root().className).toBe('');
    expect(onTransitionStart).not.toHaveBeenCalled();
    theme.destroy();
  });

  it('can be told to ignore reduced motion (for apps with their own setting)', async () => {
    installViewTransitions();
    setReducedMotion(true);
    const theme = createThemeController({ defaultTheme: 'dark', respectReducedMotion: false });
    theme.toggleTheme();
    expect(transitions).toHaveLength(1);
    await settle();
    theme.destroy();
  });

  it('switches instantly with animation type instant', () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark', animation: { type: 'instant' } });
    theme.toggleTheme();
    expect(root().dataset.theme).toBe('light');
    expect(transitions).toHaveLength(0);
    theme.destroy();
  });

  it('picks up animation changes made with configure()', async () => {
    installViewTransitions();
    const theme = createThemeController({ defaultTheme: 'dark' });
    theme.configure({ animation: { type: 'instant' } });
    theme.toggleTheme();
    expect(transitions).toHaveLength(0);
    theme.configure({ animation: { type: 'ink', duration: 300 } });
    theme.toggleTheme();
    await flush();
    expect(inkAnimation()!.options.duration).toBe(300);
    await settle();
    theme.destroy();
  });
});

describe('reverseAnimation', () => {
  const make = (time: number, rate = 1) => {
    installMatchMedia();
    const a = new FakeAnimation(document.documentElement, [], { duration: 1000 });
    a.currentTime = time;
    a.playbackRate = rate;
    return a;
  };

  it('turns a running animation around where it stands', () => {
    const a = make(400);
    reverseAnimation(a as unknown as Animation);
    expect(a.currentTime).toBe(400);
    expect(a.playbackRate).toBe(-1);
  });

  it('finishes an animation that has not advanced yet backwards, without jumping to the end', () => {
    const a = make(0);
    reverseAnimation(a as unknown as Animation);
    expect(a.playbackRate).toBe(-1);
    expect(a.currentTime).toBe(0);
    expect(Math.max(...a.history)).toBe(0);
    expect(a.playState).toBe('finished');
  });

  it('finishes forwards an animation reversed while still at its end', () => {
    const a = make(1000, -1);
    reverseAnimation(a as unknown as Animation);
    expect(a.playbackRate).toBe(1);
    expect(a.currentTime).toBe(1000);
    expect(Math.min(...a.history.slice(1))).toBe(1000);
  });

  it('(the plain WAAPI reverse() would have jumped)', () => {
    const a = make(0);
    a.reverse();
    expect(a.currentTime).toBe(1000);
  });

  it('runs the real advance helper', async () => {
    const a = make(0);
    await advance(100);
    expect(a.currentTime).toBe(100);
  });
});
