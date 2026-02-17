import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb, apiKeys } from "@web-mcp-hub/db";
import { CreateApiKeyForm } from "@/components/create-api-key-form";

export const dynamic = "force-dynamic";
import { ApiKeyList } from "@/components/api-key-list";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const db = getDb();
  const keys = await db
    .select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      label: apiKeys.label,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .orderBy(desc(apiKeys.createdAt));

  const serializedKeys = keys.map((k) => ({
    id: k.id,
    keyPrefix: k.keyPrefix,
    label: k.label,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your API keys for the MCP server.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm text-zinc-400">
          Use API keys to authenticate the MCP server. Set the key as <code>HUB_API_KEY</code> in
          your environment.
        </p>
        <CreateApiKeyForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Existing Keys</h2>
        <ApiKeyList keys={serializedKeys} />
      </section>
    </div>
  );
}
