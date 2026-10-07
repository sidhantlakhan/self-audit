import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { ScoreResult } from '../../shared/types.ts';
import { BAND_MOON, moonPath } from '../../shared/moon.ts';
import type { Analysis } from '../ai/schema.ts';

export const REPORT_VERSION = 'v1';

export interface ReportData {
  assessmentId: string; // public id
  generatedAt: Date;
  respondentName: string;
  businessName: string;
  role: string;
  industry: string;
  businessModel: string[];
  turnoverRange: string;
  teamSize: string;
  yearsInOperation: string;
  completedAt: Date;
  score: ScoreResult;
  analysis: Analysis;
  bandDefs: { id: string; label: string; min: number; max: number }[];
  bookingUrl: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

let fontCss: string | null = null;
/** Mulish is embedded so the PDF renders identically on any server, with no network access. */
function fonts(): string {
  if (fontCss) return fontCss;
  const req = createRequire(import.meta.url);
  const faces: string[] = [];
  for (const [subset, range] of [['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'], ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF']] as const) {
    for (const w of [400, 600, 700, 800]) {
      const file = req.resolve(`@fontsource/mulish/files/mulish-${subset}-${w}-normal.woff2`);
      const b64 = readFileSync(file).toString('base64');
      faces.push(`@font-face{font-family:'Mulish';font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`);
    }
  }
  return (fontCss = faces.join('\n'));
}

const moon = (fraction: number, size = 22, stroke = '#C24000', fill = '#F5A020') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="${stroke}" stroke-width="1.4"/><path d="${moonPath(fraction)}" fill="${fill}"/></svg>`;

function gauge(score: number, size = 190): string {
  const r = 52, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, score)) / 100;
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Score ${score} out of 100">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#EADBC8" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#E8650A" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="64" text-anchor="middle" font-family="Mulish" font-size="34" font-weight="800" fill="#C24000">${score}</text>
    <text x="60" y="82" text-anchor="middle" font-family="Mulish" font-size="10" font-weight="700" fill="#6B5A4D">out of 100</text></svg>`;
}

const bar = (score: number) =>
  `<div class="bar"><div class="fill" style="width:${Math.max(2, Math.round(score))}%"></div></div>`;

const STRENGTH = { strong: 'Strong signal', moderate: 'Moderate signal', emerging: 'Emerging signal' } as const;

function page(n: number, title: string, body: string, data: ReportData): string {
  return `<section class="page"><header class="ph"><div class="brand">${moon(0.55, 20)}<span>AI Readiness Diagnostic</span></div><div class="meta">${esc(data.businessName)}</div></header>
  <h2>${esc(title)}</h2>${body}<footer class="pf"><span>Assessment ${esc(data.assessmentId)} · ${esc(fmtDate(data.completedAt))}</span><span class="pn"></span></footer></section>`;
}

/** Renders the diagnostic report as a self-contained, A4, print-ready HTML document. */
export function renderReportHtml(d: ReportData): string {
  const s = d.score;
  const a = d.analysis;
  const dimLabel = new Map(s.dimensions.map((x) => [x.dimension as string, x]));
  const bandIdx = d.bandDefs.findIndex((b) => b.id === s.band.id);

  const p1 = `
    <div class="hero">
      <div class="gauge">${gauge(s.overallRounded)}</div>
      <div><div class="eyebrow">Current AI readiness</div><div class="bandname">${moon(BAND_MOON[s.band.id] ?? 0.5, 30)}<span>${esc(s.band.label)}</span></div><p class="muted">${esc(s.band.summary)}</p></div>
    </div>
    <h3>Executive assessment</h3><p class="lead">${esc(a.executive_assessment)}</p>
    <div class="idcard"><div><b>Prepared for</b>${esc(d.respondentName)}, ${esc(d.role)}</div><div><b>Business</b>${esc(d.businessName)}</div><div><b>Industry</b>${esc(d.industry)}</div><div><b>Assessed on</b>${esc(fmtDate(d.completedAt))}</div></div>
    <p class="note">This is a business diagnostic. It describes the current condition of the business and where AI appears relevant. It does not prescribe solutions; those are discussed in a consultation.</p>`;

  const p2 = `
    <div class="scale">${d.bandDefs.map((b, i) => `<div class="seg ${i === bandIdx ? 'on' : ''}"><div class="sl">${esc(b.label)}</div><div class="sr">${b.min}–${b.max}</div></div>`).join('')}</div>
    <p>${esc(a.readiness_interpretation)}</p>
    <h3>Five readiness dimensions</h3>
    ${a.dimension_insights.map((di) => { const dim = dimLabel.get(di.dimension)!; const sc = Math.round(dim.score); return `<div class="dim"><div class="dh"><b>${esc(dim.label)}</b><span>${sc} / 100</span></div>${bar(sc)}<p class="small">${esc(di.insight)}</p></div>`; }).join('')}`;

  const p3 = `
    <p class="muted">Areas where the answers indicate the weakest foundations, with the evidence behind each.</p>
    ${a.key_readiness_gaps.map((g, i) => `<div class="card"><div class="cn">${i + 1}</div><div><h4>${esc(g.title)}</h4><p class="small"><b>Evidence.</b> ${esc(g.evidence)}</p><p class="small"><b>Why it matters.</b> ${esc(g.why_it_matters)}</p></div></div>`).join('')}`;

  const p4 = `
    <div class="twin"><div class="box"><div class="eyebrow">Readiness</div><div class="big">${s.overallRounded}<small> / 100</small></div><div class="small">${esc(s.band.label)}</div></div>
    <div class="box"><div class="eyebrow">Opportunity relevance</div><div class="big sm">${esc(s.opportunity.label.replace(' relevance', ''))}</div><div class="small">${s.opportunity.areas.length} area${s.opportunity.areas.length === 1 ? '' : 's'} signalled</div></div></div>
    <p class="muted">Readiness and opportunity are assessed separately: <b>${esc(s.profile.label)}</b>.</p>
    <h3>Potential AI opportunity areas</h3>
    ${a.ai_opportunity_areas.length ? a.ai_opportunity_areas.map((o) => {
      const sig = s.opportunity.areas.find((x) => x.label.toLowerCase() === o.area.toLowerCase());
      return `<div class="card"><div class="cn">${moon(0.5, 18)}</div><div><h4>${esc(o.area)}${sig ? `<span class="tag">${STRENGTH[sig.strength]}</span>` : ''}</h4><p class="small">${esc(o.rationale)}</p><p class="small"><b>Readiness note.</b> ${esc(o.readiness_note)}</p></div></div>`;
    }).join('') : '<p class="small">The answers did not provide enough signal to identify specific opportunity areas.</p>'}
    <div class="intent"><b>AI adoption intent</b> (stated, not a readiness measure): ${esc(s.adoptionIntent.label)}${s.adoptionIntent.rating ? ` — ${s.adoptionIntent.rating} of 5` : ''}</div>`;

  const p5 = `
    <h3>Business context</h3>
    <table class="kv"><tr><td>Industry</td><td>${esc(d.industry)}</td></tr><tr><td>Business model</td><td>${esc(d.businessModel.join(', '))}</td></tr><tr><td>Annual turnover</td><td>${esc(d.turnoverRange)}</td></tr><tr><td>Team size</td><td>${esc(d.teamSize)}</td></tr><tr><td>Years in operation</td><td>${esc(d.yearsInOperation)}</td></tr></table>
    <h3>Diagnostic observations</h3>
    <ul>${a.business_context_observations.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
    <h3>Founder dependency <span class="tag">${esc(s.founderDependency.label)}</span></h3>
    <p class="small">${esc(a.founder_dependency_insight)}</p>
    ${s.founderDependency.signals.length ? `<ul class="small">${s.founderDependency.signals.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;

  const p6 = `
    <table class="grid"><thead><tr><th>Dimension</th><th>Weight</th><th>Score</th></tr></thead><tbody>
    ${s.dimensions.map((x) => `<tr><td>${esc(x.label)}</td><td>${Math.round(x.weight * 100)}%</td><td><b>${Math.round(x.score)}</b> / 100</td></tr>`).join('')}
    <tr class="tot"><td>Overall AI readiness</td><td>100%</td><td><b>${s.overallRounded}</b> / 100 — ${esc(s.band.label)}</td></tr></tbody></table>
    <h3>Readiness bands</h3>
    <table class="grid"><tbody>${d.bandDefs.map((b) => `<tr class="${b.id === s.band.id ? 'cur' : ''}"><td>${esc(b.label)}</td><td>${b.min}–${b.max}</td></tr>`).join('')}</tbody></table>
    <h3>How to read this report</h3>
    <p class="small">Scores are calculated from your structured answers using fixed rules and weights. The same answers always produce the same score. Artificial intelligence is used only to interpret the results in the context of your business; it does not set or change any score. Where the answers did not provide enough information, the report says so rather than assuming.</p>
    <p class="small">Report generated on ${esc(fmtDate(d.generatedAt))}. Diagnostic framework ${esc(s.assessmentVersion)}, report format ${esc(REPORT_VERSION)}.</p>`;

  const p7 = `
    <p class="lead">This diagnostic describes where the business stands. What it means in practice, and what to do about it, is best discussed with someone who can see the full picture.</p>
    <h3>Suggested topics for the consultation</h3>
    <ul>${a.consultation_focus_areas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <div class="cta"><div><div class="ct">Book Consultation</div><div class="cs">Bring this report. Your answers will be available to the consultant in advance.</div></div><a href="${esc(d.bookingUrl)}">Book Consultation</a></div>
    <p class="small muted">${esc(d.bookingUrl)}</p>`;

  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>AI Readiness Diagnostic — ${esc(d.businessName)}</title><meta name="robots" content="noindex">
<style>${fonts()}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Mulish';color:#241B14;font-size:10.5pt;line-height:1.55;background:#fff;counter-reset:pg}
.page{width:210mm;height:297mm;padding:16mm 18mm 20mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;counter-increment:pg;background:#fff}
.page:last-child{page-break-after:auto;break-after:auto}
.ph{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #F5A020;padding-bottom:8px;margin-bottom:14px;font-size:9pt;font-weight:700;color:#6B5A4D}
.brand{display:flex;align-items:center;gap:8px;color:#C24000;font-weight:800;font-size:10pt}
h2{font-size:22pt;line-height:1.15;font-weight:800;color:#C24000;margin:0 0 12px;letter-spacing:-.02em}
h3{font-size:12.5pt;font-weight:800;color:#241B14;margin:16px 0 6px}
h4{font-size:11pt;font-weight:800;margin:0 0 4px;color:#241B14}
p{margin:0 0 8px}.lead{font-size:12pt;line-height:1.55;font-weight:600}.small{font-size:9.6pt}.muted{color:#6B5A4D}
.note{font-size:9pt;color:#6B5A4D;border-left:3px solid #F5A020;padding-left:10px;margin-top:14px}
.pf{position:absolute;left:18mm;right:18mm;bottom:9mm;display:flex;justify-content:space-between;font-size:8.5pt;color:#6B5A4D;border-top:1px solid #EADBC8;padding-top:6px}
.pn::after{content:"Page " counter(pg)}
.hero{display:flex;gap:22px;align-items:center;background:#FFFAF3;border:1px solid #EADBC8;border-radius:14px;padding:16px 20px;margin-bottom:6px}
.eyebrow{font-size:8.5pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6B5A4D}
.bandname{display:flex;align-items:center;gap:10px;font-size:24pt;font-weight:800;color:#C24000;margin:4px 0}
.idcard{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin-top:14px;font-size:9.6pt}.idcard b{display:block;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:#6B5A4D}
.scale{display:flex;gap:4px;margin-bottom:12px}.seg{flex:1;text-align:center;padding:7px 2px;border:1px solid #EADBC8;border-radius:8px;background:#FFFAF3}.seg.on{background:#F5A020;border-color:#E8650A}.sl{font-weight:800;font-size:9.5pt}.sr{font-size:8.5pt;color:#6B5A4D}.seg.on .sr{color:#241B14}
.dim{margin-bottom:9px}.dh{display:flex;justify-content:space-between;font-size:10.5pt}.dh span{font-weight:800;color:#C24000}
.bar{height:9px;background:#EADBC8;border-radius:5px;margin:4px 0 4px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#F5A020,#E8650A);border-radius:5px}
.card{display:flex;gap:12px;border:1px solid #EADBC8;border-radius:12px;padding:10px 14px;margin-bottom:9px;background:#fff;break-inside:avoid}
.cn{flex:none;width:26px;height:26px;border-radius:50%;background:#FDF4E3;color:#C24000;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:10.5pt}
.card p{margin:0 0 3px}
.tag{display:inline-block;margin-left:8px;font-size:8pt;font-weight:800;background:#FDF4E3;color:#B7791F;border:1px solid #F5A020;border-radius:999px;padding:1px 8px;vertical-align:middle;letter-spacing:.02em}
.twin{display:flex;gap:12px;margin-bottom:10px}.box{flex:1;background:#FFFAF3;border:1px solid #EADBC8;border-radius:12px;padding:12px 16px}.big{font-size:26pt;font-weight:800;color:#C24000;line-height:1.1}.big small{font-size:11pt;color:#6B5A4D}.big.sm{font-size:17pt}
.intent{margin-top:12px;background:#FFFAF3;border:1px dashed #E8650A;border-radius:10px;padding:8px 12px;font-size:9.6pt}
table{border-collapse:collapse;width:100%}.kv td{padding:5px 0;border-bottom:1px solid #EADBC8;font-size:10pt}.kv td:first-child{width:38%;color:#6B5A4D;font-weight:700}
.grid th,.grid td{padding:6px 8px;border-bottom:1px solid #EADBC8;text-align:left;font-size:10pt}.grid th{font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:#6B5A4D;background:#FFFAF3}
.tot td{background:#FDF4E3;font-weight:700}.cur td{background:#FDF4E3;font-weight:800;color:#C24000}
ul{margin:0 0 8px;padding-left:18px}li{margin-bottom:4px}
.cta{margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:16px;background:#15120D;color:#FFFAF3;border-radius:16px;padding:20px 24px}
.ct{font-size:17pt;font-weight:800;color:#F5A020}.cs{font-size:9.6pt;opacity:.85;margin-top:3px}
.cta a{background:#F5A020;color:#15120D;font-weight:800;text-decoration:none;padding:11px 20px;border-radius:10px;white-space:nowrap}
</style></head><body>
${page(1, 'Executive Assessment', p1, d)}
${page(2, 'AI Readiness Profile', p2, d)}
${page(3, 'Readiness Gaps', p3, d)}
${page(4, 'AI Opportunity Profile', p4, d)}
${page(5, 'Business Context & Observations', p5, d)}
${page(6, 'Assessment Summary', p6, d)}
${page(7, 'Next Step', p7, d)}
</body></html>`;
}
