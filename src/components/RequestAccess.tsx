"use client";

import { useState } from "react";
import { Modal } from "./feedback";

export type AccessKind = "self_audit" | "consultant_audit";

const COPY: Record<AccessKind, { title: string; intro: string; cta: string }> = {
  self_audit: {
    title: "Request Self-Audit access",
    intro: "Leave your details and the Amalthea team will contact you on WhatsApp to set up your Self-Audit workspace.",
    cta: "Request access",
  },
  consultant_audit: {
    title: "Talk to a consultant",
    intro: "Leave your details and an Amalthea consultant will contact you on WhatsApp to discuss a Consultant-led Audit.",
    cta: "Request a call",
  },
};

type Field = "name" | "business" | "phone" | "email";

/** Lead form for the paid tiers. Posts to /api/interest. */
export function RequestAccess({ kind, onClose, onDone }: { kind: AccessKind; onClose: () => void; onDone: (msg: string) => void }) {
  const c = COPY[kind];
  const [v, setV] = useState<Record<Field, string>>({ name: "", business: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function validate() {
    const e: Partial<Record<Field, string>> = {};
    if (!v.name.trim()) e.name = "Enter your name.";
    if (!v.business.trim()) e.business = "Enter your business name.";
    if (!/^[6-9]\d{9}$/.test(v.phone.replace(/[\s-]/g, "").replace(/^(\+?91)(?=\d{10}$)/, ""))) e.phone = "Enter a 10-digit mobile number.";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Enter a valid email, like name@company.in";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...v, phone: v.phone.replace(/[\s-]/g, "") }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onDone("Request received. The Amalthea team will contact you on WhatsApp.");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const field = (k: Field, label: string, type: string, ph: string, autoComplete: string) => (
    <div>
      <label className="field-label" htmlFor={`ra-${k}`}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {k === "phone" && (
          <span style={{ flex: "none", minHeight: 48, display: "flex", alignItems: "center", padding: "0 12px", background: "#FFFAF3", border: "1px solid #EADBC8", borderRadius: 10, fontSize: 15, fontWeight: 800 }}>+91</span>
        )}
        <input
          id={`ra-${k}`} className="input" type={type} placeholder={ph} autoComplete={autoComplete} value={v[k]}
          aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `ra-${k}-err` : undefined}
          onChange={(e) => setV({ ...v, [k]: e.target.value })} style={{ flex: "1 1 0", minWidth: 0 }}
        />
      </div>
      {errors[k] && <div id={`ra-${k}-err`} className="field-error">{errors[k]}</div>}
    </div>
  );

  return (
    <Modal title={c.title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div style={{ padding: "10px 24px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{c.intro}</p>
          {field("name", "Your name", "text", "Kiran Mehta", "name")}
          {field("business", "Business name", "text", "Kavya Industrial Supplies", "organization")}
          {field("phone", "WhatsApp number", "tel", "98765 43210", "tel-national")}
          {field("email", "Email", "email", "name@company.in", "email")}
          {failed && (
            <div role="alert" style={{ padding: "10px 13px", background: "#FADBD8", border: "1px solid #C62828", borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: "#C62828" }}>
              We could not send your request. Check your connection and try again.
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#6B5A4D" }}>
            Visible only to the Amalthea team. <a href="/privacy">Privacy notice · DPDP Act, 2023</a>
          </p>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Sending…" : c.cta}</button>
        </div>
      </form>
    </Modal>
  );
}
