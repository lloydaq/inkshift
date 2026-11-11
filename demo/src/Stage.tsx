import { useState, type MouseEvent } from 'react';
import { useTheme } from 'inkshift/react';
import { Section } from './Section';
import { describe, type LogEntry } from './log';

export function Stage({ log }: { log: LogEntry[] }) {
  const { toggleTheme } = useTheme();
  const [mark, setMark] = useState<{ x: number; y: number; keyboard: boolean } | null>(null);

  const press = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const keyboard = event.detail === 0;
    setMark({
      x: keyboard ? 50 : ((event.clientX - box.left) / box.width) * 100,
      y: keyboard ? 50 : ((event.clientY - box.top) / box.height) * 100,
      keyboard,
    });
    toggleTheme(event);
  };

  return (
    <Section
      id="try"
      title="Press anywhere on the sheet."
      intro={
        <>
          <p>
            The ink starts at the exact point you press, in viewport pixels, and spreads until every corner of the screen is
            covered. Two splats grow together; the second trails the first, so the edge keeps changing shape as it soaks
            outward instead of simply scaling.
          </p>
          <p>From the keyboard, focus the sheet and press Enter: the ink starts from its centre.</p>
        </>
      }
    >
      <button type="button" className="sheet" onClick={press} data-inkshift-toggle="">
        <span className="sheet__prompt">
          <span className="sheet__big">Press here</span>
          <span className="sheet__small">or anywhere else on this sheet</span>
        </span>
        {mark && (
          <span className="sheet__mark" style={{ left: `${mark.x}%`, top: `${mark.y}%` }} aria-hidden="true">
            <span className="sheet__coords">{mark.keyboard ? 'centre (keyboard)' : 'last press'}</span>
          </span>
        )}
      </button>
      <div className="log" aria-live="polite">
        <h3 className="log__title">Recent switches</h3>
        {log.length === 0 ? (
          <p className="log__empty">Nothing yet. Every switch you make on this page is listed here.</p>
        ) : (
          <ol className="log__list">
            {log.map((entry) => (
              <li key={entry.id} className="log__item">
                <span>{describe(entry)}</span>
                <span className="log__meta">
                  {entry.type} · {entry.elapsed} ms
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Section>
  );
}
