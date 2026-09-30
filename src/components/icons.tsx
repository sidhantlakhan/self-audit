import type { CSSProperties } from "react";

type P = { size?: number; color?: string; style?: CSSProperties };

export const Check = ({ size = 16, color = "#FFFFFF", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", ...style }}>
    <path d="M3 8.5l3.2 3.2L13 5" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Chevron = ({ size = 18, color = "#C24000", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" style={{ flex: "none", transition: "transform .15s", ...style }}>
    <path d="M4 7l5 5 5-5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Info = ({ size = 16, color = "#B7791F", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", ...style }}>
    <circle cx="8" cy="8" r="7" fill="none" stroke={color} strokeWidth="1.5" />
    <path d="M8 4.5v4.2M8 11.2v.1" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Cross = ({ size = 18, color = "#C62828", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", ...style }}>
    <path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const Mic = ({ size = 18, style }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", ...style }}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
    <path d="M6 11a6 6 0 0012 0M12 17v4" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />
  </svg>
);

export const Upload = ({ size = 30, color = "#C24000", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", ...style }}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Menu = ({ size = 22, color = "#FFFAF3", style }: P) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none", ...style }}>
    <path d="M3 6h14M3 10h14M3 14h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const Spinner = ({ size = 16, style }: P) => (
  <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" style={{ flex: "none", animation: "am-spin 1s linear infinite", ...style }}>
    <circle cx="17" cy="17" r="13" fill="none" stroke="#EADBC8" strokeWidth="4" />
    <path d="M17 4a13 13 0 0113 13" fill="none" stroke="#E8650A" strokeWidth="4" strokeLinecap="round" />
  </svg>
);
