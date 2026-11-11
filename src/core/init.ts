import { DEFAULT_ATTRIBUTE, DEFAULT_STORAGE_KEY, DEFAULT_THEME_COLOR } from './theme';
import type { ThemeColors, ThemePreference } from './types';

export interface InitScriptOptions {
  /** Same as the controller's `storageKey`. Default `inkshift-theme`. */
  storageKey?: string;
  /** Same as the controller's `defaultTheme`. Default `system`. */
  defaultTheme?: ThemePreference;
  /** Same as the controller's `attribute`. Default `data-theme`. */
  attribute?: string;
  /** Same as the controller's `themeColor`. Default `{ light: '#f2eee6', dark: '#16161a' }`. */
  themeColor?: ThemeColors | false;
}

interface InitConfig {
  k: string;
  d: ThemePreference;
  a: string;
  c: ThemeColors | false;
}

/**
 * Applies the stored (or system) theme to `<html>`. Written in plain ES5 with no outside
 * references: it is serialised into the inline script by `createInitScript`.
 */
export function initTheme(c: InitConfig): void {
  var p: string | null = null;
  try {
    p = window.localStorage.getItem(c.k);
  } catch (e) {
    p = null;
  }
  if (p !== 'light' && p !== 'dark' && p !== 'system') p = c.d;
  var t = p;
  if (t === 'system') {
    t = 'dark';
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) t = 'light';
    } catch (e) {
      t = 'dark';
    }
  }
  var el = document.documentElement;
  if (c.a === 'class') {
    el.classList.remove(t === 'light' ? 'dark' : 'light');
    el.classList.add(t);
  } else {
    el.setAttribute(c.a, t);
  }
  if (c.c) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? c.c.light : c.c.dark);
  }
}

/**
 * Source for a small inline `<script>` that sets the theme before first paint, so the
 * page never flashes the wrong theme. Place it in `<head>`, before your stylesheets.
 * Use the same options as the controller.
 */
export function createInitScript(options: InitScriptOptions = {}): string {
  const config: InitConfig = {
    k: options.storageKey ?? DEFAULT_STORAGE_KEY,
    d: options.defaultTheme ?? 'system',
    a: options.attribute ?? DEFAULT_ATTRIBUTE,
    c: options.themeColor === undefined ? DEFAULT_THEME_COLOR : options.themeColor,
  };
  // Escape `<` so no option value can close the surrounding <script> element.
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `(${initTheme.toString()})(${json})`;
}
