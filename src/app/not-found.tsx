import Link from "next/link";
import { Moon } from "@/components/brand";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <Moon phase={0} size={44} stroke="#EADBC8" style={{ marginBottom: 14 }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>We could not find this page</h1>
        <p style={{ margin: "9px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "#6B5A4D" }}>
          The link may be incomplete. Report links are long — check that the whole link was copied.
        </p>
        <Link href="/" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Go to the home page</Link>
      </div>
    </main>
  );
}
