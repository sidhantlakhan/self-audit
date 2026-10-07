import { existsSync } from 'node:fs';
import type { Browser } from 'playwright-core';

let browser: Browser | null = null;

function chromiumPath(): string | undefined {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  return candidates.find((p) => p && existsSync(p));
}

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  const { chromium } = await import('playwright-core');
  browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

/** HTML → A4 PDF with a headless Chromium. The report HTML is self-contained (fonts embedded, no network). */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const ctx = await b.newContext({ javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  } finally {
    await ctx.close();
  }
}

export async function closePdfBrowser(): Promise<void> {
  await browser?.close().catch(() => undefined);
  browser = null;
}
