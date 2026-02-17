"use client";

import { useState, useTransition } from "react";
import { createApiKey } from "@/app/settings/actions";

export function CreateApiKeyForm() {
  const [isPending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setNewKey(null);
    startTransition(async () => {
      const result = await createApiKey(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.key) {
        setNewKey(result.key);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="flex gap-3">
        <input
          name="label"
          placeholder="Key label (e.g. MCP Server)"
          required
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-200 border border-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create API Key"}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {newKey && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg space-y-2">
          <p className="text-yellow-200 text-sm font-medium">
            Save this key now — you won&apos;t see it again!
          </p>
          <code className="block p-2 bg-zinc-900 rounded text-sm text-zinc-100 break-all select-all">
            {newKey}
          </code>
        </div>
      )}
    </div>
  );
}
