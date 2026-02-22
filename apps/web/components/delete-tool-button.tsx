"use client";

import { useTransition, useState } from "react";
import { deleteToolAction } from "@/app/configs/[id]/actions";

export function DeleteToolButton({ configId, toolName }: { configId: string; toolName: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("configId", configId);
    formData.set("toolName", toolName);

    startTransition(async () => {
      const result = await deleteToolAction(formData);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-400">Delete?</span>
        <button
          onClick={handleClick}
          disabled={isPending}
          className="text-xs px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-xs px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-50 transition-colors"
        >
          No
        </button>
        {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      title="Delete tool"
      className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      aria-label={`Delete ${toolName}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66H14.5a.5.5 0 0 0 0-1h-.994a.58.58 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92H4.885a1 1 0 0 1-.997-.92L3.042 3.5h9.916Z" />
      </svg>
    </button>
  );
}
