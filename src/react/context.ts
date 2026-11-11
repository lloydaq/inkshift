import { createContext } from 'react';
import type { ThemeController, ThemePreference } from '../core/types';

export interface InkshiftContextValue {
  /** Null until the provider has mounted (and on the server). */
  controller: ThemeController | null;
  defaultTheme: ThemePreference;
}

export const InkshiftContext = createContext<InkshiftContextValue | null>(null);
