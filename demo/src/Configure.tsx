import type { AnimationType } from 'inkshift';
import { ThemeToggle } from 'inkshift/react';
import type { DemoConfig } from './App';
import { CodeBlock } from './CodeBlock';
import { Section } from './Section';
import { Splat } from './Splat';

const TYPES: { value: AnimationType; label: string; hint: string }[] = [
  { value: 'ink', label: 'Ink', hint: 'The bleed. Falls back to a fade where the browser cannot run it.' },
  { value: 'fade', label: 'Fade', hint: 'A short colour cross-fade.' },
  { value: 'instant', label: 'Instant', hint: 'No animation at all.' },
];

export function Configure({ config, onChange }: { config: DemoConfig; onChange: (next: DemoConfig) => void }) {
  const set = (patch: Partial<DemoConfig>) => onChange({ ...config, ...patch });
  const code = `<ThemeProvider
  animation={{
    type: '${config.type}',${config.type === 'instant' ? '' : `\n    duration: ${config.duration},`}${config.type === 'ink' ? `\n    seed: ${config.seed},` : ''}
  }}
>`;

  return (
    <Section
      id="configure"
      title="Tune the ink."
      intro={
        <>
          <p>
            The defaults are the original animation: 1100 ms, two splats, a quick first bloom and a slow soak. Every splat
            comes from a seeded generator, so a fixed seed gives the same drops every time, for demos and tests.
          </p>
          <p>
            With <code>prefers-reduced-motion: reduce</code> the switch is instant, whatever is set here.
          </p>
        </>
      }
    >
      <div className="config">
        <div className="config__controls">
          <fieldset className="segmented">
            <legend className="field__label">Animation</legend>
            {TYPES.map((t) => (
              <label key={t.value} className="segmented__option" title={t.hint}>
                <input type="radio" name="type" value={t.value} checked={config.type === t.value} onChange={() => set({ type: t.value })} />
                <span>{t.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="field__hint">{TYPES.find((t) => t.value === config.type)!.hint}</p>

          <label className="field">
            <span className="field__label">
              Duration <output>{config.duration} ms</output>
            </span>
            <input
              type="range"
              min={300}
              max={2400}
              step={50}
              value={config.duration}
              disabled={config.type === 'instant'}
              onChange={(e) => set({ duration: Number(e.target.value) })}
            />
          </label>

          <div className="field">
            <label className="field__label" htmlFor="seed">
              Seed for the next splats
            </label>
            <div className="seed">
              <input
                id="seed"
                type="number"
                inputMode="numeric"
                value={config.seed}
                onChange={(e) => {
                  const seed = Math.trunc(Number(e.target.value));
                  if (Number.isFinite(seed)) set({ seed });
                }}
              />
              <button type="button" className="button button--quiet" onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>
                New seed
              </button>
              <button type="button" className="button button--quiet" onClick={() => set({ duration: 1100, type: 'ink' })}>
                Original timing
              </button>
            </div>
          </div>

          <div className="config__try">
            <ThemeToggle />
            <span>Try it with these settings</span>
          </div>
        </div>

        <figure className="pair">
          <div className="pair__drops">
            <Splat seed={config.seed} className="pair__splat" />
            <Splat seed={config.seed + 1} className="pair__splat pair__splat--trail" />
          </div>
          <figcaption>
            The next two splats, seeds {config.seed} and {config.seed + 1}. The second trails the first as they spread.
          </figcaption>
        </figure>
      </div>
      <CodeBlock label="App.tsx" code={code} />
    </Section>
  );
}
