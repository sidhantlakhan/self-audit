import { SOURCE_CATEGORIES } from '../../shared/config/index.ts';

export interface Touch {
  source?: string; medium?: string; campaign?: string; content?: string; term?: string; ref?: string;
}

const clean = (v: unknown, max = 120): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max).replace(/[\u0000-\u001f\u007f]/g, '');
  return t || undefined;
};

/** Accepts both utm_* and the short aliases (source, medium, campaign, content, ref). */
export function parseTouch(input: Record<string, unknown>): Touch {
  return {
    source: clean(input.utm_source ?? input.source),
    medium: clean(input.utm_medium ?? input.medium),
    campaign: clean(input.utm_campaign ?? input.campaign),
    content: clean(input.utm_content ?? input.content),
    term: clean(input.utm_term ?? input.term),
    ref: clean(input.ref),
  };
}

export const hasTouch = (t: Touch): boolean => Object.values(t).some(Boolean);

export function categorise(t: Touch, referrer?: string): string {
  const hay = [t.source, t.medium, t.ref].filter(Boolean).join(' ');
  if (hay) for (const c of SOURCE_CATEGORIES) if (c.match.test(hay)) return c.id;
  if (hay) return 'other';
  if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      for (const c of SOURCE_CATEGORIES) if (c.match.test(host)) return c.id;
      return 'referral';
    } catch { /* ignore */ }
  }
  return 'direct';
}

export function deviceFromUA(ua: string | undefined): 'mobile' | 'tablet' | 'desktop' {
  const s = ua ?? '';
  if (/iPad|Tablet/i.test(s)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(s)) return 'mobile';
  return 'desktop';
}
