import { ThemeToggle } from 'inkshift/react';
import type { DemoConfig } from './App';
import { CodeBlock } from './CodeBlock';
import { Section } from './Section';
import { Splat } from './Splat';

const PRESETS: { label: string; fluidity: number; duration: number }[] = [
  { label: 'Ink', fluidity: 0, duration: 1100 },
  { label: 'Mist', fluidity: 0.45, duration: 1500 },
  { label: 'Smoke', fluidity: 1, duration: 2000 },
];

export function Fluid({ config, onChange }: { config: DemoConfig; onChange: (next: DemoConfig) => void }) {
  const percent = Math.round(config.fluidity * 100);
  const active = PRESETS.find((p) => p.fluidity === config.fluidity && p.duration === config.duration && config.type === 'ink');
  const code = `<ThemeProvider
  animation={{
    type: 'ink',
    duration: ${config.duration},
    fluidity: ${config.fluidity},
  }}
>`;

  return (
    <Section
      id="fluid"
      title="Or let it drift like smoke."
      intro={
        <>
          <p>
            Fluidity loosens the ink. The outline is warped into wisps, the hard edge dissolves into a soft gradient, and the
            two layers curl away from each other as they spread, so the new theme rolls in like smoke instead of soaking
            through paper.
          </p>
          <p>
            At zero it is the original ink, untouched. It reverses the same way: press again and the smoke is drawn back in.
            A longer duration suits it.
          </p>
        </>
      }
    >
      <div className="config">
        <div className="config__controls">
          <div className="field">
            <span className="field__label" id="fluid-presets">
              Start from
            </span>
            <div className="seed" role="group" aria-labelledby="fluid-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={active === preset ? 'button' : 'button button--quiet'}
                  aria-pressed={active === preset}
                  onClick={() => onChange({ ...config, type: 'ink', fluidity: preset.fluidity, duration: preset.duration })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field__label">
              Fluidity <output>{percent}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(e) => onChange({ ...config, type: 'ink', fluidity: Number(e.target.value) / 100 })}
            />
          </label>

          <label className="field">
            <span className="field__label">
              Duration <output>{config.duration} ms</output>
            </span>
            <input
              type="range"
              min={300}
              max={3000}
              step={50}
              value={config.duration}
              onChange={(e) => onChange({ ...config, duration: Number(e.target.value) })}
            />
          </label>

          <div className="config__try">
            <ThemeToggle />
            <span>{percent === 0 ? 'Crisp ink. Raise the fluidity, then press.' : 'Press to let it out. Press again to draw it back.'}</span>
          </div>
        </div>

        <figure className="pair">
          <div className="pair__drops">
            <Splat seed={config.seed} fluidity={config.fluidity} className="pair__splat" />
            <Splat seed={config.seed + 1} fluidity={config.fluidity} className="pair__splat pair__splat--trail" />
          </div>
          <figcaption>The next two splats at {percent}% fluidity.</figcaption>
        </figure>
      </div>
      <CodeBlock label="App.tsx" code={code} />
    </Section>
  );
}
