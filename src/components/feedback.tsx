"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Moon } from "./brand";
import { Check, Cross, Info } from "./icons";

export type ToastTone = "success" | "warning" | "error" | "brand";
export interface ToastMsg {
  text: string;
  detail?: string;
  tone: ToastTone;
}

const TONE = {
  success: { line: "#2E7D32", icon: <Check size={18} color="#2E7D32" style={{ marginTop: 1 }} /> },
  warning: { line: "#B7791F", icon: <Info size={18} style={{ marginTop: 1 }} /> },
  error: { line: "#C62828", icon: <Cross size={18} style={{ marginTop: 1 }} /> },
  brand: { line: "#E8650A", icon: <Moon phase={2} size={18} strokeWidth={1.6} style={{ marginTop: 1 }} /> },
} as const;

export function Toast({ msg, style }: { msg: ToastMsg; style?: React.CSSProperties }) {
  const t = TONE[msg.tone];
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 15px", background: "#FFFFFF",
        border: `1px solid ${msg.tone === "brand" ? "#EADBC8" : t.line}`, borderLeft: `4px solid ${t.line}`, borderRadius: 10,
        boxShadow: "0 8px 24px rgba(36,27,20,0.2)", ...style,
      }}
    >
      {t.icon}
      <div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 700, color: "#241B14" }}>{msg.text}</div>
        {msg.detail && <div style={{ fontSize: 12, color: "#6B5A4D", marginTop: 2 }}>{msg.detail}</div>}
      </div>
    </div>
  );
}

/** A single floating toast, bottom-centred, lifted above any sticky action bar. */
export function useToast(defaultMs = 3600) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(
    (text: string, tone: ToastTone = "success", opts: { detail?: string; ms?: number } = {}) => {
      setMsg({ text, tone, detail: opts.detail });
      clearTimeout(timer.current);
      if (opts.ms !== 0) timer.current = setTimeout(() => setMsg(null), opts.ms ?? defaultMs);
    },
    [defaultMs],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (bottom = 22): ReactNode =>
    msg ? (
      <div style={{ position: "fixed", left: 14, right: 14, bottom, zIndex: 80, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <Toast msg={msg} style={{ maxWidth: 520, width: "100%", pointerEvents: "auto" }} />
      </div>
    ) : null;
  return { show, clear: () => setMsg(null), node, msg };
}

export function Modal({ title, children, onClose, labelledBy = "modal-title" }: { title: string; children: ReactNode; onClose: () => void; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,button,select,textarea")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(21,18,13,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        style={{ width: "100%", maxWidth: 470, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#FFFFFF", border: "1px solid #EADBC8", borderRadius: 14, boxShadow: "0 18px 48px rgba(21,18,13,0.28)" }}
      >
        <h3 id={labelledBy} style={{ margin: 0, padding: "22px 24px 0", fontSize: 20, fontWeight: 800, letterSpacing: "-0.015em", color: "#241B14" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
