import Link from "next/link";
import { listConfigs, getStats, getLeaderboard, getConfigVoteSummaries } from "@/lib/db";
import { IntegrationTabs } from "@/components/integration-tabs";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageSize = 20;

  const [{ configs, total }, stats, { configs: featured }, topContributors] = await Promise.all([
    listConfigs({ search: search || undefined, page, pageSize }),
    getStats(),
    listConfigs({ pageSize: 4 }),
    getLeaderboard(5),
  ]);

  const allConfigIds = [
    ...new Set([...configs.map((c) => c.id), ...featured.map((c) => c.id)]),
  ];
  const voteScores = await getConfigVoteSummaries(allConfigIds);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 mb-6">
              Open standard. Agent-ready.
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              WebMCP Hub, the config registry for smart&nbsp;agents.
            </h1>
            <p className="text-zinc-400 text-lg mb-8 max-w-lg">
              Community-contributed WebMCP configurations. Teach AI agents how to interact with any
              website. No scraping, just structured tools.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contribute"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Contribute a config
              </Link>
              <a
                href="#browse"
                className="px-5 py-2.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700 font-medium"
              >
                Browse configs
              </a>
            </div>
          </div>

          <IntegrationTabs />
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-center gap-10">
          <div className="text-center">
            <span className="text-2xl font-bold text-white">{stats.totalUsers}</span>
            <span className="block text-zinc-500 text-xs mt-0.5">users</span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-white">{stats.totalTools}</span>
            <span className="block text-zinc-500 text-xs mt-0.5">tools</span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-white">{stats.topDomains.length}</span>
            <span className="block text-zinc-500 text-xs mt-0.5">domains</span>
          </div>
        </div>
      </section>

      {/* Top contributors */}
      {topContributors.length > 0 && !search && (
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Top contributors</h2>
              <p className="text-zinc-400">
                Community members powering the registry.
              </p>
            </div>
            <Link
              href="/leaderboard"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View full leaderboard &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {topContributors.map((entry) => (
              <div
                key={entry.contributor}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                {entry.image ? (
                  <img
                    src={entry.image}
                    alt={entry.contributor}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-semibold">
                    {entry.contributor.charAt(0).toUpperCase()}
                  </span>
                )}
                <a
                  href={`https://github.com/${entry.contributor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white font-medium hover:text-blue-400 transition-colors truncate max-w-full"
                >
                  {entry.contributor}
                </a>
                <span className="text-xs text-zinc-500">
                  {entry.configCount} config{entry.configCount !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Highlighted configs */}
      {featured.length > 0 && !search && (
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-4">
          <h2 className="text-2xl font-bold text-white mb-1">Highlighted configs</h2>
          <p className="text-zinc-400 mb-6">
            Community-curated — latest configurations for popular websites.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((c) => (
              <Link key={c.id} href={`/configs/${c.id}`} className="block group">
                <article className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors h-full">
                  <span className="inline-block text-[0.65rem] font-medium px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 mb-3">
                    Highlighted
                  </span>
                  <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-zinc-400 line-clamp-2">{c.description}</p>
                  <div className="flex gap-2 mt-3 text-xs text-zinc-500">
                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded">{c.domain}</span>
                    <span>
                      {c.tools.length} tool{c.tools.length !== 1 ? "s" : ""}
                    </span>
                    {(voteScores[c.id] ?? 0) !== 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded ${voteScores[c.id] > 0 ? "bg-blue-500/15 text-blue-400" : "bg-red-500/15 text-red-400"}`}
                      >
                        {voteScores[c.id] > 0 ? "+" : ""}
                        {voteScores[c.id]}
                      </span>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Browse all */}
      <section id="browse" className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold text-white mb-1">Browse all configs</h2>
        <p className="text-zinc-400 mb-6">
          Search and explore community-contributed configurations.
        </p>

        <form action="/" method="get" className="flex gap-2 mb-8">
          <input
            type="text"
            name="search"
            placeholder="Search by domain, title, or description..."
            defaultValue={search}
            className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Search
          </button>
        </form>

        {configs.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">
            No configs found. Be the first to contribute!
          </p>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <Link key={c.id} href={`/configs/${c.id}`} className="block">
                <article className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
                  <h3 className="text-lg font-semibold text-white mb-1">{c.title}</h3>
                  <div className="flex gap-3 text-xs text-zinc-400 mb-2">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded">{c.domain}</span>
                    <span>
                      {c.tools.length} tool{c.tools.length !== 1 ? "s" : ""}
                    </span>
                    <span>v{c.version}</span>
                    {(voteScores[c.id] ?? 0) !== 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded ${voteScores[c.id] > 0 ? "bg-blue-500/15 text-blue-400" : "bg-red-500/15 text-red-400"}`}
                      >
                        {voteScores[c.id] > 0 ? "+" : ""}
                        {voteScores[c.id]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{c.description}</p>
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 text-sm">
            {page > 1 && (
              <Link
                href={`/?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className="text-blue-400 hover:text-blue-300"
              >
                &laquo; Previous
              </Link>
            )}
            <span className="text-zinc-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className="text-blue-400 hover:text-blue-300"
              >
                Next &raquo;
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
