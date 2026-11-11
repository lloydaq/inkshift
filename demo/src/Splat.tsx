import { useMemo, type CSSProperties } from 'react';
import { inkSplat } from 'inkshift';

interface SplatProps {
  seed: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A splat drawn by the library's own generator, used exactly as the transition uses it:
 * as a CSS mask over a filled box.
 */
export function Splat({ seed, className, style }: SplatProps) {
  const url = useMemo(() => inkSplat(seed).url, [seed]);
  return (
    <span
      aria-hidden="true"
      className={className ? `splat ${className}` : 'splat'}
      style={{ ...style, WebkitMaskImage: url, maskImage: url }}
    />
  );
}
