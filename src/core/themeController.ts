import { CLASS_NAMES, FADE_DURATION_MS, INK_DURATION_MS, crossFade, resolveOrigin, switchInstantly } from './animation';
import { supportsInkTransition } from './browserSupport';
import { inkSplat } from './inkSplat';
import {
  DEFAULT_ATTRIBUTE,
  DEFAULT_STORAGE_KEY,
  DEFAULT_THEME_COLOR,
  isPreference,
  otherTheme,
  prefersReducedMotion,
  readTheme,
  systemTheme,
  systemThemeQuery,
  writeTheme,
  type ThemeTarget,
} from './theme';
import { activeInkRun, startInkRun, type InkRun } from './themeSwitch';
import type {
  AnimationType,
  RuntimeOptions,
  Theme,
  ThemeController,
  ThemeControllerOptions,
  ThemePreference,
  ThemeState,
  TransitionInfo,
  TransitionOrigin,
} from './types';

/**
 * Creates the theme controller: the framework-independent core of Inkshift.
 *
 * ```ts
 * const theme = createThemeController({ storageKey: 'my-app-theme' });
 * button.addEventListener('click', (event) => theme.toggleTheme(event));
 * ```
 *
 * Use one controller per document. Call `destroy()` when you no longer need it.
 */
interface InkEnds {
  prev: ThemePreference;
  next: ThemePreference;
  /** Raw stored value before the run; `undefined` means "store `prev` normally". */
  prevStored: string | null | undefined;
}

type ActiveRun = InkRun & { ends: InkEnds };

export function createThemeController(options: ThemeControllerOptions = {}): ThemeController {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('inkshift: createThemeController() needs a browser document. Create it on the client.');
  }
  const doc = document;
  const root = doc.documentElement;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const defaultTheme: ThemePreference = isPreference(options.defaultTheme) ? options.defaultTheme : 'system';
  const persist = options.persist ?? true;
  const followSystem = options.followSystem ?? true;
  const target: ThemeTarget = {
    element: options.target ?? root,
    attribute: options.attribute ?? DEFAULT_ATTRIBUTE,
    themeColor: options.themeColor === undefined ? DEFAULT_THEME_COLOR : options.themeColor,
  };
  let runtime: RuntimeOptions = {};
  /** Seed of the next splat; each ink run uses two. */
  let seed = options.animation?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const configure = (next: RuntimeOptions) => {
    const nextSeed = next.animation?.seed;
    if (nextSeed !== undefined && nextSeed !== runtime.animation?.seed) seed = nextSeed;
    runtime = { ...runtime, ...next };
    if ('themeColor' in next) target.themeColor = next.themeColor === undefined ? DEFAULT_THEME_COLOR : next.themeColor;
  };
  configure(options);

  // ---- Preference and storage ----

  const readStored = (): ThemePreference | null => {
    if (!persist) return null;
    try {
      const value = window.localStorage.getItem(storageKey);
      return isPreference(value) ? value : null;
    } catch {
      return null;
    }
  };

  const store = (preference: ThemePreference) => {
    if (!persist) return;
    try {
      // `system` is the absence of an explicit choice, unless the app defaults to a fixed
      // theme: then it has to be stored to survive a reload.
      if (preference === 'system' && defaultTheme === 'system') window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, preference);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  };

  const readStoredRaw = (): string | null | undefined => {
    if (!persist) return undefined;
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return undefined;
    }
  };

  const writeStoredRaw = (value: string | null) => {
    try {
      if (value === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, value);
    } catch {
      // Storage unavailable.
    }
  };

  let preference: ThemePreference = readStored() ?? defaultTheme;
  let system: Theme = systemTheme();
  const resolve = (pref: ThemePreference): Theme => (pref === 'system' ? system : pref);
  const read = (): Theme => readTheme(target) ?? resolve(preference);

  // ---- State and subscribers ----

  const listeners = new Set<() => void>();
  let transitioning = false;
  let state: ThemeState = { theme: preference, resolvedTheme: resolve(preference), systemTheme: system, isTransitioning: false };

  const emit = () => {
    const next: ThemeState = { theme: preference, resolvedTheme: read(), systemTheme: system, isTransitioning: transitioning };
    if (
      next.theme === state.theme &&
      next.resolvedTheme === state.resolvedTheme &&
      next.systemTheme === state.systemTheme &&
      next.isTransitioning === state.isTransitioning
    ) {
      return;
    }
    const themeChanged = next.theme !== state.theme || next.resolvedTheme !== state.resolvedTheme;
    state = next;
    if (themeChanged) runtime.onThemeChange?.(state);
    for (const listener of [...listeners]) listener();
  };

  /** Puts `pref` into effect: preference, storage, attribute. No animation. */
  const apply = (pref: ThemePreference, theme: Theme = resolve(pref)) => {
    preference = pref;
    store(pref);
    writeTheme(target, theme);
    emit();
  };

  // The init script normally set the attribute already; make sure it matches.
  if (readTheme(target) !== resolve(preference)) writeTheme(target, resolve(preference));
  state = { ...state, resolvedTheme: read() };

  // ---- Transitions ----

  /** The ink run this controller started and that is still moving. */
  let run: ActiveRun | null = null;

  const animationType = (): AnimationType => {
    let type = runtime.animation?.type ?? 'ink';
    if ((runtime.respectReducedMotion ?? true) && prefersReducedMotion()) type = 'instant';
    if (type === 'ink' && !supportsInkTransition(doc)) type = 'fade';
    return type;
  };

  const setTransitioning = (value: boolean) => {
    transitioning = value;
    emit();
  };

  let fades = 0;

  const transition = (pref: ThemePreference, origin: TransitionOrigin | undefined) => {
    const from = read();
    const to = resolve(pref);
    const type = animationType();
    const info: TransitionInfo = { from, to, type };

    if (type === 'instant') {
      switchInstantly(root, () => apply(pref, to));
      return;
    }

    if (type === 'fade') {
      runtime.onTransitionStart?.(info);
      fades++;
      setTransitioning(true);
      void crossFade(root, runtime.animation?.duration ?? FADE_DURATION_MS, () => apply(pref, to)).then(() => {
        if (--fades > 0) return;
        setTransitioning(false);
        runtime.onTransitionEnd?.({ ...info, to: read(), theme: read(), reversed: false });
      });
      return;
    }

    // What to restore if the ink is pressed back: the preference and the stored value
    // exactly as they were. `setTheme` during the run can retarget either end.
    const ends: InkEnds = { prev: preference, next: pref, prevStored: readStoredRaw() };
    const { point, trigger } = resolveOrigin(origin, window);
    const splats: [ReturnType<typeof inkSplat>, ReturnType<typeof inkSplat>] = [inkSplat(seed++), inkSplat(seed++)];
    runtime.onTransitionStart?.(info);
    const ink: ActiveRun = Object.assign(
      startInkRun({
        doc,
        from,
        to,
        origin: point,
        trigger,
        splats,
        duration: runtime.animation?.duration ?? INK_DURATION_MS,
        commit: () => apply(ends.next, to),
        revert: () => {
          apply(ends.prev, from);
          if (ends.prevStored !== undefined) writeStoredRaw(ends.prevStored);
        },
        read,
        // A press over a toggle that the browser delivered to <html>: same as pressing it.
        onPress: (event) => toggleTheme(event),
      }),
      { ends },
    );
    if (ink.settled) {
      // The browser refused to start a transition; the theme was switched at once.
      runtime.onTransitionEnd?.({ ...info, theme: read(), reversed: false });
      return;
    }
    run = ink;
    setTransitioning(true);
    void ink.finished.then(() => {
      if (run === ink) run = null;
      if (!activeInkRun(doc)) setTransitioning(false);
      runtime.onTransitionEnd?.({ ...info, theme: read(), reversed: ink.reversed });
      // The system theme may have changed while the ink was moving.
      if (preference === 'system' && read() !== system && !activeInkRun(doc)) switchInstantly(root, () => apply('system'));
    });
  };

  /** The ink is now heading back to a new choice: store that rather than the old value. */
  const retargetPrev = (ink: ActiveRun, pref: ThemePreference) => {
    ink.ends.prev = pref;
    ink.ends.prevStored = undefined;
  };

  /** The run that a press should act on: one still moving, from this controller. */
  const moving = () => (run && !run.settled && activeInkRun(doc) === run ? run : null);

  const setTheme = (pref: ThemePreference, origin?: TransitionOrigin) => {
    if (!isPreference(pref)) return;
    const ink = moving();
    if (ink) {
      const to = resolve(pref);
      const heading = ink.reversed ? ink.from : ink.to;
      if (to !== heading) {
        // Asked for the theme the ink is leaving: turn it around.
        if (ink.reversed) ink.ends.next = pref;
        else retargetPrev(ink, pref);
        ink.reverse();
      } else if (ink.reversed) {
        retargetPrev(ink, pref);
      } else {
        ink.ends.next = pref;
        if (read() === ink.to) {
          preference = pref;
          store(pref);
          emit();
        }
      }
      return;
    }
    if (resolve(pref) === read()) {
      // Nothing to animate: only the preference changes.
      apply(pref);
      return;
    }
    transition(pref, origin);
  };

  const toggleTheme = (origin?: TransitionOrigin) => {
    const ink = moving();
    if (ink) {
      ink.reverse();
      return;
    }
    transition(otherTheme(read()), origin);
  };

  // ---- Listeners ----

  const observer = new MutationObserver(() => emit());
  observer.observe(target.element, { attributes: true, attributeFilter: [target.attribute === 'class' ? 'class' : target.attribute] });

  const media = systemThemeQuery();
  const onSystemChange = () => {
    system = systemTheme();
    if (followSystem && preference === 'system' && !moving() && read() !== system) {
      switchInstantly(root, () => apply('system'));
    } else {
      emit();
    }
  };
  media?.addEventListener?.('change', onSystemChange);

  // Another tab chose a theme.
  const onStorage = (event: StorageEvent) => {
    if (!persist || event.key !== storageKey) return;
    const next = isPreference(event.newValue) ? event.newValue : defaultTheme;
    if (moving()) return;
    switchInstantly(root, () => {
      preference = next;
      writeTheme(target, resolve(next));
      emit();
    });
  };
  window.addEventListener('storage', onStorage);

  let destroyed = false;

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setTheme,
    toggleTheme,
    configure,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      media?.removeEventListener?.('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
      listeners.clear();
      root.classList.remove(CLASS_NAMES.fade);
    },
  };
}
