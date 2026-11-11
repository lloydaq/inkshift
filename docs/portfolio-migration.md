# Migrating lloyd-portfolio to Inkshift

A plan for replacing the portfolio's own theme switch with the package, as a separate and reversible change. **Do not start until Inkshift's checks pass** and the package is installable, either from npm or as a tarball.

## What the portfolio has today

| File | Role | Replaced by |
| --- | --- | --- |
| `src/components/inkSplat.ts` (+ test) | Splat geometry | `inkshift` (identical output, parity-tested) |
| `src/components/themeSwitch.ts` | Ink run, reversal, fade | `createThemeController` |
| `src/components/theme.ts` | Storage, `useTheme`, `applyTheme` | `inkshift/react` `useTheme` |
| `Header.tsx` system-theme effect and `toggleTheme` | System following, origin | The controller (`followSystem`) and `ThemeToggle` |
| `global.css` "Theme switch" block | VT, switching and fade rules | `inkshift/transitions.css` |
| Inline script in each of the 5 HTML pages | First paint | `createInitScript({ storageKey: 'theme', defaultTheme: 'system' })` |

## Settings that keep behaviour identical

The portfolio stores its choice under `theme`, so keep that key; existing visitors keep their stored choice.

```tsx
<ThemeProvider storageKey="theme" defaultTheme="system" themeColor={{ light: '#f2eee6', dark: '#16161a' }}>
```

Leave `animation` at its defaults: 1100 ms ink, 450 ms fade.

Remaining differences, all deliberate:

- **Reversal storage.** Pressing back restores exactly what was stored before. The portfolio re-stored the old theme explicitly, so a visitor following the system now keeps following it.
- **Class names.** `inkshift-transition`, `inkshift-switching` and `inkshift-fade` replace `ink-transition`, `theme-switching` and `theme-fade`.
- **The two original edge-case bugs are fixed:** the frame-long flash on an immediate reversal, and a lost press after the ink lands.

## Steps

1. **Branch.** Work on `inkshift-migration` in lloyd-portfolio.
2. **Install.** `npm install inkshift`.
3. **Header.**
   - Wrap each page root (`main-*.tsx`) in `<ThemeProvider storageKey="theme">`. Do this once per page entry, or once in a shared `Page` wrapper.
   - In `Header.tsx`, replace the theme button with `<ThemeToggle className="icon-button theme-toggle" />`. Keep the portfolio's classes so its icon-button sizing applies.
   - Delete the system-theme `useEffect` and the `toggleTheme` handler.
   - The portfolio's icon CSS keys off `:root[data-theme='light'] .theme-toggle [data-icon=…]`. Either keep its own `Sun`/`Moon` icons as children (`<ThemeToggle …><Moon /><Sun /></ThemeToggle>`), so the existing CSS keeps working unchanged, or drop that CSS and use the package's icons. Keeping the children is the zero-visual-change option.
4. **Other `useTheme` imports.** Re-point them from `./theme` to `inkshift/react`, for example `ThemedShot`. The portfolio's `useTheme()` returns the theme string, so `const theme = useTheme()` becomes `const { resolvedTheme: theme } = useTheme()`.
5. **CSS.** `import 'inkshift/transitions.css'` in `global.css` (not `tokens.css`: the portfolio has its own palette). Delete the portfolio's "Theme switch" block. Keep its `@media (prefers-reduced-motion: reduce)` block; it is site-wide, not theme-specific.
6. **HTML.** In `vite.config.ts`, inject `createInitScript({ storageKey: 'theme' })` with `transformIndexHtml`, the way Inkshift's demo does, and remove the five copies of the inline script.
7. **Delete** `inkSplat.ts`, `inkSplat.test.ts`, `themeSwitch.ts` and `theme.ts`.
8. **E2E selectors.** Update `tests/e2e/site.spec.ts`: `/ink-transition/` becomes `/inkshift-transition/`, and `/ink-transition|theme-fade/` becomes `/inkshift-/`. The test's `localStorage.getItem('theme')` stays valid.

## Verify parity

- `npm run check` in the portfolio. Typecheck, lint, unit tests, the build, and the Playwright suite across Chromium, Firefox, WebKit and mobile must all pass. The existing e2e tests already cover:
  - persistence across pages and `theme-color`;
  - two layers at 1100 ms;
  - press-back keeps the theme;
  - three quick presses;
  - reduced motion;
  - first-visit system theme;
  - axe in both themes.
- Compare screenshots before and after: `scripts/screenshots.mjs` in both themes on every page. Expect no differences.
- Check by hand: a toggle from the header at desktop and mobile width, the mobile menu open, and a case-study page with themed screenshots, so the image-decode wait still applies.

## Rollback

The migration is one branch, ideally one squash-merged pull request. To roll back, `git revert <merge commit>`: the deleted files return and the dependency is removed. Visitors' stored `theme` values stay compatible in both directions, because the key and values are unchanged.
