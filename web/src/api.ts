import type {
  CallersResponse,
  HistoryResponse,
  CallbackResponse,
  CodesResponse,
  DialLogResponse,
  HealthResponse,
  InsightsResponse,
  MeResponse,
  NextResponse,
  NumbersResponse,
  OrgPatch,
  OrgResponse,
  ProfilesResponse,
  PromptResponse,
  PublishResponse,
  QueueResponse,
  TranscriptResponse,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
export const apiBase = BASE || window.location.origin;

/** Set by the auth layer. Read per request so a refreshed token never restarts polls. */
let tokenGetter: () => string | null = () => null;
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    /** Full JSON error body (e.g. `claimedBy` on 409 already_claimed). */
    public body: Record<string, unknown> = {},
  ) {
    super(message || code || `HTTP ${status}`);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'network', `Can't reach the server at ${apiBase}`);
  }
  if (!res.ok) {
    let code = '';
    let message: string | undefined;
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
      code = typeof body.error === 'string' ? body.error : '';
      message = typeof body.message === 'string' ? body.message : undefined;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code || `http_${res.status}`, message || (code ? undefined : `${res.status} ${res.statusText}`), body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  me: () => request<MeResponse>('/api/me'),
  createOrg: (name: string) => request<OrgResponse>('/api/org', { method: 'POST', body: { name } }),
  org: () => request<OrgResponse>('/api/org'),
  patchOrg: (patch: OrgPatch) => request<OrgResponse>('/api/org', { method: 'PATCH', body: patch }),
  numbers: () => request<NumbersResponse>('/api/numbers'),
  claimNumber: (numberId: string) => request<OrgResponse>('/api/org/number', { method: 'POST', body: { numberId } }),
  promptPreview: (draft: OrgPatch) => request<PromptResponse>('/api/prompt-preview', { method: 'POST', body: draft }),
  publish: () => request<PublishResponse>('/api/org/publish', { method: 'POST' }),
  queue: () => request<QueueResponse>('/api/queue'),
  transcript: (id: string) => request<TranscriptResponse>(`/api/queue/${enc(id)}/transcript`),
  callback: (id: string) => request<CallbackResponse>(`/api/queue/${enc(id)}/callback`, { method: 'POST' }),
  /** Claim the top-ranked waiting caller. Undefined when nobody is waiting. */
  next: () => request<NextResponse | undefined>('/api/queue/next', { method: 'POST' }),
  done: (id: string) => request<{ ok: true }>(`/api/queue/${enc(id)}/done`, { method: 'POST' }),
  release: (id: string) => request<{ ok: true }>(`/api/queue/${enc(id)}/release`, { method: 'POST' }),
  reopen: (id: string) => request<{ ok: true }>(`/api/queue/${enc(id)}/reopen`, { method: 'POST' }),
  callers: () => request<CallersResponse>('/api/callers'),
  history: (limit = 50) => request<HistoryResponse>(`/api/history?limit=${limit}`),
  insights: (refresh = false) => request<InsightsResponse>(`/api/insights${refresh ? '?refresh=1' : ''}`),
  profiles: () => request<ProfilesResponse>('/api/profiles'),
  codes: () => request<CodesResponse>('/api/dev/codes'),
  dialLog: () => request<DialLogResponse>('/api/dev/dial-log'),
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const known: Record<string, string> = {
      network: `Can't reach the server at ${apiBase}.`,
      unauthorized: 'Your session expired. Sign in again.',
      no_org: 'Set up your company first.',
      not_found: 'That item no longer exists.',
      number_taken: 'Someone just claimed that number. Pick another.',
      no_number: 'Claim a phone number before publishing.',
      already_member: 'You already belong to a company.',
      not_in_progress: 'That callback was already finished or cancelled.',
      not_done: 'That call is no longer marked done.',
      already_claimed: 'A teammate is already calling them.',
      not_claimer: "That's a teammate's callback. Only they or an admin can finish or cancel it.",
      at_capacity: 'Finish your current callback first.',
      not_queued: 'That caller is no longer waiting.',
      invalid: 'Some settings are not valid.',
    };
    const base = known[err.code] ?? err.message;
    return err.message && known[err.code] && err.message !== err.code ? `${base} ${err.message}` : base;
  }
  return err instanceof Error ? err.message : String(err);
}
