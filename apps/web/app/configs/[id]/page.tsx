import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfigById, getToolVotesBatch } from "@/lib/db";
import { auth } from "@/lib/auth";
import { VoteButtons } from "@/components/vote-buttons";

export const dynamic = "force-dynamic";
import type { ExecutionDescriptor } from "@web-mcp-hub/db";

function getExecType(exec: ExecutionDescriptor): string {
  if (exec.steps && exec.steps.length > 0) return "multi-step";
  const hasFields = exec.fields && exec.fields.length > 0;
  if (hasFields && exec.autosubmit) return "fill+submit";
  if (hasFields && !exec.autosubmit) return "fill";
  if (!hasFields && exec.autosubmit) return "click";
  return "extract";
}

export default async function ConfigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [config, session] = await Promise.all([getConfigById(id), auth()]);
  if (!config) notFound();
  const toolNames = config.tools.map((t) => t.name);
  const toolVotes = await getToolVotesBatch(id, toolNames, session?.user?.id);

  return (
    <section className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &larr; Back to all configs
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">{config.title}</h1>

      <div className="flex flex-wrap gap-2 text-xs text-zinc-400 mb-4">
        <span className="bg-zinc-800 px-2 py-1 rounded">{config.domain}</span>
        <span className="bg-zinc-800 px-2 py-1 rounded">{config.urlPattern}</span>
        {config.pageType && (
          <span className="bg-zinc-800 px-2 py-1 rounded">{config.pageType}</span>
        )}
        <span className="bg-zinc-800 px-2 py-1 rounded">v{config.version}</span>
        <span className="bg-zinc-800 px-2 py-1 rounded">by {config.contributor}</span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded ${config.verified ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}
        >
          {config.verified ? (
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l.36.624a.53.53 0 00.12.137.53.53 0 00.169.073l.655.17c1.24.321 1.752 1.822.958 2.81l-.42.524a.53.53 0 00-.082.165.53.53 0 00-.008.183l.095.68c.178 1.27-.9 2.254-2.126 1.836l-.648-.22a.53.53 0 00-.182-.013.53.53 0 00-.17.058l-.596.31c-1.127.587-2.467-.276-2.503-1.56l-.019-.68a.53.53 0 00-.04-.178.53.53 0 00-.107-.147l-.478-.493c-.905-.932-.467-2.47.818-2.874l.68-.213a.53.53 0 00.156-.081.53.53 0 00.112-.133l.36-.624z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {config.verified ? "All tools verified" : "Unverified"}
        </span>
      </div>

      <p className="text-zinc-300 mb-4">{config.description}</p>

      {config.tags && config.tags.length > 0 && (
        <div className="flex gap-1.5 mb-6">
          {config.tags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-white mb-3">
        Tools ({config.tools.length})
        {(config.verifiedToolNames?.length ?? 0) > 0 && (
          <span className="ml-2 text-sm font-normal inline-flex items-center gap-1 text-green-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            {config.verifiedToolNames!.length} verified
          </span>
        )}
      </h2>

      <div className="space-y-4">
        {config.tools.map((tool) => {
          const hasExec = !!tool.execution;
          const exec = tool.execution;
          return (
            <div key={tool.name} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-medium">
                  {tool.name}
                  {hasExec && exec && (
                    <span className="ml-2 text-[0.7em] bg-blue-600 text-white px-2 py-0.5 rounded-full align-middle">
                      {getExecType(exec)}
                    </span>
                  )}
                  {config.verifiedToolNames?.includes(tool.name) && (
                    <span className="ml-2 text-[0.7em] inline-inline-flex items-center gap-0.5 bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full align-middle">
                      <svg className="w-3 h-3 inline-block" viewBox="0 0 20 20" fill="currentColor">
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
                  score={toolVotes[tool.name]?.score ?? 0}
                  userVote={toolVotes[tool.name]?.userVote ?? null}
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
                        <strong className="text-zinc-300">Fields ({exec.fields.length}):</strong>{" "}
                        {exec.fields.map((f) => (
                          <span key={f.name}>
                            <code className="bg-zinc-950 px-1 rounded">{f.name}</code> ({f.type}
                            ){" "}
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
                        <code className="bg-zinc-950 px-1 rounded">{exec.submitSelector}</code>
                      </p>
                    )}
                    {exec.resultSelector && (
                      <p>
                        <strong className="text-zinc-300">Result selector:</strong>{" "}
                        <code className="bg-zinc-950 px-1 rounded">{exec.resultSelector}</code>
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
                        <strong className="text-zinc-300">Steps ({exec.steps.length}):</strong>{" "}
                        {exec.steps.map((s) => s.action).join(" → ")}
                      </p>
                    )}
                    {exec.resultDelay && (
                      <p>
                        <strong className="text-zinc-300">Result delay:</strong> {exec.resultDelay}
                        ms
                      </p>
                    )}
                    {exec.resultWaitSelector && (
                      <p>
                        <strong className="text-zinc-300">Result wait:</strong>{" "}
                        <code className="bg-zinc-950 px-1 rounded">{exec.resultWaitSelector}</code>
                      </p>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-xs text-zinc-500 space-y-1">
        <p>
          Config ID: <code className="bg-zinc-900 px-1 rounded">{config.id}</code>
        </p>
        <p>Created: {new Date(config.createdAt).toLocaleDateString()}</p>
        <p>Updated: {new Date(config.updatedAt).toLocaleDateString()}</p>
      </div>
    </section>
  );
}
