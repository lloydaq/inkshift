import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { isTheme } from '../core/theme';
import type { Theme, ThemePreference, ThemeState, TransitionOrigin } from '../core/types';
import { InkshiftContext } from './context';

export interface UseThemeResult extends ThemeState {
  /** Choose `light`, `dark` or `system`, animating from `origin` when the theme changes. */
  setTheme: (theme: ThemePreference, origin?: TransitionOrigin) => void;
  /** Switch to the other theme. Called again mid-transition, the ink reverses. */
  toggleTheme: (origin?: TransitionOrigin) => void;
}

const noopSubscribe = () => () => {};
const cache = new Map<string, ThemeState>();

/**
 * State before the controller exists. The server snapshot (`fromDom` false) must be the
 * same on the server and during hydration; afterwards the DOM, set by the init script, is
 * the better guess until the provider mounts.
 */
function placeholder(defaultTheme: ThemePreference, fromDom: boolean): ThemeState {
  let resolved: Theme = defaultTheme === 'light' ? 'light' : 'dark';
  if (fromDom && typeof document !== 'undefined') {
    // On the client the init script has usually set the real theme already.
    const value = document.documentElement.getAttribute('data-theme');
    if (isTheme(value)) resolved = value;
  }
  const key = `${defaultTheme}:${resolved}`;
  let state = cache.get(key);
  if (!state) {
    state = { theme: defaultTheme, resolvedTheme: resolved, systemTheme: resolved, isTransitioning: false };
    cache.set(key, state);
  }
  return state;
}

/** The theme, and functions to change it. Must be used inside `<ThemeProvider>`. */
export function useTheme(): UseThemeResult {
  const context = useContext(InkshiftContext);
  if (!context) throw new Error('inkshift: useTheme() must be used inside <ThemeProvider>.');
  const { controller, defaultTheme } = context;

  const state = useSyncExternalStore(
    controller ? controller.subscribe : noopSubscribe,
    controller ? controller.getState : () => placeholder(defaultTheme, true),
    () => placeholder(defaultTheme, false),
  );

  const setTheme = useCallback(
    (theme: ThemePreference, origin?: TransitionOrigin) => controller?.setTheme(theme, origin),
    [controller],
  );
  const toggleTheme = useCallback((origin?: TransitionOrigin) => controller?.toggleTheme(origin), [controller]);

  return useMemo(() => ({ ...state, setTheme, toggleTheme }), [state, setTheme, toggleTheme]);
}
