# Browser support

Inkshift detects capabilities at the moment of each switch; it never looks at the browser's name.

## What runs where

| Capabilities detected | Result |
| --- | --- |
| `document.startViewTransition`, Web Animations with `pseudoElement`, and multi-layer CSS masks | The ink bleed |
| Any of those missing | A colour cross-fade (`background-color`, `border-color`, `color`, `fill`, `stroke`, `box-shadow`) |
| `prefers-reduced-motion: reduce` (with `respectReducedMotion`, the default) | An instant switch |
| `animation.type: 'fade'` or `'instant'` | That, regardless of support |

The checks are exported as `supportsInkTransition()` and `supportsViewTransitions()`. Engine support for same-document View Transitions changes release by release: check [MDN](https://developer.mozilla.org/docs/Web/API/View_Transition_API) or caniuse for the browsers you target. Inkshift does not need to be updated as engines add support.

## What is tested

- **Unit tests (jsdom)** cover the controller, the ink run and reversal. They use doubles for View Transitions and Web Animations that model the parts the reversal logic depends on, including the auto-rewind rule of `Animation.reverse()`.
- **Browser tests (Playwright)** run the built package and the demo in **Chromium**, at desktop and Pixel 7 sizes, with real View Transitions. They check:
  - the two-layer mask, the 1100 ms duration and the origin at the pointer;
  - no early flash of the new theme;
  - mid-spread reversal and rapid presses;
  - keyboard origin;
  - reduced motion;
  - the cross-fade with View Transitions removed;
  - a transition skipped mid-reversal.

Firefox and WebKit are not run in CI yet. The fallbacks are written to the specifications, but treat other engines as untested until they are added.

## Failure modes handled

| Situation | Behaviour |
| --- | --- |
| `localStorage` throws or is missing | The theme works for the page; nothing is stored |
| `matchMedia` is missing | System theme counts as dark; no live following |
| `startViewTransition` throws | The theme switches instantly |
| The transition is skipped (tab hidden, another transition starts) | The page is set to the theme the presses asked for |
| An image in view fails to decode | Ignored; the wait is capped at 250 ms anyway |
| Presses arrive faster than the ink | One transition; the last press decides the theme |
| A press lands after the ink settles but before the transition is torn down | Starts a fresh transition; the press is not lost |
| No `<meta name="theme-color">` | Nothing to update; no error |

## Requirements

- **Package format:** ES modules, ES2020 syntax. There is no CommonJS build: Inkshift is browser-only, and every current bundler and framework consumes ESM.
- **First-paint script:** ES5, so it runs anywhere.
- **Node:** 18+, for tooling and server rendering of the React components.
