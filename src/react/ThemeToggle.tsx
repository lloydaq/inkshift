import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { TOGGLE_ATTRIBUTE } from '../core/animation';
import { otherTheme } from '../core/theme';
import type { Theme } from '../core/types';
import { MoonIcon, SunIcon } from './icons';
import { useTheme } from './useTheme';

export interface ThemeToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /**
   * Accessible name for each action, keyed by the theme the button would switch to.
   * Default: "Switch to light theme" / "Switch to dark theme".
   */
  labels?: Partial<Record<Theme, string>>;
}

/**
 * A button that toggles between light and dark with the ink bleed. The ink starts at the
 * pointer, or at the centre of the button for keyboard presses. Pressed again while the
 * ink is spreading, it pulls the ink back.
 *
 * Shows a moon in the dark theme and a sun in the light one (shape, not colour, tells
 * them apart). Pass children to replace the icons. Calling `event.preventDefault()` in
 * your own `onClick` skips the toggle.
 */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(function ThemeToggle(
  { labels, className, onClick, children, ...rest },
  ref,
) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const next = otherTheme(resolvedTheme);
  const label = labels?.[next] ?? `Switch to ${next} theme`;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) toggleTheme(event);
  };

  return (
    <button
      aria-label={label}
      {...rest}
      {...{ [TOGGLE_ATTRIBUTE]: '' }}
      ref={ref}
      type="button"
      className={className ? `inkshift-toggle ${className}` : 'inkshift-toggle'}
      data-theme-current={resolvedTheme}
      onClick={handleClick}
    >
      {children ?? (
        <>
          <MoonIcon />
          <SunIcon />
        </>
      )}
    </button>
  );
});
