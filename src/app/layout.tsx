import type { Metadata, Viewport } from "next";
import { Mulish } from "next/font/google";
import "./globals.css";

const mulish = Mulish({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-mulish", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Is your business ready for AI? · Amalthea", template: "%s · Amalthea" },
  description:
    "A free 10-minute AI-Readiness Scorecard for Indian MSMEs. Most AI courses teach tools. We make your business ready for them — then put them to work.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#15120D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={mulish.variable}>
      <body>{children}</body>
    </html>
  );
}
