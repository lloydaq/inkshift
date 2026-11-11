import { createInitScript, type InitScriptOptions } from '../core/init';

export interface ThemeScriptProps extends InitScriptOptions {
  /** CSP nonce for the inline script. */
  nonce?: string;
}

/**
 * Inline script that applies the theme before first paint. Render it in `<head>` for
 * server-rendered apps (Next.js, Remix, Astro…), with the same options as the provider.
 * For a client-only app, paste the output of `createInitScript()` into `index.html`.
 */
export function ThemeScript({ nonce, ...options }: ThemeScriptProps) {
  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: createInitScript(options) }} />;
}
