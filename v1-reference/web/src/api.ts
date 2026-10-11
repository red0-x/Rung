import type { CodesResponse, ConfigResponse, ProfilesResponse, QueueResponse, TranscriptResponse } from './types';

const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const apiBase = BASE || window.location.origin;

export const api = {
  queue: () => request<QueueResponse>('/api/queue'),
  config: () => request<ConfigResponse>('/api/config'),
  profiles: () => request<ProfilesResponse>('/api/profiles'),
  codes: () => request<CodesResponse>('/api/dev/codes'),
  transcript: (id: string) => request<TranscriptResponse>(`/api/queue/${id}/transcript`),
  claim: (id: string) => request<{ phone: string; tel: string }>(`/api/queue/${id}/callback`, { method: 'POST' }),
  finish: (id: string) => request<{ ok: true }>(`/api/queue/${id}/done`, { method: 'POST' }),
};
