import { z } from "zod";

// ---------------------------------------------------------------------------
// Tool Field Zod schemas (discriminated union on `type`)
// ---------------------------------------------------------------------------

const fieldBase = {
  selector: z.string().min(1).max(500),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
};

const textFieldSchema = z.object({ ...fieldBase, type: z.literal("text") });
const numberFieldSchema = z.object({ ...fieldBase, type: z.literal("number") });
const textareaFieldSchema = z.object({ ...fieldBase, type: z.literal("textarea") });

const selectOptionSchema = z.object({
  value: z.string().max(100),
  label: z.string().max(200),
});

const selectFieldSchema = z.object({
  ...fieldBase,
  type: z.literal("select"),
  options: z.array(selectOptionSchema).max(100).optional(),
  dynamicOptions: z.boolean().optional(),
});

const checkboxFieldSchema = z.object({ ...fieldBase, type: z.literal("checkbox") });

const radioOptionSchema = z.object({
  value: z.string().max(100),
  label: z.string().max(200),
  selector: z.string().min(1).max(500),
});

const radioFieldSchema = z.object({
  ...fieldBase,
  type: z.literal("radio"),
  options: z.array(radioOptionSchema).min(1).max(50),
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
  url: z.string().min(1).max(2048),
});

const clickStepSchema = z.object({
  action: z.literal("click"),
  selector: z.string().min(1).max(500),
});

const fillStepSchema = z.object({
  action: z.literal("fill"),
  selector: z.string().min(1).max(500),
  value: z.string().max(10000),
});

const selectStepSchema = z.object({
  action: z.literal("select"),
  selector: z.string().min(1).max(500),
  value: z.string().max(500),
});

const waitStepSchema = z.object({
  action: z.literal("wait"),
  selector: z.string().min(1).max(500),
  state: z.enum(["visible", "exists", "hidden"]).optional(),
  timeout: z.number().optional(),
});

const extractStepSchema = z.object({
  action: z.literal("extract"),
  selector: z.string().min(1).max(500),
  extract: z.enum(["text", "html", "list", "table", "attribute"]),
  attribute: z.string().max(200).optional(),
});

const scrollStepSchema = z.object({
  action: z.literal("scroll"),
  selector: z.string().min(1).max(500),
});

const evaluateStepSchema = z.object({
  action: z.literal("evaluate"),
  value: z.string().min(1).max(10000),
});

// Use z.lazy for the recursive ConditionStep
const conditionStepSchema: z.ZodType = z.object({
  action: z.literal("condition"),
  selector: z.string().min(1).max(500),
  state: z.enum(["visible", "exists", "hidden"]),
  then: z.lazy(() => z.array(actionStepSchema).max(20)),
  else: z.lazy(() => z.array(actionStepSchema).max(20)).optional(),
});

export const actionStepSchema: z.ZodType = z.discriminatedUnion("action", [
  navigateStepSchema,
  clickStepSchema,
  fillStepSchema,
  selectStepSchema,
  waitStepSchema,
  extractStepSchema,
  scrollStepSchema,
  evaluateStepSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditionStepSchema as any, // z.lazy requires cast within discriminatedUnion
]);

// ---------------------------------------------------------------------------
// Execution Descriptor
// ---------------------------------------------------------------------------

export const executionDescriptorSchema = z.object({
  selector: z.string().min(1).max(500),
  fields: z.array(toolFieldSchema).max(20).optional(),
  autosubmit: z.boolean(),
  submitAction: z.enum(["click", "enter"]).optional(),
  submitSelector: z.string().max(500).optional(),
  resultSelector: z.string().max(500).optional(),
  resultExtract: z.enum(["text", "html", "attribute", "table", "list"]).optional(),
  resultAttribute: z.string().max(200).optional(),
  steps: z.array(actionStepSchema).max(50).optional(),
  resultDelay: z.number().optional(),
  resultWaitSelector: z.string().max(500).optional(),
  resultRequired: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// JSON Schema validation — rejects invalid property definitions
// ---------------------------------------------------------------------------

const jsonSchemaPropertySchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string().max(50),
      description: z.string().max(1000).optional(),
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
  .passthrough()
  .superRefine((schema, ctx) => {
    if (Object.keys(schema.properties as Record<string, unknown>).length > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "inputSchema may have at most 20 properties",
        path: ["properties"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Tool & Config schemas (execution added to toolDescriptorSchema)
// ---------------------------------------------------------------------------

export const toolDescriptorSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    inputSchema: inputSchemaSchema,
    annotations: z.record(z.string().max(500)).optional(),
    execution: executionDescriptorSchema.optional(),
  })
  .superRefine((tool, ctx) => {
    if (!tool.execution) return;
    const schemaProps = Object.keys((tool.inputSchema.properties as Record<string, unknown>) ?? {});

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
        if (typeof step.selector === "string")
          checkTemplates(step.selector, [...basePath, "selector"]);
      }
    }
  });

/** Strip protocol and trailing slashes from a URL pattern so it's always "domain/path" */
function normalizeUrlPattern(val: string): string {
  return val.replace(/^https?:\/\//, "").replace(/\/+$/, "") || val;
}

/** Refine a tools array to reject duplicate tool names */
const uniqueToolNames = (tools: z.infer<typeof toolDescriptorSchema>[], ctx: z.RefinementCtx) => {
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
  domain: z
    .string()
    .min(1)
    .max(253)
    .transform((d) => d.toLowerCase().replace(/^www\./, "")),
  urlPattern: z.string().min(1).max(2048).transform(normalizeUrlPattern),
  pageType: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  tools: z.array(toolDescriptorSchema).max(30).superRefine(uniqueToolNames),
  contributor: z.string().min(1).max(39),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateConfigSchema = z.object({
  urlPattern: z.string().min(1).max(2048).transform(normalizeUrlPattern).optional(),
  pageType: z.string().max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  tools: z.array(toolDescriptorSchema).max(30).superRefine(uniqueToolNames).optional(),
  contributor: z.string().min(1).max(39).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
