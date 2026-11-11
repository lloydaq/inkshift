import { describe, expect, it, vi } from 'vitest';
import { createInitScript, createThemeController } from '../src';
import { installMatchMedia, mediaListenerCount, setSystemTheme } from './helpers/browser';

const root = () => document.documentElement;
const meta = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');
// No View Transitions in these tests and animation 'instant', so changes apply synchronously.
const controller = (options: Parameters<typeof createThemeController>[0] = {}) =>
  createThemeController({ animation: { type: 'instant' }, ...options });

describe('initial theme', () => {
  it('follows the system when nothing is stored', () => {
    installMatchMedia({ light: true });
    const theme = controller();
    expect(root().dataset.theme).toBe('light');
    expect(theme.getState()).toMatchObject({ theme: 'system', resolvedTheme: 'light', systemTheme: 'light' });
    theme.destroy();
  });

  it('uses a stored explicit choice over the system', () => {
    installMatchMedia({ light: true });
    localStorage.setItem('inkshift-theme', 'dark');
    const theme = controller();
    expect(root().dataset.theme).toBe('dark');
    expect(theme.getState().theme).toBe('dark');
    theme.destroy();
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('inkshift-theme', 'purple');
    const theme = controller({ defaultTheme: 'light' });
    expect(theme.getState().theme).toBe('light');
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });

  it('survives storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const theme = controller({ defaultTheme: 'dark' });
    expect(theme.getState().resolvedTheme).toBe('dark');
    theme.setTheme('light');
    expect(root().dataset.theme).toBe('light');
    expect(spy).toHaveBeenCalled();
    theme.destroy();
  });

  it('works without matchMedia (dark)', () => {
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    const theme = controller();
    expect(theme.getState().resolvedTheme).toBe('dark');
    theme.toggleTheme();
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });

  it('corrects a hard-coded attribute that disagrees with the stored choice', () => {
    root().dataset.theme = 'dark';
    localStorage.setItem('inkshift-theme', 'light');
    const theme = controller();
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });

  it('uses a custom storage key', () => {
    localStorage.setItem('my-app-theme', 'light');
    localStorage.setItem('inkshift-theme', 'dark');
    const theme = controller({ storageKey: 'my-app-theme' });
    expect(root().dataset.theme).toBe('light');
    theme.setTheme('dark');
    expect(localStorage.getItem('my-app-theme')).toBe('dark');
    theme.destroy();
  });

  it('throws a clear error without a document', async () => {
    const { createThemeController: create } = await import('../src/core/themeController');
    const doc = globalThis.document;
    // @ts-expect-error simulate a server
    delete globalThis.document;
    try {
      expect(() => create()).toThrow(/needs a browser document/);
    } finally {
      globalThis.document = doc;
    }
  });
});

describe('setTheme', () => {
  it('applies and stores light and dark', () => {
    const theme = controller();
    theme.setTheme('light');
    expect(root().dataset.theme).toBe('light');
    expect(localStorage.getItem('inkshift-theme')).toBe('light');
    expect(meta()).toBe('#f2eee6');
    theme.setTheme('dark');
    expect(root().dataset.theme).toBe('dark');
    expect(localStorage.getItem('inkshift-theme')).toBe('dark');
    expect(meta()).toBe('#16161a');
    theme.destroy();
  });

  it('system removes the explicit choice and follows the OS', () => {
    installMatchMedia({ light: true });
    const theme = controller();
    theme.setTheme('dark');
    expect(localStorage.getItem('inkshift-theme')).toBe('dark');
    theme.setTheme('system');
    expect(localStorage.getItem('inkshift-theme')).toBeNull();
    expect(theme.getState()).toMatchObject({ theme: 'system', resolvedTheme: 'light' });
    theme.destroy();
  });

  it('stores system explicitly when the app defaults to a fixed theme', () => {
    installMatchMedia({ light: true });
    const theme = controller({ defaultTheme: 'dark' });
    expect(theme.getState().resolvedTheme).toBe('dark');
    theme.setTheme('system');
    expect(localStorage.getItem('inkshift-theme')).toBe('system');
    theme.destroy();
    // A reload keeps following the system rather than falling back to dark.
    const reloaded = controller({ defaultTheme: 'dark' });
    expect(reloaded.getState()).toMatchObject({ theme: 'system', resolvedTheme: 'light' });
    reloaded.destroy();
  });

  it('ignores unknown values', () => {
    const theme = controller({ defaultTheme: 'dark' });
    theme.setTheme('blue' as never);
    expect(root().dataset.theme).toBe('dark');
    theme.destroy();
  });

  it('does not persist when persist is false', () => {
    const theme = controller({ persist: false });
    theme.setTheme('light');
    expect(localStorage.getItem('inkshift-theme')).toBeNull();
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });

  it('leaves the theme-color meta alone when themeColor is false, and uses custom colours', () => {
    const plain = controller({ themeColor: false });
    plain.setTheme('light');
    expect(meta()).toBe('#000000');
    plain.destroy();
    const custom = controller({ themeColor: { light: '#ffffff', dark: '#000011' } });
    custom.setTheme('dark');
    expect(meta()).toBe('#000011');
    custom.destroy();
  });

  it('works without a theme-color meta tag', () => {
    document.head.innerHTML = '';
    const theme = controller();
    expect(() => theme.setTheme('light')).not.toThrow();
    theme.destroy();
  });
});

describe('selectors', () => {
  it('supports a custom attribute', () => {
    const theme = controller({ attribute: 'data-mode', defaultTheme: 'light' });
    expect(root().getAttribute('data-mode')).toBe('light');
    expect(root().hasAttribute('data-theme')).toBe(false);
    theme.toggleTheme();
    expect(root().getAttribute('data-mode')).toBe('dark');
    theme.destroy();
  });

  it('supports class names', () => {
    const theme = controller({ attribute: 'class', defaultTheme: 'dark' });
    expect(root().classList.contains('dark')).toBe(true);
    theme.toggleTheme();
    expect(root().classList.contains('light')).toBe(true);
    expect(root().classList.contains('dark')).toBe(false);
    theme.destroy();
  });

  it('supports another target element', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const theme = controller({ target: el, defaultTheme: 'light' });
    expect(el.dataset.theme).toBe('light');
    expect(root().dataset.theme).toBeUndefined();
    theme.destroy();
  });
});

describe('system theme changes', () => {
  it('follows the OS while the preference is system', () => {
    const theme = controller();
    expect(theme.getState().resolvedTheme).toBe('dark');
    setSystemTheme('light');
    expect(root().dataset.theme).toBe('light');
    expect(theme.getState()).toMatchObject({ resolvedTheme: 'light', systemTheme: 'light' });
    theme.destroy();
  });

  it('keeps an explicit choice but still reports the OS theme', () => {
    const theme = controller();
    theme.setTheme('dark');
    setSystemTheme('light');
    expect(root().dataset.theme).toBe('dark');
    expect(theme.getState().systemTheme).toBe('light');
    theme.destroy();
  });

  it('does not follow when followSystem is false', () => {
    const theme = controller({ followSystem: false });
    setSystemTheme('light');
    expect(root().dataset.theme).toBe('dark');
    theme.destroy();
  });

  it('removes its listeners on destroy', () => {
    const theme = controller();
    expect(mediaListenerCount()).toBe(1);
    theme.destroy();
    expect(mediaListenerCount()).toBe(0);
    setSystemTheme('light');
    expect(root().dataset.theme).toBe('dark');
  });
});

describe('state and subscribers', () => {
  it('notifies on change, keeps the same snapshot otherwise, and calls onThemeChange', () => {
    const onThemeChange = vi.fn();
    const theme = controller({ onThemeChange });
    const listener = vi.fn();
    theme.subscribe(listener);
    const before = theme.getState();
    expect(theme.getState()).toBe(before);
    theme.setTheme('light');
    expect(listener).toHaveBeenCalled();
    expect(theme.getState()).not.toBe(before);
    expect(onThemeChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'light', resolvedTheme: 'light' }));
    theme.destroy();
  });

  it('treats the attribute as the source of truth when something else changes it', async () => {
    const theme = controller({ defaultTheme: 'dark' });
    root().setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0)); // MutationObserver
    expect(theme.getState().resolvedTheme).toBe('light');
    theme.destroy();
  });

  it('syncs a choice made in another tab', () => {
    const theme = controller();
    localStorage.setItem('inkshift-theme', 'light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'inkshift-theme', newValue: 'light' }));
    expect(root().dataset.theme).toBe('light');
    expect(theme.getState().theme).toBe('light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'dark' }));
    expect(root().dataset.theme).toBe('light');
    theme.destroy();
  });
});

describe('createInitScript', () => {
  const run = (script: string) => new Function(script)();

  it('applies the stored theme and theme-color before any app code', () => {
    localStorage.setItem('inkshift-theme', 'light');
    run(createInitScript());
    expect(root().dataset.theme).toBe('light');
    expect(meta()).toBe('#f2eee6');
  });

  it('falls back to the system theme, and to the default for invalid values', () => {
    installMatchMedia({ light: true });
    run(createInitScript());
    expect(root().dataset.theme).toBe('light');
    localStorage.setItem('k', 'nope');
    run(createInitScript({ storageKey: 'k', defaultTheme: 'dark' }));
    expect(root().dataset.theme).toBe('dark');
  });

  it('agrees with the controller', () => {
    installMatchMedia({ light: true });
    for (const stored of [null, 'light', 'dark', 'system', 'junk']) {
      for (const defaultTheme of ['light', 'dark', 'system'] as const) {
        localStorage.clear();
        if (stored) localStorage.setItem('inkshift-theme', stored);
        root().removeAttribute('data-theme');
        run(createInitScript({ defaultTheme }));
        const fromScript = root().dataset.theme;
        const theme = controller({ defaultTheme });
        expect(theme.getState().resolvedTheme).toBe(fromScript);
        theme.destroy();
      }
    }
  });

  it('survives storage errors and missing matchMedia', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    expect(() => run(createInitScript())).not.toThrow();
    expect(root().dataset.theme).toBe('dark');
  });

  it('supports class names and custom attributes', () => {
    localStorage.setItem('inkshift-theme', 'light');
    run(createInitScript({ attribute: 'class' }));
    expect(root().classList.contains('light')).toBe(true);
    run(createInitScript({ attribute: 'data-mode' }));
    expect(root().getAttribute('data-mode')).toBe('light');
  });

  it('cannot break out of its script element', () => {
    const script = createInitScript({ storageKey: '</script><script>alert(1)</script>' });
    expect(script).not.toContain('</script>');
    expect(() => run(script)).not.toThrow();
  });
});
