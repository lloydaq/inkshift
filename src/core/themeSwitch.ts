import { CLASS_NAMES, TOGGLE_ATTRIBUTE, imagesInView, nextTask, reverseAnimation, switchInstantly } from './animation';
import { splatKeyframes, type Splat } from './inkSplat';
import type { Point, Theme } from './types';

/**
 * The ink bleed.
 *
 * The View Transitions API snapshots the whole screen before and after the switch, so
 * every pixel (sticky headers, backgrounds, images) changes together and exactly as it
 * will look. The new theme is revealed through two ink splats that grow from `origin`
 * until they cover the viewport.
 *
 * Pressed again before the ink lands, the same animation runs backwards: the ink pulls
 * back to where it was pressed and the page is handed back to the old theme. There is
 * never more than one ink run per document.
 */

export interface InkRunOptions {
  doc: Document;
  from: Theme;
  to: Theme;
  origin: Point;
  /** The control that was pressed; presses over it during the transition reverse the ink. */
  trigger: Element | null;
  splats: [Splat, Splat];
  duration: number;
  /** Puts `to` into effect (attribute, storage). Runs inside the view-transition update. */
  commit: () => void;
  /** Puts `from` back into effect after the ink has been pulled all the way back. */
  revert: () => void;
  /** Reads the theme in effect. */
  read: () => Theme;
}

export interface InkRun {
  readonly from: Theme;
  readonly to: Theme;
  /** True while the ink is heading back to `from`. */
  readonly reversed: boolean;
  /** True once the ink has landed (either way); a press now starts a new transition. */
  readonly settled: boolean;
  /** The splat animation, once the transition's pseudo-elements exist. */
  readonly animation: Animation | null;
  /** Turns the ink around. Ignored once it has settled. */
  reverse(): void;
  /** Resolves once the transition is over and cleaned up. Never rejects. */
  readonly finished: Promise<void>;
}

const runs = new WeakMap<Document, InkRun>();

/** The ink run on screen in `doc`, if any. */
export function activeInkRun(doc: Document = document): InkRun | null {
  return runs.get(doc) ?? null;
}

export function startInkRun(options: InkRunOptions): InkRun {
  const { doc, from, to, origin, trigger, splats, duration, commit, revert, read } = options;
  const root = doc.documentElement;
  const win = doc.defaultView ?? window;

  let reversed = false;
  let settled = false;
  let animation: Animation | null = null;
  const restore = () => switchInstantly(root, revert);

  root.classList.add(CLASS_NAMES.transition);
  let transition: ViewTransition;
  try {
    transition = doc.startViewTransition(async () => {
      // Transitions stay off for the whole update, so whatever a framework re-renders for
      // the new theme is captured in its final state, not mid-transition.
      root.classList.add(CLASS_NAMES.switching);
      try {
        commit();
        // Let frameworks repaint for the new theme before the snapshot.
        await nextTask();
        await imagesInView(doc);
        void root.offsetWidth;
      } finally {
        root.classList.remove(CLASS_NAMES.switching);
      }
    });
  } catch {
    // startViewTransition can throw (e.g. a hidden document in some engines): switch at once.
    root.classList.remove(CLASS_NAMES.transition);
    switchInstantly(root, commit);
    const done: InkRun = { from, to, reversed: false, settled: true, animation: null, reverse() {}, finished: Promise.resolve() };
    return done;
  }

  const run: InkRun = {
    from,
    to,
    get reversed() {
      return reversed;
    },
    get settled() {
      return settled;
    },
    get animation() {
      return animation;
    },
    reverse() {
      if (settled) return;
      reversed = !reversed;
      if (animation) reverseAnimation(animation);
    },
    finished: Promise.resolve(),
  };
  runs.set(doc, run);

  // While the transition is on screen some browsers (Chrome) hit-test every click to
  // <html> instead of the page underneath, so a second press on the toggle would be lost.
  // Catch presses over the toggle there; where the click does reach the button, its own
  // handler reverses the ink and this one ignores it.
  const onPress = (event: MouseEvent) => {
    if (event.target !== root) return;
    const toggles = new Set<Element>(doc.querySelectorAll(`[${TOGGLE_ATTRIBUTE}]`));
    if (trigger) toggles.add(trigger);
    for (const el of toggles) {
      const box = el.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) {
        run.reverse();
        return;
      }
    }
  };
  doc.addEventListener('click', onPress, true);

  transition.ready
    .then(() => {
      const ink = root.animate(splatKeyframes(splats, origin, win.innerWidth, win.innerHeight), {
        duration,
        easing: 'linear', // the spread curve is baked into the keyframes
        fill: 'both',
        pseudoElement: '::view-transition-new(root)',
      });
      // Landed. Pulled all the way back, the old snapshot is showing in full, so switching
      // the live page back now ends the transition without a visible change.
      ink.onfinish = () => {
        settled = true;
        if (reversed) restore();
      };
      animation = ink;
      if (reversed) reverseAnimation(ink);
    })
    .catch(() => {
      // No animation could run (the transition was skipped): end where the presses asked.
      settled = true;
      if (reversed) restore();
    });

  transition.updateCallbackDone.catch(() => undefined);

  (run as { finished: Promise<void> }).finished = transition.finished
    .catch(() => undefined)
    .then(() => {
      settled = true;
      doc.removeEventListener('click', onPress, true);
      if (runs.get(doc) !== run) return; // superseded by a newer run, which owns the page now
      runs.delete(doc);
      root.classList.remove(CLASS_NAMES.transition);
      // The transition can be cut short (tab hidden, another transition) without the
      // animation finishing: make sure the page ends on the theme the presses asked for.
      const wanted = reversed ? from : to;
      if (read() !== wanted) switchInstantly(root, reversed ? revert : commit);
    });

  return run;
}
