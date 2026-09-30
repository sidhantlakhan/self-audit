import "server-only";
import { Resend } from "resend";
import { bandFor, normaliseMobile } from "@/lib/scorecard";
import { site } from "@/config/site";
import type { Scorecard } from "./db";

export interface Delivery {
  whatsapp: boolean;
  email: boolean;
  errors: string[];
}

/**
 * WhatsApp Cloud API. Business-initiated messages must use an approved
 * template; ours has a document header (the PDF) and two body variables:
 * {{1}} first name, {{2}} score out of 100.
 */
async function sendWhatsApp(sc: Scorecard, pdfUrl: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneId || !template) throw new Error("WhatsApp is not configured.");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const firstName = sc.details.name.trim().split(/\s+/)[0] || "there";

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `91${normaliseMobile(sc.details.wa)}`,
      type: "template",
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [
          {
            type: "header",
            parameters: [{ type: "document", document: { link: pdfUrl, filename: "AI-Readiness-Scorecard.pdf" } }],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: firstName },
              { type: "text", text: String(sc.total ?? "") },
            ],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

let resend: Resend | null = null;

async function sendEmail(to: string, subject: string, html: string, pdf?: Buffer): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Email is not configured.");
  resend ??= new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    replyTo: site.contactEmail,
    attachments: pdf ? [{ filename: "AI-Readiness-Scorecard.pdf", content: pdf }] : undefined,
  });
  if (error) throw new Error(`Email: ${error.message}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function wrap(body: string) {
  return `<div style="font-family:Mulish,Arial,sans-serif;color:#241B14;max-width:560px;line-height:1.6;font-size:15px">${body}
<p style="color:#6B5A4D;font-size:13px;margin-top:24px">${site.company}, ${site.city} · ${esc(site.contactEmail)} · ${esc(site.contactPhone)}</p></div>`;
}

/** Sends the finished report on every configured channel. */
export async function deliverReport(sc: Scorecard, pdf: Buffer, pdfUrl: string, resultUrl: string): Promise<Delivery> {
  const out: Delivery = { whatsapp: false, email: false, errors: [] };
  const firstName = sc.details.name.trim().split(/\s+/)[0];
  const band = sc.total != null ? bandFor(sc.total).label : "";

  await Promise.all([
    sendWhatsApp(sc, pdfUrl).then(
      () => void (out.whatsapp = true),
      (e: Error) => void out.errors.push(e.message),
    ),
    sendEmail(
      sc.details.email,
      `Your AI-Readiness Scorecard: ${sc.total}/100`,
      wrap(`<p>Dear ${esc(firstName)},</p>
<p>Your AI-Readiness score for ${esc(sc.details.biz)} is <strong>${sc.total}/100 · ${esc(band)}</strong>. Your full report is attached as a PDF.</p>
<p><a href="${esc(resultUrl)}" style="color:#C24000;font-weight:700">Open your report online</a></p>
<p>Scores are calculated by fixed rules. AI only writes the explanations and recommendations.</p>`),
      pdf,
    ).then(
      () => void (out.email = true),
      (e: Error) => void out.errors.push(e.message),
    ),
  ]);
  return out;
}

/** "Save and exit": emails a link that resumes the Scorecard on any device. */
export async function sendResumeLink(to: string, name: string, resumeUrl: string): Promise<void> {
  await sendEmail(
    to,
    "Pick up your AI-Readiness Scorecard where you left off",
    wrap(`<p>Dear ${esc(name.trim().split(/\s+/)[0] || "there")},</p>
<p>Your answers are saved. Use this link to continue from where you stopped:</p>
<p><a href="${esc(resumeUrl)}" style="color:#C24000;font-weight:700">Continue my Scorecard</a></p>`),
  );
}
