import { act, render, screen } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, ThemeScript, ThemeToggle, useTheme } from '../src/react';
import { flush, installViewTransitions, mediaListenerCount, setSystemTheme, settle, transitions } from './helpers/browser';

const root = () => document.documentElement;

function Readout() {
  const { theme, resolvedTheme, systemTheme, isTransitioning } = useTheme();
  return <output data-testid="readout">{`${theme}|${resolvedTheme}|${systemTheme}|${isTransitioning}`}</output>;
}

function Controls() {
  const { setTheme } = useTheme();
  return (
    <>
      <button onClick={(e) => setTheme('light', e)}>Light</button>
      <button onClick={(e) => setTheme('dark', e)}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </>
  );
}

const readout = () => screen.getByTestId('readout').textContent;

describe('ThemeProvider + useTheme', () => {
  it('exposes theme state and setters', async () => {
    render(
      <ThemeProvider animation={{ type: 'instant' }}>
        <Readout />
        <Controls />
      </ThemeProvider>,
    );
    expect(readout()).toBe('system|dark|dark|false');
    await act(async () => screen.getByText('Light').click());
    expect(readout()).toBe('light|light|dark|false');
    expect(root().dataset.theme).toBe('light');
    expect(localStorage.getItem('inkshift-theme')).toBe('light');
    await act(async () => screen.getByText('System').click());
    expect(readout()).toBe('system|dark|dark|false');
    expect(localStorage.getItem('inkshift-theme')).toBeNull();
  });

  it('follows system changes', async () => {
    render(
      <ThemeProvider>
        <Readout />
      </ThemeProvider>,
    );
    await act(async () => setSystemTheme('light'));
    expect(readout()).toBe('system|light|light|false');
  });

  it('reports isTransitioning during the ink', async () => {
    installViewTransitions();
    render(
      <ThemeProvider defaultTheme="dark">
        <Readout />
        <ThemeToggle />
      </ThemeProvider>,
    );
    await act(async () => screen.getByRole('button').click());
    expect(readout()).toBe('light|light|dark|true');
    await act(settle);
    expect(readout()).toBe('light|light|dark|false');
  });

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Readout />)).toThrow(/inside <ThemeProvider>/);
  });

  it('shares one controller between all consumers and re-renders only on change', async () => {
    let renders = 0;
    function Counter() {
      useTheme();
      renders++;
      return null;
    }
    const { rerender } = render(
      <ThemeProvider animation={{ type: 'instant' }}>
        <Counter />
        <Controls />
      </ThemeProvider>,
    );
    const afterMount = renders;
    await act(async () => screen.getByText('Dark').click()); // already dark: preference only
    const afterPreference = renders;
    expect(afterPreference - afterMount).toBe(1);
    await act(async () => screen.getByText('Dark').click()); // nothing changes at all
    expect(renders).toBe(afterPreference);
    rerender(
      <ThemeProvider animation={{ type: 'instant' }}>
        <Counter />
        <Controls />
      </ThemeProvider>,
    );
    expect(renders).toBe(afterPreference + 1); // parent re-render only
    expect(mediaListenerCount()).toBe(1);
  });

  it('works in StrictMode and cleans up on unmount', async () => {
    const { unmount } = render(
      <StrictMode>
        <ThemeProvider animation={{ type: 'instant' }}>
          <Readout />
          <ThemeToggle />
        </ThemeProvider>
      </StrictMode>,
    );
    expect(mediaListenerCount()).toBe(1);
    await act(async () => screen.getByRole('button').click());
    expect(readout()).toBe('light|light|dark|false');
    unmount();
    expect(mediaListenerCount()).toBe(0);
  });

  it('applies new animation options without recreating the controller', async () => {
    installViewTransitions();
    const { rerender } = render(
      <ThemeProvider defaultTheme="dark" animation={{ type: 'instant' }}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await act(async () => screen.getByRole('button').click());
    expect(transitions).toHaveLength(0);
    rerender(
      <ThemeProvider defaultTheme="dark" animation={{ type: 'ink', duration: 800 }}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await act(async () => screen.getByRole('button').click());
    expect(transitions).toHaveLength(1);
    await act(settle);
  });

  it('recreates the controller when the storage key changes', async () => {
    localStorage.setItem('a', 'light');
    localStorage.setItem('b', 'dark');
    const { rerender } = render(
      <ThemeProvider storageKey="a">
        <Readout />
      </ThemeProvider>,
    );
    expect(readout()).toBe('light|light|dark|false');
    rerender(
      <ThemeProvider storageKey="b">
        <Readout />
      </ThemeProvider>,
    );
    await act(flush);
    expect(readout()).toBe('dark|dark|dark|false');
    expect(mediaListenerCount()).toBe(1);
  });

  it('calls lifecycle callbacks from props', async () => {
    installViewTransitions();
    const onThemeChange = vi.fn();
    const onTransitionStart = vi.fn();
    const onTransitionEnd = vi.fn();
    render(
      <ThemeProvider defaultTheme="dark" {...{ onThemeChange, onTransitionStart, onTransitionEnd }}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await act(async () => screen.getByRole('button').click());
    await act(settle);
    expect(onTransitionStart).toHaveBeenCalledTimes(1);
    expect(onTransitionEnd).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light', reversed: false }));
    expect(onThemeChange).toHaveBeenCalledWith(expect.objectContaining({ resolvedTheme: 'light' }));
  });

  it('a custom button can pass its click event as the origin', async () => {
    installViewTransitions();
    function Custom() {
      const { toggleTheme } = useTheme();
      return <button onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })}>Custom</button>;
    }
    render(
      <ThemeProvider defaultTheme="dark">
        <Custom />
      </ThemeProvider>,
    );
    await act(async () => screen.getByText('Custom').click());
    await act(settle);
    expect(root().dataset.theme).toBe('light');
  });
});

describe('server rendering', () => {
  it('renders on the server without touching the DOM', () => {
    const html = renderToString(
      <ThemeProvider defaultTheme="light">
        <Readout />
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(html).toContain('light|light|light|false');
    expect(html).toContain('aria-label="Switch to dark theme"');
  });

  it('ThemeScript renders the init script', () => {
    const html = renderToString(<ThemeScript storageKey="k" nonce="abc" />);
    expect(html).toContain('<script nonce="abc">');
    expect(html).toContain('"k":"k"');
  });
});

describe('ThemeToggle', () => {
  it('forwards refs, merges class names and passes extra props', () => {
    function WithRef() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <ThemeToggle ref={ref} className="mine" id="t" title="Theme" />
          <button onClick={() => ref.current?.setAttribute('data-ref', 'ok')}>probe</button>
        </>
      );
    }
    render(
      <ThemeProvider>
        <WithRef />
      </ThemeProvider>,
    );
    const toggle = document.getElementById('t')!;
    expect(toggle.className).toBe('inkshift-toggle mine');
    expect(toggle.getAttribute('title')).toBe('Theme');
    screen.getByText('probe').click();
    expect(toggle.getAttribute('data-ref')).toBe('ok');
  });

  it('skips the toggle when onClick calls preventDefault', async () => {
    render(
      <ThemeProvider defaultTheme="dark" animation={{ type: 'instant' }}>
        <ThemeToggle onClick={(e) => e.preventDefault()} />
      </ThemeProvider>,
    );
    await act(async () => screen.getByRole('button').click());
    expect(root().dataset.theme).toBe('dark');
  });

  it('accepts custom children', () => {
    render(
      <ThemeProvider>
        <ThemeToggle>
          <span>Mode</span>
        </ThemeToggle>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button').textContent).toBe('Mode');
  });
});
