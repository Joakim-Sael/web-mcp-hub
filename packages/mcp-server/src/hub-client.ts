import type { WebMcpConfig, ConfigListResponse } from "@web-mcp-hub/db";

const HUB_BASE = process.env.HUB_URL ?? "http://localhost:3000";
const HUB_API_KEY = process.env.HUB_API_KEY;

async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...init?.headers } as Record<string, string>;
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  if (HUB_API_KEY) {
    headers["Authorization"] = `Bearer ${HUB_API_KEY}`;
  }
  return fetch(`${HUB_BASE}${path}`, { ...init, headers });
}

export async function lookupConfig(
  domain: string,
  url?: string,
  opts?: { executable?: boolean; yolo?: boolean },
): Promise<{ configs: WebMcpConfig[] }> {
  const params = new URLSearchParams({ domain });
  if (url) params.set("url", url);
  if (opts?.executable) params.set("executable", "true");
  if (opts?.yolo) params.set("yolo", "true");
  const res = await hubFetch(`/api/configs/lookup?${params}`);
  return res.json() as Promise<{ configs: WebMcpConfig[] }>;
}

export async function listConfigs(opts?: {
  search?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  yolo?: boolean;
}): Promise<ConfigListResponse> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.tag) params.set("tag", opts.tag);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.yolo) params.set("yolo", "true");
  const qs = params.toString();
  const res = await hubFetch(`/api/configs${qs ? `?${qs}` : ""}`);
  return res.json() as Promise<ConfigListResponse>;
}

export async function uploadConfig(
  data: Record<string, unknown>,
): Promise<{ config?: WebMcpConfig; error?: string; existingId?: string; status: number }> {
  const res = await hubFetch("/api/configs", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (res.status === 409) {
    return {
      error: body.error,
      existingId: body.existingId,
      status: 409,
    };
  }
  if (!res.ok) {
    return { error: JSON.stringify(body.error), status: res.status };
  }
  return { config: body as WebMcpConfig, status: 201 };
}

export async function updateConfig(
  id: string,
  data: Record<string, unknown>,
): Promise<{ config?: WebMcpConfig; error?: string; status: number }> {
  const res = await hubFetch(`/api/configs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: JSON.stringify(body.error), status: res.status };
  }
  return { config: body as WebMcpConfig, status: 200 };
}

export interface VoteResult {
  configId: string;
  toolName: string;
  score: number;
  userVote: number | null;
}

export async function deleteTool(
  configId: string,
  toolName: string,
): Promise<{ config?: WebMcpConfig; error?: string; status: number }> {
  const res = await hubFetch(`/api/configs/${configId}/tools/${encodeURIComponent(toolName)}`, {
    method: "DELETE",
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: body.error ?? JSON.stringify(body), status: res.status };
  }
  return { config: body as WebMcpConfig, status: 200 };
}

export async function voteOnTool(
  configId: string,
  toolName: string,
  vote: number,
): Promise<{ result?: VoteResult; error?: string; status: number }> {
  const res = await hubFetch(`/api/configs/${configId}/vote`, {
    method: "POST",
    body: JSON.stringify({ toolName, vote }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: body.error ?? JSON.stringify(body), status: res.status };
  }
  return { result: body as VoteResult, status: 200 };
}
