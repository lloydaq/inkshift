import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createThemeController } from '../core/themeController';
import type { ThemeController, ThemeControllerOptions } from '../core/types';
import { InkshiftContext, type InkshiftContextValue } from './context';

export interface ThemeProviderProps extends ThemeControllerOptions {
  children?: ReactNode;
}

/**
 * Owns one theme controller for the app. All `useTheme()` calls and `<ThemeToggle>`s
 * below it share it, so the theme lives in one place: the attribute on `<html>`.
 *
 * Options that define where the theme lives (`storageKey`, `attribute`, `target`,
 * `defaultTheme`, `persist`, `followSystem`) are read when the provider mounts; changing
 * them creates a new controller. Animation options and callbacks can change at any time.
 */
export function ThemeProvider({ children, ...options }: ThemeProviderProps) {
  const [controller, setController] = useState<ThemeController | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const { storageKey, attribute, target, defaultTheme, persist, followSystem } = options;
  useEffect(() => {
    const created = createThemeController({ ...latest.current });
    setController(created);
    return () => {
      created.destroy();
      setController((current) => (current === created ? null : current));
    };
  }, [storageKey, attribute, target, defaultTheme, persist, followSystem]);

  // Runtime options follow the latest props without recreating the controller.
  const { animation, respectReducedMotion, themeColor, onThemeChange, onTransitionStart, onTransitionEnd } = options;
  useEffect(() => {
    controller?.configure({ animation, respectReducedMotion, themeColor, onThemeChange, onTransitionStart, onTransitionEnd });
  }, [controller, animation, respectReducedMotion, themeColor, onThemeChange, onTransitionStart, onTransitionEnd]);

  const value = useMemo<InkshiftContextValue>(
    () => ({ controller, defaultTheme: defaultTheme ?? 'system' }),
    [controller, defaultTheme],
  );
  return <InkshiftContext.Provider value={value}>{children}</InkshiftContext.Provider>;
}
