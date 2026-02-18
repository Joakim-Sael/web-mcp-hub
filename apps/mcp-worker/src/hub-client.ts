import type { WebMcpConfig, ConfigListResponse } from "@web-mcp-hub/db";

export interface HubClientOptions {
  hubUrl: string;
  apiKey?: string;
}

async function hubFetch(
  path: string,
  opts: HubClientOptions,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const method = init?.method?.toUpperCase();
  if (opts.apiKey && (method === "POST" || method === "PATCH")) {
    headers["Authorization"] = `Bearer ${opts.apiKey}`;
  }
  return fetch(`${opts.hubUrl}${path}`, { ...init, headers });
}

export async function lookupConfig(
  domain: string,
  url: string | undefined,
  filter: { executable?: boolean } | undefined,
  opts: HubClientOptions,
): Promise<{ configs: WebMcpConfig[] }> {
  const params = new URLSearchParams({ domain });
  if (url) params.set("url", url);
  if (filter?.executable) params.set("executable", "true");
  const res = await hubFetch(`/api/configs/lookup?${params}`, opts);
  return res.json() as Promise<{ configs: WebMcpConfig[] }>;
}

export async function listConfigs(
  filter: { search?: string; tag?: string; page?: number; pageSize?: number } | undefined,
  opts: HubClientOptions,
): Promise<ConfigListResponse> {
  const params = new URLSearchParams();
  if (filter?.search) params.set("search", filter.search);
  if (filter?.tag) params.set("tag", filter.tag);
  if (filter?.page) params.set("page", String(filter.page));
  if (filter?.pageSize) params.set("pageSize", String(filter.pageSize));
  const qs = params.toString();
  const res = await hubFetch(`/api/configs${qs ? `?${qs}` : ""}`, opts);
  return res.json() as Promise<ConfigListResponse>;
}

export async function uploadConfig(
  data: Record<string, unknown>,
  opts: HubClientOptions,
): Promise<{ config?: WebMcpConfig; error?: string; existingId?: string; status: number }> {
  const res = await hubFetch("/api/configs", opts, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (res.status === 409) {
    return {
      error: (body as { error?: string }).error,
      existingId: (body as { existingId?: string }).existingId,
      status: 409,
    };
  }
  if (!res.ok) {
    return { error: JSON.stringify((body as { error?: string }).error), status: res.status };
  }
  return { config: body as WebMcpConfig, status: 201 };
}

export async function updateConfig(
  id: string,
  data: Record<string, unknown>,
  opts: HubClientOptions,
): Promise<{ config?: WebMcpConfig; error?: string; status: number }> {
  const res = await hubFetch(`/api/configs/${id}`, opts, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: JSON.stringify((body as { error?: string }).error), status: res.status };
  }
  return { config: body as WebMcpConfig, status: 200 };
}

export interface VoteResult {
  configId: string;
  toolName: string;
  score: number;
  userVote: number | null;
}

export async function voteOnTool(
  configId: string,
  toolName: string,
  vote: number,
  opts: HubClientOptions,
): Promise<{ result?: VoteResult; error?: string; status: number }> {
  const res = await hubFetch(`/api/configs/${configId}/vote`, opts, {
    method: "POST",
    body: JSON.stringify({ toolName, vote }),
  });
  const body = await res.json();
  if (!res.ok) {
    return {
      error: (body as { error?: string }).error ?? JSON.stringify(body),
      status: res.status,
    };
  }
  return { result: body as VoteResult, status: 200 };
}
