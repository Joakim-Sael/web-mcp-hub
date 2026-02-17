import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfigById, getToolVotesBatch } from "@/lib/db";
import { auth } from "@/lib/auth";
import { VoteButtons } from "@/components/vote-buttons";
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

      <h2 className="text-lg font-semibold text-white mb-3">Tools ({config.tools.length})</h2>

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
