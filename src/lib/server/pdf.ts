import "server-only";
import { chromium, type Browser } from "playwright-core";

let browser: Promise<Browser> | null = null;

function launch(): Promise<Browser> {
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) throw new Error("CHROMIUM_EXECUTABLE_PATH is not set, so PDFs cannot be rendered.");
  browser ??= chromium.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] }).catch((err) => {
    browser = null;
    throw err;
  });
  return browser;
}

/** The public base URL of this app, used by background jobs and PDF rendering. */
export function appUrl(fallbackOrigin?: string): string {
  return (process.env.APP_URL || fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
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
