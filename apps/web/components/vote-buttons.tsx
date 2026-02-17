"use client";

import { useTransition, useState, useOptimistic } from "react";
import { voteOnTool } from "@/app/configs/[id]/actions";

export function VoteButtons({
  configId,
  toolName,
  score,
  userVote,
  isAuthenticated,
}: {
  configId: string;
  toolName: string;
  score: number;
  userVote: number | null;
  isAuthenticated: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [optimistic, setOptimistic] = useOptimistic(
    { score, userVote },
    (state, newVote: number) => {
      if (state.userVote === newVote) {
        // Toggling off
        return { score: state.score - newVote, userVote: null };
      }
      // Switching or new vote
      const delta = newVote - (state.userVote ?? 0);
      return { score: state.score + delta, userVote: newVote };
    },
  );

  function handleVote(vote: number) {
    if (!isAuthenticated) {
      setError("Sign in to vote");
      return;
    }
    setError(null);

    const formData = new FormData();
    formData.set("configId", configId);
    formData.set("toolName", toolName);
    formData.set("vote", String(vote));

    startTransition(async () => {
      setOptimistic(vote);
      const result = await voteOnTool(formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`p-1 rounded transition-colors disabled:opacity-50 ${
          optimistic.userVote === 1
            ? "text-blue-400 bg-blue-500/15"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        }`}
        aria-label={`Upvote ${toolName}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4l4 5H4l4-5z" />
        </svg>
      </button>

      <span
        className={`text-xs font-medium min-w-[2ch] text-center ${
          optimistic.score > 0
            ? "text-blue-400"
            : optimistic.score < 0
              ? "text-red-400"
              : "text-zinc-500"
        }`}
      >
        {optimistic.score}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`p-1 rounded transition-colors disabled:opacity-50 ${
          optimistic.userVote === -1
            ? "text-red-400 bg-red-500/15"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        }`}
        aria-label={`Downvote ${toolName}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 12l4-5H4l4 5z" />
        </svg>
      </button>

      {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
    </div>
  );
}
