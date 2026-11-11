# Customization

## Your own palette

The ink reveals whatever the page looks like in its new theme, so Inkshift needs nothing from your colours. Style the theme attribute however you like:

```css
:root {
  --bg: #ffffff;
  --text: #111111;
  color-scheme: light;
}

:root[data-theme='dark'] {
  --bg: #0b0b0c;
  --text: #ededed;
  color-scheme: dark;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

Set `color-scheme` per theme so form controls and scrollbars follow it. The background must be painted on `html` or `body`, not left transparent, or the snapshots show the browser's default canvas.

## The bundled tokens

`inkshift/tokens.css` (included in `inkshift/styles.css`) defines a warm paper and deep charcoal palette:

| Token | Light | Dark |
| --- | --- | --- |
| `--inkshift-background` | `#f2eee6` | `#16161a` |
| `--inkshift-surface` | `#fbf9f4` | `#1e1e23` |
| `--inkshift-foreground` | `#1b1b1f` | `#ede6da` |
| `--inkshift-muted` | `#57524a` | `#a39e94` |
| `--inkshift-border` | `#d5cfc3` | `#33333a` |
| `--inkshift-border-strong` | `#a9a397` | `#4d4d55` |
| `--inkshift-accent` | `#8f5b0e` | `#e0a84f` |
| `--inkshift-focus` | `#8f5b0e` | `#e0a84f` |

- **Overriding:** every rule is wrapped in `:where()`, so it has zero specificity and any selector of yours wins.
- **Before JavaScript runs:** with no `data-theme` set, the tokens follow `prefers-color-scheme`.
- **Applying them:** the tokens only define variables; nothing is applied to your page:

```css
body {
  background: var(--inkshift-background);
  color: var(--inkshift-foreground);
}
```

To skip them entirely, import only `inkshift/transitions.css`.

## Class names instead of an attribute

```ts
createThemeController({ attribute: 'class' }); // <html class="dark">
createInitScript({ attribute: 'class' });
```

Tailwind's `darkMode: 'class'` (v3) or `@custom-variant dark (&:where(.dark, .dark *))` (v4) then works as usual. The bundled tokens key off `[data-theme]`, so with classes, define your own.

## Styling the toggle

`.inkshift-toggle` has zero-specificity base styles: a 44 × 44 px round button with a 1px border and a visible focus ring. Restyle it with a class:

```tsx
<ThemeToggle className="my-toggle" />
```

```css
.my-toggle {
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 8px;
}
```

The icon swap keys off `data-theme-current` on the button. To replace the icons, pass children:

```tsx
<ThemeToggle>
  <MyIcon />
</ThemeToggle>
```

## A toggle of your own

```tsx
const { resolvedTheme, toggleTheme } = useTheme();

<button
  type="button"
  data-inkshift-toggle
  aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
  onClick={(event) => toggleTheme(event)}
>
  …
</button>
```

- **Origin:** passing the event gives the right origin for both pointer and keyboard presses.
- **`data-inkshift-toggle`:** keeps reversal working in browsers that send clicks to `<html>` during the transition.

## Animation

```tsx
<ThemeProvider animation={{ type: 'ink', duration: 1400, seed: 42 }} />
```

- **`duration`:** stretches the same spread curve; the shape of the motion stays the same.
- **`seed`:** fixes the splats. Each ink run uses two consecutive seeds, so a sequence of switches is reproducible too.
- **`type: 'fade'`:** uses the cross-fade everywhere.
- **`type: 'instant'`:** switches with no animation.

The fade's duration is exposed to CSS as `--inkshift-fade-duration` while it runs.

## Named view transitions on your page

The ink animates the `root` snapshot. Elements with their own `view-transition-name` get their own snapshot groups, which run the browser's default cross-fade and are not covered by the ink mask. Remove the name while Inkshift switches if you want the ink to cover them:

```css
:root.inkshift-transition .has-a-name {
  view-transition-name: none;
}
```
