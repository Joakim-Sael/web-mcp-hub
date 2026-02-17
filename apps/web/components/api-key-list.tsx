"use client";

import { useTransition, useState } from "react";
import { deleteApiKey } from "@/app/settings/actions";

interface ApiKey {
  id: string;
  keyPrefix: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeyList({ keys }: { keys: ApiKey[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(keyId: string) {
    const formData = new FormData();
    formData.set("keyId", keyId);
    startTransition(async () => {
      await deleteApiKey(formData);
      setConfirmId(null);
    });
  }

  if (keys.length === 0) {
    return <p className="text-zinc-500 text-sm">No API keys yet.</p>;
  }

  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <div
          key={key.id}
          className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{key.label}</span>
              <code className="text-xs text-zinc-500">{key.keyPrefix}...</code>
            </div>
            <div className="text-xs text-zinc-500">
              Created {new Date(key.createdAt).toLocaleDateString()}
              {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
            </div>
          </div>
          <div>
            {confirmId === key.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Delete?</span>
                <button
                  onClick={() => handleDelete(key.id)}
                  disabled={isPending}
                  className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-900 text-red-300 rounded border border-red-800 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-xs px-2 py-1 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(key.id)}
                className="text-xs px-2 py-1 text-zinc-400 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
