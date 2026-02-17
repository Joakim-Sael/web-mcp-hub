import Link from "next/link";
import Image from "next/image";
import { getLeaderboard } from "@/lib/db";

export const dynamic = "force-dynamic";

function rankColor(rank: number): string {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-zinc-300";
  if (rank === 3) return "text-amber-600";
  return "text-zinc-500";
}

export default async function LeaderboardPage() {
  const entries = await getLeaderboard(50);

  return (
    <section className="max-w-6xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold text-white mb-1">Contributor Leaderboard</h1>
      <p className="text-zinc-400 mb-8">Top contributors ranked by number of configs and tools.</p>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 mb-4">No contributors yet.</p>
          <Link
            href="/contribute"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Be the first contributor
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.contributor}
              className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg"
            >
              <span
                className={`text-lg font-bold w-8 text-center shrink-0 ${rankColor(entry.rank)}`}
              >
                {entry.rank}
              </span>

              {entry.image ? (
                <Image
                  src={entry.image}
                  alt={entry.contributor}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-sm shrink-0">
                  {entry.contributor.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="flex-1 min-w-0">
                <a
                  href={`https://github.com/${entry.contributor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white font-semibold hover:text-blue-400 transition-colors"
                >
                  {entry.contributor}
                </a>
              </div>

              <div className="flex gap-4 text-sm text-zinc-400 shrink-0">
                <span>
                  {entry.configCount} config{entry.configCount !== 1 ? "s" : ""}
                </span>
                <span>
                  {entry.toolCount} tool{entry.toolCount !== 1 ? "s" : ""}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
