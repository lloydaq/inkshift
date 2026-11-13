export { createThemeController } from './core/themeController';
export { createInitScript, initTheme, type InitScriptOptions } from './core/init';
export { fluidSplat as inkSplat } from './core/fluid';
export type { Splat } from './core/inkSplat';
export { supportsInkTransition, supportsViewTransitions } from './core/browserSupport';
export { prefersReducedMotion } from './core/theme';
export type {
  AnimationOptions,
  AnimationType,
  OriginEvent,
  Point,
  RuntimeOptions,
  Theme,
  ThemeColors,
  ThemeController,
  ThemeControllerOptions,
  ThemePreference,
  ThemeState,
  TransitionEndInfo,
  TransitionInfo,
  TransitionOrigin,
} from './core/types';
