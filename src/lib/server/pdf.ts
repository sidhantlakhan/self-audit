import "server-only";
import { chromium, type Browser } from "playwright-core";

let browser: Promise<Browser> | null = null;

/**
 * Local and container hosts use the Chromium at CHROMIUM_EXECUTABLE_PATH.
 * On Vercel (no such binary) the serverless build from @sparticuz/chromium is used.
 */
async function start(): Promise<Browser> {
  const local = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (local) return chromium.launch({ executablePath: local, args: ["--no-sandbox", "--font-render-hinting=none"] });
  const serverless = (await import("@sparticuz/chromium")).default;
  return chromium.launch({ executablePath: await serverless.executablePath(), args: serverless.args });
}

function launch(): Promise<Browser> {
  browser ??= start().catch((err) => {
    browser = null;
    throw err;
  });
  return browser;
}

/** The public base URL of this app, used by background jobs and PDF rendering. */
export function appUrl(fallbackOrigin?: string): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return (process.env.APP_URL || fallbackOrigin || vercel || "http://localhost:3000").replace(/\/$/, "");
}

/** Renders one of the app's print pages (two A4 pages) to a PDF. */
export async function renderPdf(url: string): Promise<Buffer> {
  const b = await launch();
  const context = await b.newContext({ viewport: { width: 794, height: 1123 } });
  try {
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!res || !res.ok()) throw new Error(`Print page returned ${res?.status() ?? "no response"}`);
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await context.close();
  }
}
