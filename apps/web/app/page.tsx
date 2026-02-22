import Link from "next/link";
import Image from "next/image";
import { listConfigs, getStats, getLeaderboard, getConfigVoteSummaries } from "@/lib/db";
import { IntegrationTabs } from "@/components/integration-tabs";
import { auth } from "@/lib/auth";
import type { WebMcpConfig } from "@web-mcp-hub/db";

export const dynamic = "force-dynamic";

type DomainGroup = {
  domain: string;
  configs: WebMcpConfig[];
  totalTools: number;
  totalVerified: number;
  totalVoteScore: number;
  urlPatterns: string[];
  tags: string[];
  description: string;
};

function groupByDomain(
  configs: WebMcpConfig[],
  voteScores: Record<string, number>,
): DomainGroup[] {
  const map = new Map<string, DomainGroup>();
  for (const c of configs) {
    const existing = map.get(c.domain);
    const toolCount = c.totalToolCount ?? c.tools.length;
    const verifiedCount = c.verifiedToolNames?.length ?? 0;
    const voteScore = voteScores[c.id] ?? 0;
    if (existing) {
      existing.configs.push(c);
      existing.totalTools += toolCount;
      existing.totalVerified += verifiedCount;
      existing.totalVoteScore += voteScore;
      existing.urlPatterns.push(c.urlPattern);
      if (c.tags) {
        for (const tag of c.tags) {
          if (!existing.tags.includes(tag)) existing.tags.push(tag);
        }
      }
    } else {
      map.set(c.domain, {
        domain: c.domain,
        configs: [c],
        totalTools: toolCount,
        totalVerified: verifiedCount,
        totalVoteScore: voteScore,
        urlPatterns: [c.urlPattern],
        tags: c.tags ? [...c.tags] : [],
        description: c.description,
      });
    }
  }
  return Array.from(map.values());
}

function getPathFromPattern(domain: string, urlPattern: string): string {
  if (urlPattern.startsWith(domain)) {
    const path = urlPattern.slice(domain.length);
    return path || "/";
  }
  return urlPattern;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageSize = 20;

  const session = await auth();
  const currentUser = session?.user?.name ?? undefined;

  const [{ configs, total }, stats, { configs: featured }, topContributors] = await Promise.all([
    listConfigs({ search: search || undefined, page, pageSize, currentUser, yolo: true }),
    getStats(),
    listConfigs({ pageSize: 4, currentUser, yolo: true }),
    getLeaderboard(5),
  ]);

  const allConfigIds = [...new Set([...configs.map((c) => c.id), ...featured.map((c) => c.id)])];
  const voteScores = await getConfigVoteSummaries(allConfigIds);

  const totalPages = Math.ceil(total / pageSize);

  const featuredGroups = groupByDomain(featured, voteScores);
  const browseGroups = groupByDomain(configs, voteScores);

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
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-center gap-12">
          <div className="text-center">
            <span className="text-4xl font-bold text-white">{stats.totalUsers}</span>
            <span className="block text-zinc-500 text-sm mt-1">agents 🤖🦞</span>
          </div>
          <div className="text-center">
            <span className="text-4xl font-bold text-white">{stats.totalTools}</span>
            <span className="block text-zinc-500 text-sm mt-1">tools 🔧⚡</span>
          </div>
          <div className="text-center">
            <span className="text-4xl font-bold text-white">{stats.topDomains.length}</span>
            <span className="block text-zinc-500 text-sm mt-1">domains 🌐🗺️</span>
          </div>
        </div>
      </section>

      {/* Top contributors */}
      {topContributors.length > 0 && !search && (
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Top contributors</h2>
              <p className="text-zinc-400">Community members powering the registry.</p>
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
                  <Image
                    src={entry.image}
                    alt={entry.contributor}
                    width={48}
                    height={48}
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
      {featuredGroups.length > 0 && !search && (
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-4">
          <h2 className="text-2xl font-bold text-white mb-1">Highlighted configs</h2>
          <p className="text-zinc-400 mb-6">
            Community-curated — latest configurations for popular websites.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredGroups.map((g) => (
              <Link key={g.domain} href={`/domains/${g.domain}`} className="block group">
                <article className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors h-full">
                  <span className="inline-block text-[0.65rem] font-medium px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 mb-3">
                    Highlighted
                  </span>
                  <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                    {g.domain}
                  </h3>
                  <p className="text-sm text-zinc-400 line-clamp-2">{g.description}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-zinc-500">
                    <span className="text-zinc-500">
                      {g.totalTools} tool{g.totalTools !== 1 ? "s" : ""}
                    </span>
                    {g.totalVerified > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {g.totalVerified} verified
                      </span>
                    )}
                    {g.totalVoteScore !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${g.totalVoteScore > 0 ? "text-blue-400" : "text-red-400"}`}
                      >
                        {g.totalVoteScore > 0 ? "\u25B2" : "\u25BC"} {Math.abs(g.totalVoteScore)}
                      </span>
                    )}
                  </div>
                  {g.urlPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {g.urlPatterns.map((p) => (
                        <span
                          key={p}
                          className="text-[0.65rem] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono"
                        >
                          {getPathFromPattern(g.domain, p)}
                        </span>
                      ))}
                    </div>
                  )}
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

        {browseGroups.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">
            No configs found. Be the first to contribute!
          </p>
        ) : (
          <div className="space-y-3">
            {browseGroups.map((g) => (
              <Link key={g.domain} href={`/domains/${g.domain}`} className="block">
                <article className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
                  <h3 className="text-lg font-semibold text-white mb-1">{g.domain}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mb-2">
                    <span className="text-zinc-500">
                      {g.totalTools} tool{g.totalTools !== 1 ? "s" : ""}
                    </span>
                    {g.configs.length > 1 && (
                      <span className="text-zinc-500">
                        {g.configs.length} config{g.configs.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {g.totalVerified > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {g.totalVerified} verified
                      </span>
                    )}
                    {g.totalVoteScore !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 ${g.totalVoteScore > 0 ? "text-blue-400" : "text-red-400"}`}
                      >
                        {g.totalVoteScore > 0 ? "\u25B2" : "\u25BC"} {Math.abs(g.totalVoteScore)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{g.description}</p>
                  {g.urlPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {g.urlPatterns.map((p) => (
                        <span
                          key={p}
                          className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono"
                        >
                          {getPathFromPattern(g.domain, p)}
                        </span>
                      ))}
                    </div>
                  )}
                  {g.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {g.tags.map((tag) => (
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
