# API

## `inkshift`

### `createThemeController(options?): ThemeController`

Creates the framework-independent controller. Needs a browser `document`; on the server, create it on the client only. Use one controller per document.

On creation it reads the stored preference (or `defaultTheme`) and makes sure the theme attribute agrees with it. Usually the [init script](#createinitscriptoptions-string) has already set it, so nothing changes.

```ts
interface ThemeController {
  getState(): ThemeState;
  subscribe(listener: () => void): () => void;
  setTheme(theme: 'light' | 'dark' | 'system', origin?: TransitionOrigin): void;
  toggleTheme(origin?: TransitionOrigin): void;
  configure(options: RuntimeOptions): void;
  destroy(): void;
}

interface ThemeState {
  theme: 'light' | 'dark' | 'system'; // the preference
  resolvedTheme: 'light' | 'dark';     // what the page shows (read from the attribute)
  systemTheme: 'light' | 'dark';       // the operating system's theme
  isTransitioning: boolean;
}
```

- `getState()` returns the same object until something changes. That makes it safe for `useSyncExternalStore` and cheap to compare.
- `toggleTheme(origin)` switches to the other theme. **While the ink is still moving, it reverses the ink instead**, however many times it is called.
- `setTheme(theme, origin)`:
  - Animates only when the theme in effect changes; otherwise it updates the preference.
  - While the ink is moving, asking for the theme the ink is leaving reverses it, and asking for the theme it is heading to does nothing visible.
  - `system` removes the stored choice. If `defaultTheme` is a fixed theme, it stores `system` explicitly instead, so a reload keeps following the system.
- `configure()` changes `animation`, `respectReducedMotion`, `themeColor` and the callbacks on a live controller.
- `destroy()` removes the `matchMedia`, `storage` and `MutationObserver` listeners. A transition already running is allowed to finish.

#### `TransitionOrigin`

```ts
type TransitionOrigin =
  | { x: number; y: number }   // viewport CSS pixels (clientX / clientY space)
  | Element                    // its centre
  | { clientX: number; clientY: number; detail: number; currentTarget: EventTarget | null }; // a DOM or React click event
```

For an event, `detail === 0` (a keyboard-activated click) uses the centre of `currentTarget`. Omitted, the ink starts at the centre of the viewport.

#### Options

| Option | Type | Default |
| --- | --- | --- |
| `storageKey` | `string` | `'inkshift-theme'` |
| `defaultTheme` | `'light' \| 'dark' \| 'system'` | `'system'` |
| `attribute` | `string` (`'class'` for class names) | `'data-theme'` |
| `target` | `HTMLElement` | `document.documentElement` |
| `themeColor` | `{ light: string; dark: string } \| false` | `{ light: '#f2eee6', dark: '#16161a' }` |
| `persist` | `boolean` | `true` |
| `followSystem` | `boolean` | `true` |
| `respectReducedMotion` | `boolean` | `true` |
| `animation` | `{ type?: 'ink' \| 'fade' \| 'instant'; duration?: number; seed?: number; fluidity?: number }` | `{ type: 'ink', duration: 1100, fluidity: 0 }` |
| `onThemeChange` | `(state: ThemeState) => void` | |
| `onTransitionStart` | `(info: { from, to, type }) => void` | |
| `onTransitionEnd` | `(info: { from, to, type, theme, reversed }) => void` | |

`animation.fluidity` (0–1, default 0) turns the ink smoky; it only affects `ink`. Values outside the range are clamped.

`type` in the transition callbacks is the animation that actually ran, after feature detection. `onTransitionEnd` fires once the transition is fully cleaned up; `reversed` is true when the ink was pressed back.

Instant switches (reduced motion, `type: 'instant'`) call `onThemeChange` but not the transition callbacks.

### `createInitScript(options?): string`

Returns the source of the first-paint script. It takes `storageKey`, `defaultTheme`, `attribute` and `themeColor`, with the same defaults as the controller. The output is self-contained ES5, and option values are escaped so they cannot close the surrounding `<script>` element.

### `initTheme(config)`

The function `createInitScript` serialises. Exposed for completeness; prefer `createInitScript`.

### `inkSplat(seed, fluidity?): { url: string; minRadius: number }`

One splat from the generator. With `fluidity` above 0 (0–1), the same splat warped and blurred into smoke, as the transition uses it.

For the crisp splat, `url` is a `url("data:image/svg+xml,…")` value ready for `mask-image`, on a 200 × 200 viewBox centred on 0,0. Useful for decoration that matches the transition (the demo's hero drop uses it).

### `supportsInkTransition()`, `supportsViewTransitions()`, `prefersReducedMotion()`

The feature checks Inkshift itself uses.

## `inkshift/react`

### `<ThemeProvider {...options}>`

Accepts every controller option as a prop. It creates the controller after mounting (so it is safe in server rendering and StrictMode) and destroys it on unmount.

- `storageKey`, `attribute`, `target`, `defaultTheme`, `persist` and `followSystem` define where the theme lives; changing one creates a new controller.
- `animation`, `respectReducedMotion`, `themeColor` and the callbacks can change at any time. Memoise `animation` if you build it inline in a component that re-renders often; that avoids needless `configure` calls, though they are cheap.

### `useTheme()`

```ts
const { theme, resolvedTheme, systemTheme, isTransitioning, setTheme, toggleTheme } = useTheme();
```

Re-renders only when the state changes. `setTheme` and `toggleTheme` are stable. Before the provider has mounted, and during server rendering and hydration, it reports `defaultTheme`; after mounting it reports the real state. It throws if used outside `<ThemeProvider>`.

### `<ThemeToggle />`

A `<button type="button">` that calls `toggleTheme(event)`.

- **Label:** `aria-label` names the action, "Switch to light theme" or "Switch to dark theme". Override it with `labels={{ light: '…', dark: '…' }}` (keyed by the theme the button switches *to*) or with your own `aria-label`.
- **Icons:** shows a moon in the dark theme and a sun in the light one, so shape rather than colour carries the state. The icons are `aria-hidden`.
- **Props:** accepts button props, `className` (added to `inkshift-toggle`) and `ref`. Children replace the icons.
- **Opting out:** `event.preventDefault()` in your `onClick` skips the toggle.
- Carries `data-inkshift-toggle` and `data-theme-current`.

### `<ThemeScript {...initOptions} nonce? />`

Renders the init script for the document `<head>`.

## `data-inkshift-toggle`

Some browsers hit-test every click to `<html>` while a View Transition is on screen, so a second press on a toggle would never reach it. During a transition, Inkshift treats a press over any element with `data-inkshift-toggle` (or the element that started the transition) as a press on the toggle. Add the attribute to custom toggle buttons.
