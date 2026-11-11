import { supportsInkTransition, supportsViewTransitions } from 'inkshift';
import { useEffect, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { Section } from './Section';
import { Check, Cross } from './icons';

const TOKENS = `/* Optional: the default palette. Override any token. */
@import 'inkshift/tokens.css';

:root {
  --inkshift-background: #fdfcf9;
  --inkshift-foreground: #1d1d1f;
}

:root[data-theme='dark'] {
  --inkshift-background: #0f1115;
  --inkshift-foreground: #e9e6df;
}

body {
  background: var(--inkshift-background);
  color: var(--inkshift-foreground);
}`;

const CUSTOM_TOGGLE = `const { toggleTheme } = useTheme();

<button onClick={(event) => toggleTheme(event)}>
  Toggle theme
</button>`;

const PALETTE = [
  ['background', '#f2eee6', '#16161a'],
  ['surface', '#fbf9f4', '#1e1e23'],
  ['foreground', '#1b1b1f', '#ede6da'],
  ['muted', '#57524a', '#a39e94'],
  ['border', '#d5cfc3', '#33333a'],
  ['accent', '#8f5b0e', '#e0a84f'],
];

export function Customize() {
  return (
    <Section
      id="customize"
      title="Your colours, not ours."
      intro={
        <p>
          The ink reveals whatever your page looks like in its new theme, so the palette is entirely yours. Inkshift ships a
          warm paper and charcoal palette as optional CSS custom properties with zero specificity: any rule you write wins.
        </p>
      }
    >
      <table className="palette">
        <caption className="field__label">Default tokens</caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Light</th>
            <th scope="col">Dark</th>
          </tr>
        </thead>
        <tbody>
          {PALETTE.map(([name, light, dark]) => (
            <tr key={name}>
              <th scope="row">
                <code>--inkshift-{name}</code>
              </th>
              <td>
                <span className="chip" style={{ background: light }} />
                {light}
              </td>
              <td>
                <span className="chip" style={{ background: dark }} />
                {dark}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CodeBlock label="styles.css" code={TOKENS} />
      <CodeBlock label="CustomToggle.tsx" code={CUSTOM_TOGGLE} />
    </Section>
  );
}

const INIT = `<!-- In <head>, before your stylesheets: sets data-theme before first paint -->
<script>
  /* paste the output of createInitScript({ storageKey: 'my-app-theme' }) */
</script>`;

export function Install() {
  return (
    <Section
      id="install"
      title="Install."
      intro={
        <p>
          One package, no runtime dependencies. React is an optional peer: the core works with any framework or none. Add the
          inline script so the right theme is on the page before anything paints.
        </p>
      }
    >
      <CodeBlock label="Terminal" code="npm install inkshift" />
      <CodeBlock label="index.html" code={INIT} />
      <CodeBlock
        label="main.ts"
        code={`import { createThemeController } from 'inkshift';
import 'inkshift/styles.css';

const theme = createThemeController({ storageKey: 'my-app-theme' });

toggle.addEventListener('click', (event) => theme.toggleTheme(event));
theme.setTheme('system');`}
      />
    </Section>
  );
}

export function ReactUsage() {
  return (
    <Section
      id="react"
      title="With React."
      intro={
        <p>
          A provider owns one controller; every <code>useTheme()</code> reads the same state. The animation runs outside
          React’s render cycle, so a switch costs a single render.
        </p>
      }
    >
      <CodeBlock
        label="App.tsx"
        code={`import { ThemeProvider, ThemeToggle, useTheme } from 'inkshift/react';
import 'inkshift/styles.css';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="my-app-theme">
      <ThemeToggle />
      <Status />
    </ThemeProvider>
  );
}

function Status() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <button onClick={(event) => setTheme('system', event)}>
      Follow the system ({theme}, showing {resolvedTheme})
    </button>
  );
}`}
      />
    </Section>
  );
}

function useSupport() {
  const [support, setSupport] = useState<{ vt: boolean; ink: boolean; reduced: boolean } | null>(null);
  useEffect(() => {
    setSupport({
      vt: supportsViewTransitions(),
      ink: supportsInkTransition(),
      reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    });
  }, []);
  return support;
}

export function Support() {
  const support = useSupport();
  const verdict = !support
    ? 'Checking this browser…'
    : support.reduced
      ? 'You prefer reduced motion, so this browser switches instantly.'
      : support.ink
        ? 'This browser runs the full ink bleed.'
        : 'This browser gets the colour cross-fade.';
  return (
    <Section
      id="support"
      title="Every browser gets a theme switch."
      intro={
        <p>
          Inkshift detects features rather than browser names. The ink needs the View Transitions API, Web Animations on
          pseudo-elements, and CSS masks. Without them the colours cross-fade; with reduced motion the switch is instant. No
          path leaves the page between themes.
        </p>
      }
    >
      <p className="verdict" aria-live="polite">
        {verdict}
      </p>
      <table className="support">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Needed for</th>
            <th scope="col">Here</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['View Transitions API', 'Whole-page snapshots', support?.vt],
            ['Pseudo-element animation + masks', 'The ink mask', support?.ink],
          ].map(([name, use, ok]) => (
            <tr key={String(name)}>
              <th scope="row">{name}</th>
              <td>{use}</td>
              <td className={ok ? 'yes' : 'no'}>
                {ok === undefined ? '…' : ok ? <><Check /> Yes</> : <><Cross /> No</>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        The table above is measured live in the browser you are using. Engine support changes release by release; the
        library only ever trusts what it detects.
      </p>
    </Section>
  );
}
