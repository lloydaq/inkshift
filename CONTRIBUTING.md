# Contributing

Thanks for helping. Issues and pull requests are welcome.

## Setup

```bash
npm install
npm run dev          # the demo, running the library from source, at http://localhost:5173
```

Browser tests use Playwright with Chromium. The first time, install the browser:

```bash
npx playwright install chromium
```

## Checks

```bash
npm run typecheck
npm run lint
npm test             # unit tests (Vitest, jsdom)
npm run build        # library (dist/) and demo (demo/dist/)
npm run test:browser # Chromium: the built package and the demo
npm run size         # bundle size table (after build)
npm run check        # all of the above except size
```

## Ground rules

- **The splat geometry is pinned.** `tests/inkSplat.test.ts` asserts a fingerprint of the generator's output. If you change the shape on purpose, update the fingerprint in the same commit and say why.
- **Reversal is a feature, not a nicety.** Changes to `themeSwitch.ts` or `themeController.ts` need tests in `tests/reversal.test.ts`, and a browser test when the behaviour depends on real View Transitions.
- **Don't relax a test to make it pass.** If a browser test is timing-sensitive, assert the invariant rather than a timing.
- **No runtime dependencies.**
- **Accessibility and reduced motion are required behaviour.**

## Trying a local build in another project

```bash
npm run build:lib
npm pack                       # inkshift-<version>.tgz
cd ../your-app
npm install ../inkshift/inkshift-<version>.tgz
```

## Releasing

See [docs/publishing.md](docs/publishing.md).
