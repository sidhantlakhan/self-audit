import type { Metadata } from "next";
import { SimplePage } from "../SimplePage";
import { LoginActions } from "./LoginActions";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <SimplePage eyebrow="Founder workspace" title="Log in">
      <p>
        Workspace log-in opens when your Self-Audit starts. The Amalthea team sets up your workspace and sends your log-in link on
        WhatsApp and email.
      </p>
      <p>Have not started yet? Request access, or begin with the free 10-minute Scorecard.</p>
      <LoginActions />
    </SimplePage>
  );
}
