import type { Application, ApplicationSummary, GenerateInput, Settings } from '../../shared/schema';
async function request<T>(url: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(`/api${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || `Request failed (${response.status}).`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const api = {
  settings: () => request<Settings>('/settings'),
  applications: () => request<ApplicationSummary[]>('/applications'),
  application: (id: string) => request<Application>(`/applications/${id}`),
  generate: (input: GenerateInput) => request<Application>('/applications', input),
  revise: (id: string, instructions: string, model: string, version: number, coverLetterPersonalisation?: string) => request<Application>(`/applications/${id}/revise`, { instructions, model, version, coverLetterPersonalisation }),
  regenerate: (id: string, model: string, version: number, coverLetterPersonalisation?: string) => request<Application>(`/applications/${id}/regenerate`, { model, version, coverLetterPersonalisation }),
  delete: (id: string, version: number) => request<void>(`/applications/${id}`, { version }, 'DELETE'),
};
