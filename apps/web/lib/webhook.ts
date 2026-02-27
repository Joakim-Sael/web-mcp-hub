type WebhookEvent = "tool.created" | "tool.updated";

interface WebhookPayload {
  event: WebhookEvent;
  configId: string;
  toolName: string;
  tool: {
    name: string;
    description: string;
    inputSchema: unknown;
    annotations?: unknown;
    execution?: unknown;
  };
  contributor: string;
  timestamp: string;
}

/**
 * Fire-and-forget webhook POST.
 * No-op if WEBHOOK_URL is not set — keeps OSS hub fully functional without a review service.
 */
export function fireWebhook(event: WebhookEvent, payload: Omit<WebhookPayload, "event" | "timestamp">): void {
  const url = process.env.WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url) return;

  const body: WebhookPayload = {
    ...payload,
    event,
    timestamp: new Date().toISOString(),
  };

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Webhook-Secret": secret } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
    .then(() => {})
    .catch((err) => console.error(`Webhook ${event} failed:`, err));
}
