export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
  /** No response at all: offline, DNS, CORS, server down. */
  get isNetwork() { return this.status === 0; }
}

let adminCsrf: string | null = null;
export const setAdminCsrf = (t: string | null) => { adminCsrf = t; };

interface Opts { method?: string; body?: unknown; token?: string | null; keepalive?: boolean; signal?: AbortSignal }

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (path.startsWith('/api/admin') && adminCsrf && opts.method && opts.method !== 'GET') headers['X-CSRF-Token'] = adminCsrf;
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, keepalive: opts.keepalive, signal: opts.signal, credentials: 'same-origin' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'network', 'We could not reach the server.');
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Something went wrong.', data?.error?.details);
  return data as T;
}
