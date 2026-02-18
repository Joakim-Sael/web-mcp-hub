import type { WebMcpConfig, ToolDescriptor, ExecutionDescriptor } from "./types.js";

export function describeExecution(exec: ExecutionDescriptor): string {
  if (exec.steps && exec.steps.length > 0) {
    return `multi-step (${exec.steps.length} steps)`;
  }
  const hasFields = exec.fields && exec.fields.length > 0;
  if (hasFields && exec.autosubmit) return `fill+submit (${exec.fields!.length} fields)`;
  if (hasFields && !exec.autosubmit) return `fill (${exec.fields!.length} fields)`;
  if (!hasFields && exec.autosubmit) return "click";
  return "extract";
}

export function formatToolExecution(tool: ToolDescriptor): string {
  if (!tool.execution) return "";
  const exec = tool.execution;
  const parts = [`    Execution: ${describeExecution(exec)}`, `    Selector: ${exec.selector}`];
  if (exec.fields && exec.fields.length > 0) {
    parts.push(`    Fields: ${exec.fields.map((f) => f.name).join(", ")}`);
  }
  if (exec.submitSelector) parts.push(`    Submit: ${exec.submitSelector}`);
  if (exec.resultSelector) parts.push(`    Result: ${exec.resultSelector}`);
  if (exec.resultExtract) parts.push(`    Extract: ${exec.resultExtract}`);
  if (exec.steps && exec.steps.length > 0) {
    parts.push(`    Steps: ${exec.steps.map((s) => s.action).join(" → ")}`);
  }
  return "\n" + parts.join("\n");
}

export function formatConfig(config: WebMcpConfig, verbose = false): string {
  const lines = [
    `ID: ${config.id}`,
    `Title: ${config.title}`,
    `Domain: ${config.domain}`,
    `URL Pattern: ${config.urlPattern}`,
    config.pageType ? `Page Type: ${config.pageType}` : null,
    `Description: ${config.description}`,
    `Contributor: ${config.contributor}`,
    `Version: ${config.version}`,
    `Verified: ${config.verified ? "Yes" : "No"}`,
    `Tools (${config.tools.length}):`,
    ...config.tools.map((t) => {
      if (verbose) {
        const schema = JSON.stringify(t.inputSchema, null, 2);
        const ann = t.annotations ? `\n    Annotations: ${JSON.stringify(t.annotations)}` : "";
        const exec = formatToolExecution(t);
        return `  - ${t.name}: ${t.description}\n    Input Schema: ${schema}${ann}${exec}`;
      }
      const execLabel = t.execution ? ` [${describeExecution(t.execution)}]` : "";
      return `  - ${t.name}: ${t.description}${execLabel}`;
    }),
    config.tags?.length ? `Tags: ${config.tags.join(", ")}` : null,
    `Updated: ${config.updatedAt}`,
  ];
  return lines.filter(Boolean).join("\n");
}
