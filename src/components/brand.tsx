import type { CSSProperties } from "react";
import { BANDS, type BandKey } from "@/lib/scorecard";

/** Pie fills for the moon-phase motif, on a 20×20 viewBox: new, crescent, half, three-quarter, full. */
export const MOON_PATHS = [
  "",
  "M10 10 L10 1.5 A8.5 8.5 0 0 1 18.5 10 Z",
  "M10 10 L10 1.5 A8.5 8.5 0 0 1 10 18.5 Z",
  "M10 10 L10 1.5 A8.5 8.5 0 1 1 1.5 10 Z",
  "M10 1.5 A8.5 8.5 0 1 1 9.99 1.5 Z",
] as const;

export type MoonPhase = 0 | 1 | 2 | 3 | 4;

export function Moon({
  phase, size = 20, stroke = "#C24000", fill = "#F5A020", strokeWidth = 1.3, bg = "none", style,
}: {
  phase: MoonPhase;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  bg?: string;
  style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none", ...style }}>
      <circle cx="10" cy="10" r="8.5" fill={bg} stroke={stroke} strokeWidth={strokeWidth} />
      {phase > 0 && <path d={MOON_PATHS[phase]} fill={fill} />}
    </svg>
  );
}

/** Half moon + wordmark. `dark` for charcoal backgrounds. */
export function Logo({ dark = false, size = 28, label = "Amalthea", fontSize = 17 }: { dark?: boolean; size?: number; label?: string; fontSize?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <Moon phase={2} size={size} stroke={dark ? "#F5A020" : "#C24000"} strokeWidth={1.4} />
      <span style={{ fontSize, fontWeight: 800, letterSpacing: "-0.01em", color: dark ? "#FFFAF3" : "#241B14" }}>{label}</span>
    </span>
  );
}

export function AiBadge({ style }: { style?: CSSProperties }) {
  return <span className="ai-badge" style={style}>Drafted by AI</span>;
}

export const BAND_COLOURS: Record<BandKey, { fg: string; tint: string; phase: MoonPhase }> = {
  foundation: { fg: "#C62828", tint: "#FADBD8", phase: 1 },
  "getting-ready": { fg: "#B7791F", tint: "#FDF4E3", phase: 2 },
  "ai-ready": { fg: "#2E7D32", tint: "#EAF4EB", phase: 4 },
};

export function BandPill({ band, size = "md" }: { band: BandKey; size?: "sm" | "md" }) {
  const c = BAND_COLOURS[band];
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 9, padding: sm ? "6px 13px" : "8px 14px",
        background: c.tint, border: `1px solid ${c.fg}`, borderRadius: 999,
      }}
    >
      <Moon phase={c.phase} size={sm ? 18 : 20} stroke={c.fg} fill={c.fg} strokeWidth={1.6} />
      <span style={{ fontSize: sm ? 12.5 : 14, fontWeight: 800, color: c.fg }}>{BANDS[band].label}</span>
    </span>
  );
}
