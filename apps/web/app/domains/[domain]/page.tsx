import Link from "next/link";
import { notFound } from "next/navigation";
import { lookupByDomain, getToolVotesBatch } from "@/lib/db";
import { auth } from "@/lib/auth";
import { VoteButtons } from "@/components/vote-buttons";
import type { ExecutionDescriptor } from "@web-mcp-hub/db";

export const dynamic = "force-dynamic";

function getExecType(exec: ExecutionDescriptor): string {
  if (exec.steps && exec.steps.length > 0) return "multi-step";
  const hasFields = exec.fields && exec.fields.length > 0;
  if (hasFields && exec.autosubmit) return "fill+submit";
  if (hasFields && !exec.autosubmit) return "fill";
  if (!hasFields && exec.autosubmit) return "click";
  return "extract";
}

function getPathFromPattern(domain: string, urlPattern: string): string {
  if (urlPattern.startsWith(domain)) {
    const path = urlPattern.slice(domain.length);
    return path || "/";
  }
  return urlPattern;
}

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const decodedDomain = decodeURIComponent(domain);

  const [allConfigs, session] = await Promise.all([
    lookupByDomain(decodedDomain, undefined, { yolo: true }),
    auth(),
  ]);

  if (allConfigs.length === 0) notFound();

  // Fetch vote data for all tools across all configs
  const toolVotesByConfig: Record<
    string,
    Record<string, { score: number; userVote: number | null }>
  > = {};
  await Promise.all(
    allConfigs.map(async (config) => {
      const toolNames = config.tools.map((t) => t.name);
      toolVotesByConfig[config.id] = await getToolVotesBatch(
        config.id,
        toolNames,
        session?.user?.id,
      );
    }),
  );

  // Aggregate stats
  const totalTools = allConfigs.reduce((sum, c) => sum + (c.totalToolCount ?? c.tools.length), 0);
  const totalVerified = allConfigs.reduce((sum, c) => sum + (c.verifiedToolNames?.length ?? 0), 0);
  const allTags = [...new Set(allConfigs.flatMap((c) => c.tags ?? []))];

  return (
    <section className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &larr; Back to all configs
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">{decodedDomain}</h1>

      <div className="flex flex-wrap gap-2 text-xs text-zinc-400 mb-4">
        <span className="bg-zinc-800 px-2 py-1 rounded">
          {allConfigs.length} config{allConfigs.length !== 1 ? "s" : ""}
        </span>
        <span className="bg-zinc-800 px-2 py-1 rounded">
          {totalTools} tool{totalTools !== 1 ? "s" : ""}
        </span>
        {totalVerified > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            {totalVerified} verified
          </span>
        )}
      </div>

      {/* URL patterns */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allConfigs.map((c) => (
          <span
            key={c.id}
            className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded font-mono"
          >
            {getPathFromPattern(decodedDomain, c.urlPattern)}
          </span>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="flex gap-1.5 mb-6">
          {allTags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tools grouped by config */}
      {allConfigs.map((config) => {
        const patternPath = getPathFromPattern(decodedDomain, config.urlPattern);
        const votes = toolVotesByConfig[config.id] ?? {};

        return (
          <div key={config.id} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-white">{config.title}</h2>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                {patternPath}
              </span>
              {config.verified && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  verified
                </span>
              )}
              <Link
                href={`/configs/${config.id}`}
                className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
              >
                View config &rarr;
              </Link>
            </div>
            <p className="text-sm text-zinc-400 mb-3">{config.description}</p>

            <div className="space-y-4">
              {config.tools.map((tool) => {
                const hasExec = !!tool.execution;
                const exec = tool.execution;
                return (
                  <div
                    key={`${config.id}-${tool.name}`}
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-medium">
                        {tool.name}
                        <span className="ml-2 text-[0.7em] bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full align-middle font-mono">
                          {patternPath}
                        </span>
                        {hasExec && exec && (
                          <span className="ml-2 text-[0.7em] bg-blue-600 text-white px-2 py-0.5 rounded-full align-middle">
                            {getExecType(exec)}
                          </span>
                        )}
                        {config.verifiedToolNames?.includes(tool.name) && (
                          <span className="ml-2 text-[0.7em] inline-flex items-center gap-0.5 bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full align-middle">
                            <svg
                              className="w-3 h-3 inline-block"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                clipRule="evenodd"
                              />
                            </svg>
                            verified
                          </span>
                        )}
                      </h3>
                      <VoteButtons
                        configId={config.id}
                        toolName={tool.name}
                        score={votes[tool.name]?.score ?? 0}
                        userVote={votes[tool.name]?.userVote ?? null}
                        isAuthenticated={!!session?.user}
                      />
                    </div>
                    <p className="text-sm text-zinc-400 mb-3">{tool.description}</p>

                    <details className="mb-2">
                      <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                        Input Schema
                      </summary>
                      <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs text-zinc-300 overflow-x-auto">
                        <code>{JSON.stringify(tool.inputSchema, null, 2)}</code>
                      </pre>
                    </details>

                    {tool.annotations && (
                      <details className="mb-2">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                          Annotations
                        </summary>
                        <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs text-zinc-300 overflow-x-auto">
                          <code>{JSON.stringify(tool.annotations, null, 2)}</code>
                        </pre>
                      </details>
                    )}

                    {hasExec && exec && (
                      <details>
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                          Execution Metadata
                        </summary>
                        <div className="mt-2 space-y-1 text-sm text-zinc-400">
                          <p>
                            <strong className="text-zinc-300">Selector:</strong>{" "}
                            <code className="bg-zinc-950 px-1 rounded">{exec.selector}</code>
                          </p>
                          {exec.fields && exec.fields.length > 0 && (
                            <p>
                              <strong className="text-zinc-300">
                                Fields ({exec.fields.length}):
                              </strong>{" "}
                              {exec.fields.map((f) => (
                                <span key={f.name}>
                                  <code className="bg-zinc-950 px-1 rounded">{f.name}</code> (
                                  {f.type}){" "}
                                </span>
                              ))}
                            </p>
                          )}
                          <p>
                            <strong className="text-zinc-300">Auto-submit:</strong>{" "}
                            {String(exec.autosubmit)}
                          </p>
                          {exec.submitSelector && (
                            <p>
                              <strong className="text-zinc-300">Submit:</strong>{" "}
                              <code className="bg-zinc-950 px-1 rounded">
                                {exec.submitSelector}
                              </code>
                            </p>
                          )}
                          {exec.resultSelector && (
                            <p>
                              <strong className="text-zinc-300">Result selector:</strong>{" "}
                              <code className="bg-zinc-950 px-1 rounded">
                                {exec.resultSelector}
                              </code>
                            </p>
                          )}
                          {exec.resultExtract && (
                            <p>
                              <strong className="text-zinc-300">Result extract:</strong>{" "}
                              {exec.resultExtract}
                            </p>
                          )}
                          {exec.steps && exec.steps.length > 0 && (
                            <p>
                              <strong className="text-zinc-300">
                                Steps ({exec.steps.length}):
                              </strong>{" "}
                              {exec.steps.map((s) => s.action).join(" → ")}
                            </p>
                          )}
                          {exec.resultDelay && (
                            <p>
                              <strong className="text-zinc-300">Result delay:</strong>{" "}
                              {exec.resultDelay}ms
                            </p>
                          )}
                          {exec.resultWaitSelector && (
                            <p>
                              <strong className="text-zinc-300">Result wait:</strong>{" "}
                              <code className="bg-zinc-950 px-1 rounded">
                                {exec.resultWaitSelector}
                              </code>
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
