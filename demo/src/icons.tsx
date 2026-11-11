// One stroke icon set on a 24px grid, matching the toggle's icons.
import type { SVGProps } from 'react';

const Base = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

export const ArrowUpRight = () => (
  <Base>
    <path d="M7 17 17 7M8 7h9v9" />
  </Base>
);
export const Copy = () => (
  <Base>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </Base>
);
export const Check = () => (
  <Base>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);
export const Cross = () => (
  <Base>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const Back = () => (
  <Base>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Base>
);
