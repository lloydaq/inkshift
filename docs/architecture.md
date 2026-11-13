# Architecture

```
src/
├── core/                 framework-independent
│   ├── types.ts          public types
│   ├── inkSplat.ts       splat geometry and spread keyframes (unchanged from the original)
│   ├── fluid.ts          optional smoke: filtered splats, baking to bitmaps, drift and pacing
│   ├── animation.ts      origin resolution, instant switch, cross-fade, image wait, reverseAnimation
│   ├── themeSwitch.ts    one ink run: view transition, splat animation, reversal, click catcher
│   ├── themeController.ts preferences, storage, system/tab sync, routing presses to runs
│   ├── theme.ts          reading and writing the attribute, storage and media queries
│   ├── browserSupport.ts feature detection
│   └── init.ts           first-paint script
├── react/                ThemeProvider, useTheme, ThemeToggle, ThemeScript
└── styles/               tokens.css (optional palette), transitions.css (required rules)
```

`inkshift` and `inkshift/react` are separate entry points that share one core chunk. Importing both never duplicates the controller.

## Single source of truth

The theme in effect lives in one place: the attribute on the target element (`<html data-theme>` by default).

- The init script sets it before first paint.
- The controller writes it.
- Everything else reads it back, including the controller's own `resolvedTheme`.

A `MutationObserver` keeps subscribers in sync if something else changes it. The preference (`light`, `dark` or `system`) lives in the controller and in storage.

React holds no theme state of its own. `useTheme` subscribes to the controller with `useSyncExternalStore`; the provider only owns the controller's lifetime.

## The ink run

`startInkRun` in `themeSwitch.ts` is ported directly from the portfolio's `switchTheme`:

1. **Start.**
   - Add `inkshift-transition` to `<html>`. The CSS then stops the browser's default view-transition animation and hides the new snapshot behind an empty mask until the splat animation starts.
   - Call `document.startViewTransition`. Inside the update callback, with `inkshift-switching` turning CSS transitions off: apply the new theme, wait one task so frameworks can re-render, and wait up to 250 ms for images in view to decode.
   - The original removed `inkshift-switching` immediately after applying the theme. Inkshift keeps it through the whole update, so components a framework re-renders for the new theme are captured in their final state rather than mid-transition.
2. **Animate.** On `ready`, animate `mask-image`, `mask-size` and `mask-position` on `::view-transition-new(root)`. There are 33 keyframes with linear easing, because the spread curve is baked into them:
   - `soak(t) = 0.45t + 0.55(1 − (1 − t)^2.4)` for the first layer, and `soak(t)^1.35` for the trailing second layer;
   - each layer ends 6% past the size at which its innermost edge reaches 4 px beyond the farthest viewport corner.
3. **Reverse.** A second press calls `reverse()` on that same animation, so it turns around where it stands.
4. **Land.**
   - Run forwards to the end, the new snapshot covers the screen and the transition ends.
   - Run back to the start, the old snapshot is showing in full. The live page is switched back to the old theme with transitions off, and the transition ends without a visible change.
5. **Clean up.** When `finished` settles: remove the click catcher and the class, and make sure the page shows the theme the presses asked for.

There is at most one run per document, held in a `WeakMap<Document, InkRun>`. A press while a run is moving reverses it; a press after it has landed starts a new one, and the browser skips the old transition.

## Fluidity

`animation.fluidity` (0–1) is an optional layer on top of the ink, in `fluid.ts`. At 0 none of it runs, and `splatKeyframes` output is byte-identical to the original (the parity test covers this).

- **Shape.** `fluidSplat` wraps the original path and droplets in an SVG filter: `feTurbulence` → `feDisplacementMap` (wisps) → `feGaussianBlur` (soft edge), inside a larger viewBox so the soft edge is never clipped.
- **Baking.** Animating that SVG directly makes the browser re-run the filter on a multi-thousand-pixel mask every frame; measured in Chromium, that stalled for over a second. So each splat is drawn once to a 1024 px canvas and used as a PNG mask, which the compositor only scales. `startInkRun` waits for the pair alongside `transition.ready`; the new snapshot stays hidden behind its empty mask meanwhile. If baking fails or takes longer than 400 ms, the run uses the crisp splats for the same seeds.
- **Coverage.** A soft edge means the solid part of the mask is smaller than the visible shape. The solid radius is measured from the baked pixels (alpha ≥ 252). The analytic worst-case bound would make the mask about twice as large again and send the visible front off-screen in the first fifth of the duration.
- **Motion.** `fluidFlow` gives each layer a seeded curl away from the press point, scaled by `sin(πt)` so it is zero at both ends: the transition still starts at the press and ends centred, so the coverage maths is unchanged. The spread curve is raised to the power `1 + fluidity`, because a soft front runs ahead of the solid core.
- **Reversal** is untouched: it is the same single animation.

## Behaviours preserved from the original

- The splat algorithm, byte for byte: 240 samples, the eight waves, the tendrils and droplets, the Catmull-Rom smoothing, `minRadius − 1.5` slack. A SHA-256 fingerprint of 50 splats plus a keyframe set, taken from the original source, is asserted in `tests/inkSplat.test.ts`.
- Two layers, the 33-step keyframes, `+4 px` reach, `×1.06` headroom, the soak curve, 1100 ms linear, `fill: both`.
- The click origin, and the centre of the toggle for keyboard (`detail === 0`) presses.
- Reversal in place, the old-snapshot handoff, and the capture-phase catcher for clicks hit-tested to `<html>`.
- The 450 ms cross-fade fallback, and instant switching with reduced motion.

## Changes from the original, and why

| Change | Reason |
| --- | --- |
| `reverseAnimation()` instead of a bare `reverse()` | `Animation.reverse()` auto-rewinds. On an animation still at time 0 (pressed back before the ink moved), it jumps to the *end*, showing the new theme in full for a frame. Such an animation now finishes backwards. |
| Reconciliation when the transition finishes | A transition skipped mid-reversal (for example when the tab is hidden) cancels the animation, so `onfinish` never runs. The page now ends on the theme the presses asked for. |
| The catcher routes through the controller's toggle | After the ink lands, the transition stays on screen for a frame or two and clicks still go to `<html>`. The original ignored such a press because the run was finished, so rapid presses could end on the wrong theme: 13 of 20 runs in a Chromium stress test, before the fix. |
| Reversal restores the previous preference *and* stored value | Toggling then pressing back is a net no-op: a visitor who was following the system keeps following it. |
| `inkshift-switching` held through the whole update callback | Framework re-renders are captured without transitions in flight. |
| Generic `data-inkshift-toggle` for the catcher | Works for any number of toggles, not one known button. |
| The finished animation is cancelled at cleanup | `fill: both` kept every finished splat animation, and the mask images in its keyframes, registered on the document after the transition. |

## Performance

- **Rendering:** the animation runs on the compositor (WAAPI on a pseudo-element), entirely outside React. A switch costs one React render of `useTheme` consumers, and splats are generated once per transition (two SVG strings).
- **Listeners:** one capture `click` listener exists only while a transition is on screen. Each controller holds one `matchMedia` listener, one `storage` listener and one `MutationObserver`, all removed by `destroy()`.
- **Timers:** only the bounded ones: the single zero-delay task, the 250 ms image-wait cap (cleared on resolve), and the cross-fade timer (restarted, never stacked).
