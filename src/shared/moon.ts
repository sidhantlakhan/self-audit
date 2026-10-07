/** Moon-phase motif: SVG path for the lit portion of a 20×20 moon, fraction 0 (new) … 1 (full). Lit side is the right. */
export function moonPath(fraction: number): string {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= 0) return '';
  const rx = (8.5 * Math.abs(1 - 2 * f)).toFixed(2);
  const sweep = f > 0.5 ? 1 : 0;
  return `M10 1.5 A8.5 8.5 0 0 1 10 18.5 A${rx} 8.5 0 0 ${sweep} 10 1.5 Z`;
}

export const BAND_MOON: Record<string, number> = { foundation: 0.18, emerging: 0.38, developing: 0.55, ready: 0.78, advanced: 1 };
