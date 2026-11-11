# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-11

First version, extracted from the theme switch of
[lloydaq/lloyd-portfolio](https://github.com/lloydaq/lloyd-portfolio).

### Added

- `createThemeController`: light, dark and system preferences on a single `data-theme`
  attribute, with persistence, system and cross-tab sync, and the ink-bleed transition.
- The original splat generator and two-layer spreading keyframes, unchanged and covered by a parity test.
- Reversal: a second press during the ink turns the same animation around and restores the
  previous theme, preference and stored value.
- Fallbacks: colour cross-fade without View Transitions, instant switching with reduced motion.
- `createInitScript` for first-paint theme application.
- `inkshift/react`: `ThemeProvider`, `useTheme`, `ThemeToggle`, `ThemeScript`.
- `inkshift/styles.css`, `inkshift/tokens.css`, `inkshift/transitions.css`.

### Fixed (relative to the original implementation)

- Reversing before the ink had moved no longer flashes the new theme for a frame.
- A transition skipped mid-reversal (for example when the tab is hidden) still ends on the original theme.
- A press that lands after the ink settles, but before the transition is torn down, is no longer lost.

[Unreleased]: https://github.com/lloydaq/inkshift/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lloydaq/inkshift/releases/tag/v0.1.0
