import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnimationType, TransitionEndInfo, TransitionInfo } from 'inkshift';
import { ThemeProvider } from 'inkshift/react';
import { STORAGE_KEY } from './links';
import { Masthead, Footer } from './chrome';
import { Hero } from './Hero';
import { Stage } from './Stage';
import { Reversal } from './Reversal';
import { Preference } from './Preference';
import { Configure } from './Configure';
import { Customize, Install, ReactUsage, Support } from './Reference';
import type { LogEntry } from './log';

export interface DemoConfig {
  type: AnimationType;
  duration: number;
  seed: number;
}

export function App() {
  const [config, setConfig] = useState<DemoConfig>({ type: 'ink', duration: 1100, seed: 1871 });
  const [log, setLog] = useState<LogEntry[]>([]);
  const started = useRef<{ at: number; info: TransitionInfo; presses: number } | null>(null);

  const animation = useMemo(() => ({ type: config.type, duration: config.duration, seed: config.seed }), [config]);

  const onTransitionStart = useCallback((info: TransitionInfo) => {
    started.current = { at: performance.now(), info, presses: 1 };
    // The controller uses two seeds per ink run; keep the preview in step with it.
    if (info.type === 'ink') setConfig((c) => ({ ...c, seed: c.seed + 2 }));
  }, []);

  const onTransitionEnd = useCallback((info: TransitionEndInfo) => {
    const start = started.current;
    const elapsed = start ? Math.round(performance.now() - start.at) : 0;
    setLog((entries) =>
      [{ id: (entries[0]?.id ?? 0) + 1, ...info, elapsed }, ...entries].slice(0, 6),
    );
    started.current = null;
  }, []);

  return (
    <ThemeProvider storageKey={STORAGE_KEY} animation={animation} onTransitionStart={onTransitionStart} onTransitionEnd={onTransitionEnd}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Masthead />
      <main id="main">
        <Hero />
        <Stage log={log} />
        <Reversal log={log} />
        <Preference />
        <Configure config={config} onChange={setConfig} />
        <Customize />
        <Install />
        <ReactUsage />
        <Support />
      </main>
      <Footer />
    </ThemeProvider>
  );
}
