"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/feedback";
import { RequestAccess } from "@/components/RequestAccess";

export function LoginActions() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-primary btn-block-m" onClick={() => setOpen(true)}>Request Self-Audit access</button>
      <Link href="/scorecard" className="btn btn-outline btn-block-m">Take the free Scorecard</Link>
      {open && (
        <RequestAccess kind="self_audit" onClose={() => setOpen(false)} onDone={(m) => { setOpen(false); toast.show(m); }} />
      )}
      {toast.node()}
    </div>
  );
}
