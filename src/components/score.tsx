import { GAUGE_ARC, PILLAR_MAX, gaugeOffset, type BandKey } from "@/lib/scorecard";
import { BAND_COLOURS } from "./brand";

/** Semicircle score gauge, 0–100. */
export function Gauge({
  total, band, width = 250, strokeWidth = 16, caption = "out of 100", numberSize = 50, numberY = 98, label,
}: {
  total: number;
  band: BandKey;
  width?: number;
  strokeWidth?: number;
  caption?: string | null;
  numberSize?: number;
  numberY?: number;
  label?: string;
}) {
  const colour = BAND_COLOURS[band].fg;
  return (
    <svg
      width={width} height={Math.round((width * 128) / 220)} viewBox="0 0 220 128" role="img" style={{ maxWidth: "100%", flex: "none" }}
      aria-label={label ?? `Score ${total} out of 100`}
    >
      <path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="#EADBC8" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path
        d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke={colour} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={GAUGE_ARC} strokeDashoffset={gaugeOffset(total)}
      />
      <text x="110" y={numberY} textAnchor="middle" fontFamily="var(--font)" fontSize={numberSize} fontWeight="800" fill="#241B14">{total}</text>
      {caption && <text x="110" y="120" textAnchor="middle" fontFamily="var(--font)" fontSize="12" fontWeight="700" fill="#6B5A4D">{caption}</text>}
    </svg>
  );
}

/** Bar colour rule from the result design: weakest red, 14+ green, 8+ amber, otherwise orange. */
export function barColour(score: number, weakest: boolean): string {
  if (weakest) return "#C62828";
  if (score >= 14) return "#2E7D32";
  if (score >= 8) return "#F5A020";
  return "#E8650A";
}

export interface PillarBar {
  name: string;
  score: number;
  weakest?: boolean;
}

export function PillarBars({
  bars, barHeight = 10, gap = 14, nameSize = 14, showWeakest = true,
}: {
  bars: PillarBar[];
  barHeight?: number;
  gap?: number;
  nameSize?: number;
  showWeakest?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {bars.map((p) => (
        <div key={p.name}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: nameSize, fontWeight: 800, color: "#241B14" }}>
              {p.name}
              {showWeakest && p.weakest && (
                <span style={{ marginLeft: 8, padding: "2px 7px", background: "#FADBD8", borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#C62828" }}>
                  Weakest
                </span>
              )}
            </span>
            <span style={{ fontSize: nameSize, fontWeight: 800, color: "#C24000", fontVariantNumeric: "tabular-nums" }}>
              {p.score}/{PILLAR_MAX}
            </span>
          </div>
          <div
            role="meter" aria-label={p.name} aria-valuemin={0} aria-valuemax={PILLAR_MAX} aria-valuenow={p.score}
            style={{ height: barHeight, background: "#EADBC8", borderRadius: 99, overflow: "hidden" }}
          >
            <div style={{ width: `${(p.score / PILLAR_MAX) * 100}%`, height: "100%", borderRadius: 99, background: barColour(p.score, !!p.weakest) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
