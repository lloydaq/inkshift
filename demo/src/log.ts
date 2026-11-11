import type { TransitionEndInfo } from 'inkshift';

export interface LogEntry extends TransitionEndInfo {
  id: number;
  /** Milliseconds from the first press until the transition was cleaned up. */
  elapsed: number;
}

export const describe = (entry: LogEntry) =>
  entry.reversed
    ? `${entry.from} → ${entry.to}, pressed back · stayed ${entry.theme}`
    : `${entry.from} → ${entry.theme}`;
