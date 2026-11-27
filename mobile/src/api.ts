// Small fetch wrapper for the /api/mobile/* routes.
// Contract: docs/superpowers/specs/2026-11-27-mobile-count-api.md

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** No answer from the server (no signal, server down, timeout). */
export class NetworkError extends Error {}

export type SessionStatus = 'open' | 'submitted' | 'sent_back' | 'approved';

export type Session = {
  id: number;
  status: SessionStatus;
  sendBackNote: string | null;
  startedByName: string;
  startedAt: string;
  lineCount: number;
  counters: { userId: number; name: string; done: boolean }[];
  joined: boolean;
  myDone: boolean;
};

export type AuthResult = {
  token: string;
  expiresAt: string;
  user: { id: number; name: string };
  location: { id: number; name: string };
  businessName: string;
};

export type ServerProduct = {
  variationId: number;
  productId: number;
  name: string;
  variationName: string | null;
  sku: string | null;
  subSku: string | null;
  /** Only in `?since=` refreshes: true = remove this variation from the phone. */
  deleted?: boolean;
};

export type ServerLine = {
  id: string;
  variationId: number;
  qty: number | string;
  spot: string | null;
  countedByName: string;
  countedAt: string;
};

export type ServerUnknown = {
  id: string;
  scannedCode: string | null;
  description: string;
  qty: number | string;
  countedByName: string;
  countedAt: string;
};

export type SyncBody = {
  sessionId: number;
  deviceNow: string;
  lines: {
    id: string;
    variationId: number;
    qty: number;
    spot: string | null;
    countedAt: string;
    deleted: boolean;
  }[];
  unknownItems: {
    id: string;
    scannedCode: string | null;
    description: string;
    qty: number;
    countedAt: string;
    deleted: boolean;
  }[];
};

export type SyncResult = { accepted: string[]; rejected: { id: string; error: string }[] };

export function cleanBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

async function request<T>(
  baseUrl: string,
  token: string | null,
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  let res: Response;
  try {
    res = await fetch(cleanBaseUrl(baseUrl) + path, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError('Cannot reach the server. Check the signal / Wi-Fi and the server address.');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data.error === 'string' && data.error) ||
      (res.status === 404 && !data ? 'Server address looks wrong (page not found).' : '') ||
      `Server error (${res.status}).`;
    throw new ApiError(res.status, msg, data);
  }
  if (data === null && text) {
    // HTML instead of JSON usually means a wrong base URL (e.g. a login page).
    throw new ApiError(res.status, 'The server did not answer with data. Check the server address.', null);
  }
  return data as T;
}

export const api = {
  auth: (base: string, body: { username: string; password: string; locationCode: string }) =>
    request<AuthResult>(base, null, '/api/mobile/auth', { method: 'POST', body }),

  products: (base: string, token: string, since?: string | null) =>
    request<{ serverTime: string; products: ServerProduct[] }>(
      base,
      token,
      '/api/mobile/count/products' + (since ? `?since=${encodeURIComponent(since)}` : ''),
      { timeoutMs: 90000 },
    ),

  currentSession: (base: string, token: string) =>
    request<{ session: Session | null }>(base, token, '/api/mobile/count/sessions/current'),

  startSession: (base: string, token: string) =>
    request<{ session: Session }>(base, token, '/api/mobile/count/sessions', {
      method: 'POST',
      body: {},
    }),

  join: (base: string, token: string, id: number) =>
    request<{ session: Session }>(base, token, `/api/mobile/count/sessions/${id}/join`, {
      method: 'POST',
      body: {},
    }),

  done: (base: string, token: string, id: number) =>
    request<{ session: Session }>(base, token, `/api/mobile/count/sessions/${id}/done`, {
      method: 'POST',
      body: {},
    }),

  submit: (base: string, token: string, id: number) =>
    request<{ session: Session }>(base, token, `/api/mobile/count/sessions/${id}/submit`, {
      method: 'POST',
      body: {},
    }),

  lines: (base: string, token: string, id: number) =>
    request<{ lines: ServerLine[]; unknownItems: ServerUnknown[] }>(
      base,
      token,
      `/api/mobile/count/sessions/${id}/lines`,
      { timeoutMs: 45000 },
    ),

  sync: (base: string, token: string, body: SyncBody) =>
    request<SyncResult>(base, token, '/api/mobile/count/sync', {
      method: 'POST',
      body,
      timeoutMs: 45000,
    }),
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError || e instanceof NetworkError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
