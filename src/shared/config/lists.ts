// Configuration-driven option lists. Edit here — no component or engine changes needed.

export const LISTS: Record<string, string[]> = {
  industries: [
    'Manufacturing — Engineering & Metals',
    'Manufacturing — Chemicals & Plastics',
    'Manufacturing — Textiles & Apparel',
    'Manufacturing — Food & Agro Processing',
    'Manufacturing — Other',
    'Trading & Distribution',
    'Retail & E-commerce',
    'Construction, Real Estate & Infrastructure',
    'Hospitality & Travel',
    'Healthcare & Wellness',
    'Education & Training',
    'IT & Software Services',
    'Professional Services',
    'Logistics & Transport',
    'Financial Services',
    'Other',
  ],
  turnover: [
    'Under ₹1 crore',
    '₹1–3 crore',
    '₹3–10 crore',
    '₹10–25 crore',
    '₹25–100 crore',
    'Above ₹100 crore',
  ],
  team_size: ['1–7', '8–20', '21–50', '51–80', '81–200', 'More than 200'],
  years: ['Less than 2 years', '2–5 years', '5–10 years', '10–20 years', 'More than 20 years'],
};

/** Source categories for marketing attribution (normalised from utm_source / source / ref). */
export const SOURCE_CATEGORIES: { id: string; label: string; match: RegExp }[] = [
  { id: 'webinar', label: 'Webinar', match: /webinar/i },
  { id: 'seminar', label: 'Seminar', match: /seminar|event|workshop/i },
  { id: 'linkedin', label: 'LinkedIn', match: /linkedin|lnkd/i },
  { id: 'meta', label: 'Meta', match: /meta|facebook|fb|instagram|ig/i },
  { id: 'referral', label: 'Referral', match: /referral|refer|partner/i },
  { id: 'website', label: 'Website', match: /website|site|organic|google|bing|seo/i },
];
