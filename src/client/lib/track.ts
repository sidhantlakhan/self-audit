import { api } from './api.ts';
import { readAttribution } from './attribution.ts';

/** Anonymous site events (no personal data). Failures are silent — analytics must never break the product. */
export function trackEvent(event: 'landing_view' | 'cta_clicked', props?: Record<string, string>) {
  const a = readAttribution();
  void api('/api/events', { method: 'POST', body: { event, visitorId: a?.visitorId, touch: a?.latestTouch, referrer: a?.referrer, props }, keepalive: true }).catch(() => undefined);
}
