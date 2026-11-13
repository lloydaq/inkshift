import { useMemo, type CSSProperties } from 'react';
import { inkSplat } from 'inkshift';

interface SplatProps {
  seed: number;
  /** 0–1: how smoky the splat is. */
  fluidity?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A splat drawn by the library's own generator, used exactly as the transition uses it:
 * as a CSS mask over a filled box.
 */
export function Splat({ seed, fluidity = 0, className, style }: SplatProps) {
  const url = useMemo(() => inkSplat(seed, fluidity).url, [seed, fluidity]);
  return (
    <span
      aria-hidden="true"
      className={className ? `splat ${className}` : 'splat'}
      style={{ ...style, WebkitMaskImage: url, maskImage: url }}
    />
  );
}
