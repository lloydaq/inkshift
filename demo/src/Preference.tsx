import type { ThemePreference } from 'inkshift';
import { useTheme } from 'inkshift/react';
import { Section } from './Section';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Preference() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();
  return (
    <Section
      id="preference"
      title="Light, dark, or the system’s."
      intro={
        <p>
          System follows <code>prefers-color-scheme</code> live, and stores nothing. Choosing light or dark stores that choice
          and keeps it across reloads and tabs. The theme in effect always lives on one attribute:{' '}
          <code>&lt;html data-theme&gt;</code>.
        </p>
      }
    >
      <fieldset className="segmented">
        <legend className="field__label">Theme preference</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="segmented__option">
            <input
              type="radio"
              name="preference"
              value={option.value}
              checked={theme === option.value}
              onChange={() => {}}
              onClick={(event) => setTheme(option.value, event)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <dl className="facts">
        <div>
          <dt>Preference</dt>
          <dd>{theme}</dd>
        </div>
        <div>
          <dt>Showing</dt>
          <dd>{resolvedTheme}</dd>
        </div>
        <div>
          <dt>Your system</dt>
          <dd>{systemTheme}</dd>
        </div>
      </dl>
    </Section>
  );
}
