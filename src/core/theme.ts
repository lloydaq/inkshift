import type { Theme, ThemeColors, ThemePreference } from './types';

/**
 * Reading and writing the theme. The attribute on the target element (by default
 * `<html data-theme>`) is the single source of truth for the theme in effect: the inline
 * init script sets it before first paint, `writeTheme` changes it, and everything else
 * reads it back rather than keeping a copy.
 */

export const DEFAULT_STORAGE_KEY = 'inkshift-theme';
export const DEFAULT_ATTRIBUTE = 'data-theme';
export const DEFAULT_THEME_COLOR: ThemeColors = { light: '#f2eee6', dark: '#16161a' };

export interface ThemeTarget {
  element: HTMLElement;
  attribute: string;
  themeColor: ThemeColors | false;
}

export const otherTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

export const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export const isPreference = (value: unknown): value is ThemePreference => isTheme(value) || value === 'system';

/** The explicit choice in storage, or null when there is none (or storage is unavailable). */
export function readStoredTheme(key: string): Theme | null {
  try {
    const value = window.localStorage.getItem(key);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/** Stores an explicit choice; `system` removes it. Storage failures are ignored. */
export function writeStoredTheme(key: string, preference: ThemePreference): void {
  try {
    if (preference === 'system') window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, preference);
  } catch {
    // Storage unavailable (private mode, quota, sandboxed iframe): the choice lasts for this page only.
  }
}

function query(media: string): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(media) : null;
  } catch {
    return null;
  }
}

export const systemThemeQuery = () => query('(prefers-color-scheme: light)');

/** The operating-system theme; dark when it cannot be read. */
export function systemTheme(): Theme {
  return systemThemeQuery()?.matches ? 'light' : 'dark';
}

export function prefersReducedMotion(): boolean {
  return query('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? systemTheme() : preference;
}

/** The theme in effect, read from the target. */
export function readTheme({ element, attribute }: ThemeTarget): Theme | null {
  if (attribute === 'class') {
    if (element.classList.contains('dark')) return 'dark';
    if (element.classList.contains('light')) return 'light';
    return null;
  }
  const value = element.getAttribute(attribute);
  return isTheme(value) ? value : null;
}

/** Puts `theme` into effect: the attribute and `<meta name="theme-color">`. */
export function writeTheme({ element, attribute, themeColor }: ThemeTarget, theme: Theme): void {
  if (attribute === 'class') {
    element.classList.remove(otherTheme(theme));
    element.classList.add(theme);
  } else {
    element.setAttribute(attribute, theme);
  }
  if (themeColor) {
    element.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[theme]);
  }
}
