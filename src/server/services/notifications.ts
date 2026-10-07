import type { Ctx } from '../lib/context.ts';

export type Template = 'assessment_started' | 'assessment_resume' | 'assessment_completed' | 'report_available' | 'consultation_confirmation';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Resume tokens are never persisted — strip them from the outbox copy. */
const redact = (s: string) => s.replace(/#t=[A-Za-z0-9_-]+/g, '#t=[redacted]');

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#FFFAF3;font-family:Mulish,Arial,sans-serif;color:#241B14"><div style="max-width:560px;margin:0 auto;padding:32px 24px"><div style="font-weight:800;color:#C24000;font-size:18px;margin-bottom:20px">AI Readiness Diagnostic</div>${body}<p style="margin-top:32px;font-size:12px;color:#6B5A4D">Your responses are private and visible only to you and the diagnostic team.</p></div></body></html>`;
const button = (href: string, label: string) => `<p><a href="${esc(href)}" style="display:inline-block;background:#C24000;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(label)}</a></p>`;

interface Vars { name: string; link: string; business?: string; score?: number; band?: string }

function render(t: Template, v: Vars): { subject: string; html: string; text: string } {
  const hi = `Hello ${v.name || 'there'},`;
  switch (t) {
    case 'assessment_started':
    case 'assessment_resume':
      return {
        subject: 'Continue your AI Readiness Diagnostic',
        text: `${hi}\n\nYour assessment is saved. Continue where you left off:\n${v.link}\n`,
        html: shell(`<p>${esc(hi)}</p><p>Your assessment is saved automatically. You can continue where you left off at any time.</p>${button(v.link, 'Continue assessment')}`),
      };
    case 'assessment_completed':
      return {
        subject: 'Your AI Readiness Diagnostic is ready',
        text: `${hi}\n\nYour diagnostic for ${v.business ?? 'your business'} is ready: ${v.score}/100 (${v.band}).\n${v.link}\n`,
        html: shell(`<p>${esc(hi)}</p><p>Your diagnostic for <strong>${esc(v.business ?? 'your business')}</strong> is ready. Current AI readiness: <strong>${v.score} / 100</strong> — ${esc(v.band ?? '')}.</p>${button(v.link, 'View your diagnostic')}`),
      };
    case 'report_available':
      return {
        subject: 'Your diagnostic report is available',
        text: `${hi}\n\nYour diagnostic report is ready to download:\n${v.link}\n`,
        html: shell(`<p>${esc(hi)}</p><p>Your diagnostic report is ready.</p>${button(v.link, 'Open your report')}`),
      };
    case 'consultation_confirmation':
      return {
        subject: 'Your consultation is confirmed',
        text: `${hi}\n\nYour consultation is booked. Details are on your booking confirmation.\n`,
        html: shell(`<p>${esc(hi)}</p><p>Your consultation is booked. The booking confirmation carries the date, time and joining details.</p>`),
      };
  }
}

export interface NotifyInput {
  assessmentId: string;
  template: Template;
  email?: string | null;
  mobile?: string | null;
  vars: Vars;
}

/** Records every message in the outbox, then attempts delivery. Delivery failure never fails the caller. */
export async function notify(ctx: Ctx, n: NotifyInput): Promise<void> {
  const msg = render(n.template, n.vars);
  if (n.email) {
    const row = await ctx.db.one<{ id: string }>(
      `INSERT INTO notifications (assessment_id, channel, template, recipient, subject, body, status, provider)
       VALUES ($1,'email',$2,$3,$4,$5,'queued',$6) RETURNING id`,
      [n.assessmentId, n.template, n.email, msg.subject, redact(msg.text), ctx.email?.name ?? 'none']);
    if (!ctx.email) {
      await ctx.db.query(`UPDATE notifications SET status='skipped' WHERE id=$1`, [row!.id]);
    } else {
      try {
        await ctx.email.send({ to: n.email, subject: msg.subject, html: msg.html, text: msg.text });
        await ctx.db.query(`UPDATE notifications SET status='sent', sent_at=now() WHERE id=$1`, [row!.id]);
      } catch (err) {
        ctx.log.warn({ template: n.template, err: (err as Error).message }, 'email delivery failed');
        await ctx.db.query(`UPDATE notifications SET status='failed', error=$2 WHERE id=$1`, [row!.id, (err as Error).message.slice(0, 200)]);
      }
    }
  }
  if (n.mobile && ctx.whatsapp && n.template !== 'consultation_confirmation') {
    try {
      await ctx.whatsapp.send(n.mobile, msg.text);
      await ctx.db.query(`INSERT INTO notifications (assessment_id, channel, template, recipient, body, status, provider, sent_at) VALUES ($1,'whatsapp',$2,$3,$4,'sent',$5, now())`,
        [n.assessmentId, n.template, n.mobile, redact(msg.text), ctx.whatsapp.name]);
    } catch (err) {
      ctx.log.warn({ template: n.template, err: (err as Error).message }, 'whatsapp delivery failed');
    }
  }
}
