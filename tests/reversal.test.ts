/**
 * Reversal: pressed again while the ink is spreading, the same animation runs backwards
 * and the original theme is restored. Never a second transition, never a restart.
 */
import { describe, expect, it, vi } from 'vitest';
import { createThemeController } from '../src';
import { activeInkRun } from '../src/core/themeSwitch';
import { advance, flush, inkAnimation, installViewTransitions, settle, transitions, animations, setSystemTheme } from './helpers/browser';

const root = () => document.documentElement;
const theme = () => root().dataset.theme;

function setup(options: Parameters<typeof createThemeController>[0] = {}) {
  installViewTransitions();
  const onTransitionEnd = vi.fn();
  const controller = createThemeController({ defaultTheme: 'system', onTransitionEnd, animation: { seed: 3 }, ...options });
  return { controller, onTransitionEnd };
}

describe('reversal', () => {
  it('reverses during the initial expansion and restores the original theme', async () => {
    const { controller, onTransitionEnd } = setup();
    controller.toggleTheme({ x: 50, y: 50 });
    await flush();
    await advance(200);
    const ink = inkAnimation()!;
    expect(ink.currentTime).toBe(200);

    controller.toggleTheme({ x: 50, y: 50 });
    expect(transitions).toHaveLength(1); // no second transition
    expect(ink.playbackRate).toBe(-1);
    expect(ink.currentTime).toBe(200); // turned around in place, not restarted

    await advance(100);
    expect(ink.currentTime).toBe(100); // retracting
    await settle();
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('inkshift-theme')).toBeNull(); // back to following the system
    expect(controller.getState()).toMatchObject({ theme: 'system', resolvedTheme: 'dark', isTransitioning: false });
    expect(onTransitionEnd).toHaveBeenCalledWith(expect.objectContaining({ from: 'dark', to: 'light', theme: 'dark', reversed: true }));
    expect(animations).toHaveLength(1); // one animation throughout
    controller.destroy();
  });

  it('reverses near the end of the expansion', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(1050);
    const ink = inkAnimation()!;
    expect(ink.currentTime).toBe(1050);
    controller.toggleTheme();
    expect(ink.currentTime).toBe(1050);
    expect(ink.playbackRate).toBe(-1);
    await settle();
    expect(theme()).toBe('dark');
    expect(Math.max(...ink.history)).toBe(1050); // never ran on to the end
    controller.destroy();
  });

  it('restores an explicit previous choice', async () => {
    localStorage.setItem('inkshift-theme', 'dark');
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(300);
    controller.toggleTheme();
    await settle();
    expect(localStorage.getItem('inkshift-theme')).toBe('dark');
    expect(controller.getState().theme).toBe('dark');
    controller.destroy();
  });

  it('reverses after setup but before the animation exists, without flashing the new theme', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    controller.toggleTheme(); // before the update callback / ready
    expect(transitions).toHaveLength(1);
    await flush();
    const ink = inkAnimation()!;
    expect(Math.max(...ink.history)).toBe(0); // never jumped to the end (fully covered)
    await settle();
    expect(theme()).toBe('dark');
    controller.destroy();
  });

  it('handles reversal right as the animation is created (time 0)', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    const ink = inkAnimation()!;
    expect(ink.currentTime).toBe(0);
    controller.toggleTheme();
    expect(Math.max(...ink.history)).toBe(0);
    await settle();
    expect(theme()).toBe('dark');
    controller.destroy();
  });

  it('two presses back: reversing a reversal heads for the new theme again', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(400);
    controller.toggleTheme(); // back
    await advance(100);
    controller.toggleTheme(); // forward again
    const ink = inkAnimation()!;
    expect(ink.playbackRate).toBe(1);
    expect(ink.currentTime).toBe(300);
    await settle();
    expect(theme()).toBe('light');
    expect(localStorage.getItem('inkshift-theme')).toBe('light');
    expect(transitions).toHaveLength(1);
    controller.destroy();
  });

  it('rapid presses: the final theme matches the last press (odd and even counts)', async () => {
    for (const presses of [1, 2, 3, 4, 5, 6, 7]) {
      root().removeAttribute('data-theme');
      localStorage.clear();
      transitions.length = 0;
      const { controller } = setup();
      for (let i = 0; i < presses; i++) {
        controller.toggleTheme({ x: 5, y: 5 });
        await advance(i % 2 ? 30 : 0);
      }
      await settle();
      expect(theme()).toBe(presses % 2 ? 'light' : 'dark');
      expect(controller.getState().isTransitioning).toBe(false);
      expect(activeInkRun()).toBeNull();
      controller.destroy();
    }
  });

  it('adds one capture listener per transition and removes it', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { controller } = setup();
    controller.toggleTheme();
    controller.toggleTheme();
    controller.toggleTheme();
    const clicks = () => add.mock.calls.filter(([type]) => type === 'click').length;
    expect(clicks()).toBe(1);
    await settle();
    const removed = remove.mock.calls.filter(([type]) => type === 'click');
    expect(removed).toHaveLength(1);
    expect(removed[0]![1]).toBe(add.mock.calls.find(([type]) => type === 'click')![1]);
    controller.destroy();
  });

  it('leaves no stale state: a press after the ink lands starts a fresh transition', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await settle();
    expect(activeInkRun()).toBeNull();
    expect(root().classList.contains('inkshift-transition')).toBe(false);
    controller.toggleTheme();
    expect(transitions).toHaveLength(2);
    await flush();
    expect(inkAnimation()!.playbackRate).toBe(1);
    await settle();
    expect(theme()).toBe('dark');
    controller.destroy();
  });

  it('a press between landing and cleanup starts a new transition instead of reversing a finished one', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    const first = inkAnimation()!;
    first.finish();
    await Promise.resolve();
    await Promise.resolve(); // onfinish has run; transition.finished not yet
    expect(activeInkRun()?.settled).toBe(true);
    controller.toggleTheme();
    expect(transitions).toHaveLength(2); // the browser skips the old one
    await settle();
    expect(theme()).toBe('dark');
    expect(root().classList.contains('inkshift-transition')).toBe(false);
    controller.destroy();
  });

  it('never runs competing transitions or animations', async () => {
    const { controller } = setup();
    for (let i = 0; i < 12; i++) {
      controller.toggleTheme();
      for (let step = 0; step < 4; step++) {
        await advance(10);
        const open = transitions.filter((t) => !t.ended);
        expect(open.length).toBeLessThanOrEqual(1);
        expect(animations.filter((a) => a.playState === 'running').length).toBeLessThanOrEqual(1);
      }
    }
    await settle();
    expect(theme()).toBe('dark'); // 12 presses: back where it started
    controller.destroy();
  });

  it('keeps one transition while presses come faster than the ink can retract', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(500);
    for (let i = 0; i < 9; i++) {
      controller.toggleTheme();
      await advance(20);
    }
    expect(transitions).toHaveLength(1);
    await settle();
    expect(theme()).toBe('dark'); // 10 presses
    controller.destroy();
  });

  it('presses that the browser hit-tests to <html> over a toggle still reverse', async () => {
    const { controller } = setup();
    const toggle = document.createElement('button');
    toggle.setAttribute('data-inkshift-toggle', '');
    toggle.getBoundingClientRect = () => ({ left: 10, top: 10, right: 50, bottom: 50, width: 40, height: 40 }) as DOMRect;
    document.body.append(toggle);
    controller.toggleTheme(toggle);
    await flush();
    await advance(200);
    // Elsewhere on the page: ignored.
    root().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 300 }));
    expect(inkAnimation()!.playbackRate).toBe(1);
    // Over the toggle: reverses.
    root().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }));
    expect(inkAnimation()!.playbackRate).toBe(-1);
    await settle();
    expect(theme()).toBe('dark');
    controller.destroy();
  });

  it('setTheme towards the theme the ink is leaving reverses it; towards where it is heading does not', async () => {
    const { controller } = setup();
    controller.setTheme('light', { x: 1, y: 1 });
    await flush();
    await advance(200);
    controller.setTheme('light');
    expect(inkAnimation()!.playbackRate).toBe(1);
    controller.setTheme('dark');
    expect(inkAnimation()!.playbackRate).toBe(-1);
    expect(transitions).toHaveLength(1);
    await settle();
    expect(theme()).toBe('dark');
    expect(controller.getState().theme).toBe('dark');
    expect(localStorage.getItem('inkshift-theme')).toBe('dark');
    controller.destroy();
  });

  it('ends on the requested theme when the transition is skipped mid-reversal (tab hidden)', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(300);
    controller.toggleTheme(); // reversing
    transitions[0]!.skipTransition(); // e.g. the document became hidden: no onfinish
    await flush();
    expect(theme()).toBe('dark');
    expect(root().classList.contains('inkshift-transition')).toBe(false);
    expect(controller.getState().isTransitioning).toBe(false);
    controller.destroy();
  });

  it('ends on the new theme when skipped while spreading', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(300);
    transitions[0]!.skipTransition();
    await flush();
    expect(theme()).toBe('light');
    controller.destroy();
  });

  it('applies a system theme change that happened during the ink once it lands', async () => {
    const { controller } = setup();
    controller.toggleTheme();
    await flush();
    await advance(200);
    controller.toggleTheme(); // back to "system"
    setSystemTheme('light'); // OS flips while the ink retracts
    await settle();
    expect(controller.getState().theme).toBe('system');
    expect(theme()).toBe('light');
    controller.destroy();
  });
});
