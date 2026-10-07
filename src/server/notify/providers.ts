import type { Env } from '../env.ts';

export interface OutboundEmail { to: string; subject: string; html: string; text: string }
export interface EmailProvider { name: string; send(m: OutboundEmail): Promise<void> }
export interface WhatsAppProvider { name: string; send(to: string, body: string): Promise<void> }

/** Dev provider: nothing leaves the process. */
function consoleEmail(env: Env): EmailProvider {
  return {
    name: 'console',
    async send(m) {
      // Development convenience only: print the message (including the resume link) to the terminal.
      if (env.NODE_ENV !== 'production') console.info(`\n[dev email] to=${m.to} subject="${m.subject}"\n${m.text}`);
    },
  };
}

/** Integration point: Resend HTTP API. Swap/add providers here without touching the product core. */
function resendEmail(env: Env): EmailProvider {
  return {
    name: 'resend',
    async send(m) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
    },
  };
}

export function createEmailProvider(env: Env): EmailProvider | null {
  if (env.EMAIL_PROVIDER === 'none') return null;
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY required for EMAIL_PROVIDER=resend');
    return resendEmail(env);
  }
  return consoleEmail(env);
}

/** WhatsApp is optional. Integration point: add a Cloud API / BSP adapter implementing WhatsAppProvider. */
export function createWhatsAppProvider(env: Env): WhatsAppProvider | null {
  if (env.WHATSAPP_PROVIDER === 'none') return null;
  return { name: 'console', async send() { /* recorded in notifications table */ } };
}
