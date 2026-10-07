// Per-browser convenience storage. Always wrapped: it can throw or be empty (private windows, blocked storage).
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export const store = {
  get: (k: string): string | null => safe(() => localStorage.getItem(k), null),
  set: (k: string, v: string) => safe(() => localStorage.setItem(k, v), undefined),
  del: (k: string) => safe(() => localStorage.removeItem(k), undefined),
};

const TOKENS = 'aird.tokens';
const LAST = 'aird.last';

function tokens(): Record<string, string> {
  return safe(() => JSON.parse(store.get(TOKENS) ?? '{}') as Record<string, string>, {});
}
export const getToken = (id: string): string | null => tokens()[id] ?? null;
export function saveToken(id: string, token: string) {
  const t = tokens();
  t[id] = token;
  store.set(TOKENS, JSON.stringify(t));
  store.set(LAST, id);
}
export function forgetToken(id: string) {
  const t = tokens();
  delete t[id];
  store.set(TOKENS, JSON.stringify(t));
  if (store.get(LAST) === id) store.del(LAST);
}
export const lastAssessmentId = (): string | null => {
  const id = store.get(LAST);
  return id && getToken(id) ? id : null;
};

// Unsaved answers survive a closed tab or a dropped connection.
export const pendingKey = (id: string) => `aird.pending.${id}`;
export const readPending = (id: string): Record<string, unknown> => safe(() => JSON.parse(store.get(pendingKey(id)) ?? '{}'), {});
export const writePending = (id: string, v: Record<string, unknown>) => {
  if (Object.keys(v).length) store.set(pendingKey(id), JSON.stringify(v)); else store.del(pendingKey(id));
};
