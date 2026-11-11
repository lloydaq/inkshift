import { useState } from 'react';
import { Check, Copy } from './icons';

interface CodeBlockProps {
  code: string;
  /** Short name of the file or language, shown above the code. */
  label: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1800);
  };
  return (
    <figure className="code">
      <figcaption className="code__bar">
        <span>{label}</span>
        <button type="button" className="code__copy" onClick={copy} aria-label={`Copy ${label}`}>
          {state === 'copied' ? <Check /> : <Copy />}
          <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
