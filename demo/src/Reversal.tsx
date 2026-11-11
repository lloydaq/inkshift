import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'inkshift/react';
import { Section } from './Section';
import { Back } from './icons';
import type { LogEntry } from './log';

// The library's spread curve (inkSplat.ts), redrawn here to explain it.
const soak = (t: number) => 0.45 * t + 0.55 * (1 - (1 - t) ** 2.4);

function Curve({ at, duration }: { at: number; duration: number }) {
  const w = 480;
  const h = 150;
  const turn = Math.min(1, at / duration);
  const points = useMemo(() => {
    const out: string[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turn;
      out.push(`${(t * w) / 2},${h - soak(t) * h}`);
    }
    // Pressed back: the same animation runs backwards, retracing the curve.
    for (let i = steps; i >= 0; i--) {
      const t = (i / steps) * turn;
      out.push(`${(turn * w) / 2 + ((turn - t) * w) / 2},${h - soak(t) * h}`);
    }
    return out.join(' ');
  }, [turn]);
  const full = useMemo(
    () => Array.from({ length: 61 }, (_, i) => `${(i / 60) * w},${h - soak(i / 60) * h}`).join(' '),
    [],
  );
  const peak = { x: (turn * w) / 2, y: h - soak(turn) * h };
  return (
    <svg className="curve" viewBox={`-8 -24 ${w + 16} ${h + 72}`} role="img" aria-label={`Ink coverage over time, pressed back after ${at} milliseconds`}>
      <line x1="0" y1={h} x2={w} y2={h} className="curve__axis" />
      <polyline points={full} className="curve__ghost" />
      <polyline points={points} className="curve__path" />
      <circle cx={peak.x} cy={peak.y} r="4.5" className="curve__dot" />
      <text x={peak.x} y={peak.y - 12} textAnchor="middle" className="curve__label">
        pressed back
      </text>
      <text x="0" y={h + 22} className="curve__label">
        first press
      </text>
      <text x={turn * w} y={turn * w < 260 ? h + 42 : h + 22} textAnchor={turn * w < 260 ? 'start' : 'end'} className="curve__label">
        old theme restored
      </text>
    </svg>
  );
}

export function Reversal({ log }: { log: LogEntry[] }) {
  const { toggleTheme, isTransitioning } = useTheme();
  const [delay, setDelay] = useState(420);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = () => {
    toggleTheme(button.current ?? undefined);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => toggleTheme(), delay);
  };
  const last = log.find((entry) => entry.reversed);

  return (
    <Section
      id="reverse"
      title="Change your mind halfway."
      intro={
        <>
          <p>
            Press the toggle again while the ink is still spreading and the same animation turns around where it stands. It
            does not restart, and no second transition starts: the ink pulls back to where it began, then the page goes back
            to the old theme without a visible step.
          </p>
          <p>However fast the presses come, the page ends on the theme the last press asked for.</p>
        </>
      }
    >
      <Curve at={delay} duration={1100} />
      <div className="recall">
        <label className="field">
          <span className="field__label">
            Press back after <output>{delay} ms</output>
          </span>
          <input type="range" min={100} max={1000} step={20} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </label>
        <button ref={button} type="button" className="button" onClick={run} disabled={isTransitioning}>
          <Back />
          Spill, then press back
        </button>
      </div>
      <p className="note" aria-live="polite">
        {last
          ? `Last reversal: ${last.from} to ${last.to} was pressed back and the page stayed ${last.theme}, ${last.elapsed} ms after the first press.`
          : 'Press the toggle twice yourself, or let the button do it at a set moment.'}
      </p>
    </Section>
  );
}
