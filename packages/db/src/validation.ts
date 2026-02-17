import { z } from "zod";

// ---------------------------------------------------------------------------
// Tool Field Zod schemas (discriminated union on `type`)
// ---------------------------------------------------------------------------

const fieldBase = {
  selector: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
};

const textFieldSchema = z.object({ ...fieldBase, type: z.literal("text") });
const numberFieldSchema = z.object({ ...fieldBase, type: z.literal("number") });
const textareaFieldSchema = z.object({ ...fieldBase, type: z.literal("textarea") });

const selectOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const selectFieldSchema = z.object({
  ...fieldBase,
  type: z.literal("select"),
  options: z.array(selectOptionSchema).optional(),
  dynamicOptions: z.boolean().optional(),
});

const checkboxFieldSchema = z.object({ ...fieldBase, type: z.literal("checkbox") });

const radioOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  selector: z.string().min(1),
});

const radioFieldSchema = z.object({
  ...fieldBase,
  type: z.literal("radio"),
  options: z.array(radioOptionSchema).min(1),
});

const dateFieldSchema = z.object({ ...fieldBase, type: z.literal("date") });
const hiddenFieldSchema = z.object({ ...fieldBase, type: z.literal("hidden") });

export const toolFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  numberFieldSchema,
  textareaFieldSchema,
  selectFieldSchema,
  checkboxFieldSchema,
  radioFieldSchema,
  dateFieldSchema,
  hiddenFieldSchema,
]);

// ---------------------------------------------------------------------------
// Action Step Zod schemas (discriminated union on `action`, with z.lazy)
// ---------------------------------------------------------------------------

const navigateStepSchema = z.object({
  action: z.literal("navigate"),
  url: z.string().min(1),
});

const clickStepSchema = z.object({
  action: z.literal("click"),
  selector: z.string().min(1),
});

const fillStepSchema = z.object({
  action: z.literal("fill"),
  selector: z.string().min(1),
  value: z.string(),
});

const selectStepSchema = z.object({
  action: z.literal("select"),
  selector: z.string().min(1),
  value: z.string(),
});

const waitStepSchema = z.object({
  action: z.literal("wait"),
  selector: z.string().min(1),
  state: z.enum(["visible", "exists", "hidden"]).optional(),
  timeout: z.number().optional(),
});

const extractStepSchema = z.object({
  action: z.literal("extract"),
  selector: z.string().min(1),
  extract: z.enum(["text", "html", "list", "table", "attribute"]),
  attribute: z.string().optional(),
});

const scrollStepSchema = z.object({
  action: z.literal("scroll"),
  selector: z.string().min(1),
});

// Use z.lazy for the recursive ConditionStep
const conditionStepSchema: z.ZodType = z.object({
  action: z.literal("condition"),
  selector: z.string().min(1),
  state: z.enum(["visible", "exists", "hidden"]),
  then: z.lazy(() => z.array(actionStepSchema)),
  else: z.lazy(() => z.array(actionStepSchema)).optional(),
});

export const actionStepSchema: z.ZodType = z.discriminatedUnion("action", [
  navigateStepSchema,
  clickStepSchema,
  fillStepSchema,
  selectStepSchema,
  waitStepSchema,
  extractStepSchema,
  scrollStepSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditionStepSchema as any, // z.lazy requires cast within discriminatedUnion
]);

// ---------------------------------------------------------------------------
// Execution Descriptor
// ---------------------------------------------------------------------------

export const executionDescriptorSchema = z.object({
  selector: z.string().min(1),
  fields: z.array(toolFieldSchema).optional(),
  autosubmit: z.boolean(),
  submitAction: z.enum(["click", "enter"]).optional(),
  submitSelector: z.string().optional(),
  resultSelector: z.string().optional(),
  resultExtract: z.enum(["text", "html", "attribute", "table", "list"]).optional(),
  resultAttribute: z.string().optional(),
  steps: z.array(actionStepSchema).optional(),
  resultDelay: z.number().optional(),
  resultWaitSelector: z.string().optional(),
});

// ---------------------------------------------------------------------------
// JSON Schema validation — rejects invalid property definitions
// ---------------------------------------------------------------------------

const jsonSchemaPropertySchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string(),
      description: z.string().optional(),
      enum: z.array(z.unknown()).optional(),
      items: z.record(z.unknown()).optional(),
      properties: z.record(jsonSchemaPropertySchema).optional(),
      required: z.array(z.string()).optional(),
    })
    .passthrough(),
);

const inputSchemaSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(jsonSchemaPropertySchema).default({}),
    required: z.array(z.string()).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Tool & Config schemas (execution added to toolDescriptorSchema)
// ---------------------------------------------------------------------------

export const toolDescriptorSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    inputSchema: inputSchemaSchema,
    annotations: z.record(z.string()).optional(),
    execution: executionDescriptorSchema.optional(),
  })
  .superRefine((tool, ctx) => {
    if (!tool.execution) return;
    const schemaProps = Object.keys(
      (tool.inputSchema.properties as Record<string, unknown>) ?? {},
    );

    // Validate execution field names map to inputSchema properties
    if (tool.execution.fields) {
      for (let i = 0; i < tool.execution.fields.length; i++) {
        const fieldName = tool.execution.fields[i].name;
        if (!schemaProps.includes(fieldName)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Execution field "${fieldName}" does not match any inputSchema property. Available: ${schemaProps.join(", ") || "(none)"}`,
            path: ["execution", "fields", i, "name"],
          });
        }
      }
    }

    // Validate {{paramName}} template variables in steps and selectors
    if (schemaProps.length > 0 && tool.execution.steps) {
      const templateRe = /\{\{(\w+)\}\}/g;
      const checkTemplates = (value: string, path: (string | number)[]) => {
        let m: RegExpExecArray | null;
        while ((m = templateRe.exec(value)) !== null) {
          if (!schemaProps.includes(m[1])) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Template variable "{{${m[1]}}}" does not match any inputSchema property. Available: ${schemaProps.join(", ")}`,
              path,
            });
          }
        }
      };

      for (let i = 0; i < tool.execution.steps.length; i++) {
        const step = tool.execution.steps[i] as Record<string, unknown>;
        const basePath = ["execution", "steps", i];
        if (typeof step.url === "string") checkTemplates(step.url, [...basePath, "url"]);
        if (typeof step.value === "string") checkTemplates(step.value, [...basePath, "value"]);
        if (typeof step.selector === "string") checkTemplates(step.selector, [...basePath, "selector"]);
      }
    }
  });

/** Strip protocol and trailing slashes from a URL pattern so it's always "domain/path" */
function normalizeUrlPattern(val: string): string {
  return val.replace(/^https?:\/\//, "").replace(/\/+$/, "") || val;
}

/** Refine a tools array to reject duplicate tool names */
const uniqueToolNames = (
  tools: z.infer<typeof toolDescriptorSchema>[],
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<string>();
  for (let i = 0; i < tools.length; i++) {
    if (seen.has(tools[i].name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate tool name "${tools[i].name}"`,
        path: [i, "name"],
      });
    }
    seen.add(tools[i].name);
  }
};

export const createConfigSchema = z.object({
  domain: z.string().min(1).transform((d) => d.toLowerCase().replace(/^www\./, "")),
  urlPattern: z.string().min(1).transform(normalizeUrlPattern),
  pageType: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  tools: z.array(toolDescriptorSchema).min(1).superRefine(uniqueToolNames),
  contributor: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export const updateConfigSchema = z.object({
  urlPattern: z.string().min(1).transform(normalizeUrlPattern).optional(),
  pageType: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  tools: z.array(toolDescriptorSchema).min(1).superRefine(uniqueToolNames).optional(),
  contributor: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
