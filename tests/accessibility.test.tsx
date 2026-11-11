import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, ThemeToggle } from '../src/react';
import { flush, inkAnimation, installViewTransitions, setReducedMotion, settle, transitions } from './helpers/browser';

const root = () => document.documentElement;

const app = (props: Parameters<typeof ThemeProvider>[0] = {}) =>
  render(
    <ThemeProvider defaultTheme="dark" {...props}>
      <a href="#before">before</a>
      <ThemeToggle />
      <a href="#after">after</a>
    </ThemeProvider>,
  );

describe('ThemeToggle accessibility', () => {
  it('is a real button with a label that names the action', async () => {
    app({ animation: { type: 'instant' } });
    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    await act(async () => button.click());
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBe(button);
  });

  it('accepts custom labels (e.g. translations)', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle labels={{ light: 'Helles Design', dark: 'Dunkles Design' }} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Helles Design' })).toBeTruthy();
  });

  it('hides its icons from assistive technology and shows state by shape, not colour', () => {
    app();
    const button = screen.getByRole('button');
    const icons = button.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
    }
    expect([...icons].map((i) => i.dataset.inkshiftIcon)).toEqual(['moon', 'sun']);
    expect(button.dataset.themeCurrent).toBe('dark');
  });

  it('is reachable with Tab, activates with Enter and Space, and does not trap focus', async () => {
    const user = userEvent.setup();
    app({ animation: { type: 'instant' } });
    await user.tab();
    expect(document.activeElement?.textContent).toBe('before');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));
    await user.keyboard('{Enter}');
    expect(root().dataset.theme).toBe('light');
    await user.keyboard(' ');
    expect(root().dataset.theme).toBe('dark');
    await user.tab();
    expect(document.activeElement?.textContent).toBe('after');
  });

  it('a keyboard press bleeds from the centre of the button', async () => {
    installViewTransitions();
    const user = userEvent.setup();
    app();
    const button = screen.getByRole('button');
    button.getBoundingClientRect = () => ({ left: 100, top: 10, right: 140, bottom: 50, width: 40, height: 40, x: 100, y: 10, toJSON() {} }) as DOMRect;
    button.focus();
    await user.keyboard('{Enter}');
    await act(flush);
    const frame = inkAnimation()!.keyframes.at(-1)!;
    const size = parseFloat(String(frame.maskSize));
    const [x, y] = String(frame.maskPosition).split(',')[0]!.trim().split(' ').map(parseFloat);
    expect(x! + size / 2).toBeCloseTo(120, 1);
    expect(y! + size / 2).toBeCloseTo(30, 1);
    await act(settle);
  });

  it('keeps focus on the button through the transition', async () => {
    installViewTransitions();
    const user = userEvent.setup();
    app();
    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');
    await act(settle);
    expect(document.activeElement).toBe(button);
  });

  it('with reduced motion, switches without any animation', async () => {
    installViewTransitions();
    setReducedMotion(true);
    app();
    await act(async () => screen.getByRole('button').click());
    expect(root().dataset.theme).toBe('light');
    expect(transitions).toHaveLength(0);
    expect(root().classList.contains('inkshift-fade')).toBe(false);
  });

  it('marks itself as a toggle so presses during the transition can be recovered', () => {
    app();
    expect(screen.getByRole('button').hasAttribute('data-inkshift-toggle')).toBe(true);
  });
});
