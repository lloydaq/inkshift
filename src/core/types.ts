/** A concrete colour theme: what the page is showing. */
export type Theme = 'light' | 'dark';

/** What the visitor asked for. `system` follows `prefers-color-scheme`. */
export type ThemePreference = Theme | 'system';

/** A position in viewport CSS pixels (the space of `clientX` / `clientY`). */
export interface Point {
  x: number;
  y: number;
}

/**
 * The minimal shape of a DOM or React mouse event that Inkshift reads. Passing the
 * click event itself is the recommended way to start a transition: a pointer press
 * bleeds from the pointer, a keyboard press (`detail === 0`) from the centre of
 * `currentTarget`.
 */
export interface OriginEvent {
  clientX: number;
  clientY: number;
  detail: number;
  currentTarget: EventTarget | null;
}

/**
 * Where the ink starts:
 * - a `{ x, y }` point in viewport CSS pixels;
 * - an element (its centre);
 * - the click event (pointer position, or the centre of the control for keyboard presses).
 *
 * Omitted, the ink starts at the centre of the viewport.
 */
export type TransitionOrigin = Point | Element | OriginEvent;

/**
 * - `ink`: the organic ink bleed (View Transitions), falling back to `fade` where the
 *   browser cannot run it.
 * - `fade`: a short colour cross-fade.
 * - `instant`: no animation.
 */
export type AnimationType = 'ink' | 'fade' | 'instant';

export interface AnimationOptions {
  /** Default `ink`. */
  type?: AnimationType;
  /** Milliseconds. Default 1100 for `ink`, 450 for `fade`. */
  duration?: number;
  /**
   * Seed for the first splat pair; each transition uses the next two seeds. Fix it for
   * reproducible demos and tests. Default: random.
   */
  seed?: number;
}

export interface TransitionInfo {
  /** Theme before the change. */
  from: Theme;
  /** Theme the change is heading to. */
  to: Theme;
  /** The animation that actually runs, after feature detection and reduced motion. */
  type: AnimationType;
}

export interface TransitionEndInfo extends TransitionInfo {
  /** The theme in effect once the transition is over. */
  theme: Theme;
  /** True when the ink was pressed back and the original theme restored. */
  reversed: boolean;
}

export interface ThemeColors {
  light: string;
  dark: string;
}

export interface ThemeControllerOptions {
  /** localStorage key for an explicit choice. Default `inkshift-theme`. */
  storageKey?: string;
  /** Preference used when nothing is stored. Default `system`. */
  defaultTheme?: ThemePreference;
  /**
   * Attribute on the target element that holds the theme. Default `data-theme`.
   * Pass `class` to toggle `light` / `dark` class names instead.
   */
  attribute?: string;
  /** Element that carries the theme. Default `document.documentElement`. */
  target?: HTMLElement;
  /**
   * Values written to `<meta name="theme-color">` (if present) for each theme.
   * `false` leaves the tag alone. Default `{ light: '#f2eee6', dark: '#16161a' }`.
   */
  themeColor?: ThemeColors | false;
  /** Store explicit choices in localStorage. Default `true`. */
  persist?: boolean;
  /** Follow operating-system theme changes while the preference is `system`. Default `true`. */
  followSystem?: boolean;
  /**
   * Honour `prefers-reduced-motion: reduce` by switching instantly. Default `true`.
   * Turn off only if your app offers its own motion setting.
   */
  respectReducedMotion?: boolean;
  animation?: AnimationOptions;
  /** Called whenever the theme in effect or the preference changes. */
  onThemeChange?: (state: ThemeState) => void;
  /** Called when an animated transition starts. */
  onTransitionStart?: (info: TransitionInfo) => void;
  /** Called when an animated transition has fully finished and been cleaned up. */
  onTransitionEnd?: (info: TransitionEndInfo) => void;
}

export interface ThemeState {
  /** The preference: `light`, `dark` or `system`. */
  theme: ThemePreference;
  /** The theme in effect (read from the target's attribute, the single source of truth). */
  resolvedTheme: Theme;
  /** The operating-system theme. */
  systemTheme: Theme;
  /** True while an animated transition is on screen. */
  isTransitioning: boolean;
}

/** Options that can be changed on a live controller. */
export type RuntimeOptions = Pick<
  ThemeControllerOptions,
  'animation' | 'respectReducedMotion' | 'themeColor' | 'onThemeChange' | 'onTransitionStart' | 'onTransitionEnd'
>;

export interface ThemeController {
  /** Current state. The same object is returned until something changes. */
  getState(): ThemeState;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /**
   * Choose a preference. When the theme in effect changes it is animated from `origin`.
   * During an ink transition, asking for the theme the ink started from reverses it.
   */
  setTheme(theme: ThemePreference, origin?: TransitionOrigin): void;
  /**
   * Switch to the other theme, bleeding ink from `origin`. Pressed again while the ink
   * is still spreading, the ink pulls back and the original theme is restored.
   */
  toggleTheme(origin?: TransitionOrigin): void;
  /** Update animation and callback options. */
  configure(options: RuntimeOptions): void;
  /** Remove listeners. The current transition, if any, is allowed to finish. */
  destroy(): void;
}
