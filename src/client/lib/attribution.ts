import { store } from './storage.ts';

const KEY = 'aird.attr';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'source', 'medium', 'campaign', 'content', 'ref'];

export interface Attribution {
  visitorId: string;
  firstTouch: Record<string, string>;
  latestTouch: Record<string, string>;
  landingUrl: string;
  referrer: string;
  firstSeenAt: string;
}

const rid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function readAttribution(): Attribution | null {
  try { return JSON.parse(store.get(KEY) ?? 'null'); } catch { return null; }
}

/**
 * Called on every page load. Marketing parameters are persisted so they survive navigation between pages
 * (landing → intake → assessment), and are sent to the server when the assessment is created.
 * First touch is never overwritten; latest touch updates whenever new parameters arrive.
 */
export function captureAttribution(): Attribution {
  const prev = readAttribution();
  const q = new URLSearchParams(location.search);
  const touch: Record<string, string> = {};
  for (const p of PARAMS) { const v = q.get(p); if (v) touch[p] = v.slice(0, 120); }
  const has = Object.keys(touch).length > 0;
  const external = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '';
  const next: Attribution = prev ?? {
    visitorId: rid(), firstTouch: touch, latestTouch: touch, landingUrl: location.href.split('#')[0], referrer: external, firstSeenAt: new Date().toISOString(),
  };
  if (prev) {
    if (has) {
      if (!Object.keys(prev.firstTouch).length) next.firstTouch = touch;
      next.latestTouch = touch;
    }
    if (!prev.referrer && external) next.referrer = external;
  }
  store.set(KEY, JSON.stringify(next));
  return next;
}
