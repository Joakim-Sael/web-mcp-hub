import { describe, it, expect } from "vitest";
import {
  toolDescriptorSchema,
  createConfigSchema,
  updateConfigSchema,
  toolFieldSchema,
  executionDescriptorSchema,
} from "../validation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validTool(overrides?: Record<string, unknown>) {
  return {
    name: "search-products",
    description: "Search the product catalog",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term" },
      },
      required: ["query"],
    },
    ...overrides,
  };
}

function validConfig(overrides?: Record<string, unknown>) {
  return {
    domain: "example.com",
    urlPattern: "example.com/search",
    title: "Example Search",
    description: "Search the example site",
    tools: [validTool()],
    contributor: "test-user",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toolDescriptorSchema
// ---------------------------------------------------------------------------

describe("toolDescriptorSchema", () => {
  it("accepts a valid tool", () => {
    const result = toolDescriptorSchema.safeParse(validTool());
    expect(result.success).toBe(true);
  });

  it("accepts a tool with no properties", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: { type: "object", properties: {} },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a tool with annotations", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({ annotations: { readOnlyHint: "true" } }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = toolDescriptorSchema.safeParse(validTool({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = toolDescriptorSchema.safeParse(validTool({ description: "" }));
    expect(result.success).toBe(false);
  });

  // --- inputSchema validation ---

  it("rejects inputSchema without type:'object'", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: { properties: { q: { type: "string" } } },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects inputSchema with type:'array'", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: { type: "array", items: { type: "string" } },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects raw number as property value", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: {
          type: "object",
          properties: { query: 127 },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects raw string as property value", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: {
          type: "object",
          properties: { name: "string" },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects property without type field", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: {
          type: "object",
          properties: { query: { description: "Search term" } },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts property with extra JSON Schema keywords", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: {
          type: "object",
          properties: {
            count: { type: "number", minimum: 1, maximum: 100, description: "Limit" },
          },
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts nested object properties", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "object",
              properties: {
                category: { type: "string" },
              },
            },
          },
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  // --- execution field cross-validation ---

  it("accepts execution fields that match inputSchema properties", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#searchForm",
          autosubmit: true,
          fields: [{ type: "text", selector: "#q", name: "query", description: "Search" }],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects execution field name that doesn't match any inputSchema property", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#searchForm",
          autosubmit: true,
          fields: [{ type: "text", selector: "#q", name: "nonexistent", description: "Bad" }],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("nonexistent");
      expect(result.error.issues[0].message).toContain("inputSchema");
    }
  });

  // --- template variable validation ---

  it("accepts valid template variables in steps", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#form",
          autosubmit: false,
          steps: [{ action: "fill", selector: "#input", value: "{{query}}" }],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects invalid template variable in step value", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#form",
          autosubmit: false,
          steps: [{ action: "fill", selector: "#input", value: "{{typo}}" }],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{typo}}");
    }
  });

  it("rejects invalid template variable in step selector", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#form",
          autosubmit: false,
          steps: [{ action: "click", selector: 'li:has-text("{{misspelled}}") .btn' }],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{misspelled}}");
    }
  });

  it("rejects invalid template variable in navigate url", () => {
    const result = toolDescriptorSchema.safeParse(
      validTool({
        execution: {
          selector: "#nav",
          autosubmit: false,
          steps: [{ action: "navigate", url: "https://example.com/{{badParam}}" }],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{badParam}}");
    }
  });
});

// ---------------------------------------------------------------------------
// createConfigSchema
// ---------------------------------------------------------------------------

describe("createConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = createConfigSchema.safeParse(validConfig());
    expect(result.success).toBe(true);
  });

  it("normalizes domain to lowercase and strips www.", () => {
    const result = createConfigSchema.safeParse(validConfig({ domain: "WWW.Example.COM" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("example.com");
    }
  });

  it("strips protocol from urlPattern", () => {
    const result = createConfigSchema.safeParse(
      validConfig({ urlPattern: "https://example.com/search" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urlPattern).toBe("example.com/search");
    }
  });

  it("strips trailing slash from urlPattern", () => {
    const result = createConfigSchema.safeParse(validConfig({ urlPattern: "example.com/search/" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urlPattern).toBe("example.com/search");
    }
  });

  it("rejects empty tools array", () => {
    const result = createConfigSchema.safeParse(validConfig({ tools: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = createConfigSchema.safeParse({ domain: "example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts optional tags", () => {
    const result = createConfigSchema.safeParse(validConfig({ tags: ["search", "ecommerce"] }));
    expect(result.success).toBe(true);
  });

  it("accepts optional pageType", () => {
    const result = createConfigSchema.safeParse(validConfig({ pageType: "search" }));
    expect(result.success).toBe(true);
  });

  // --- duplicate tool names ---

  it("rejects duplicate tool names", () => {
    const result = createConfigSchema.safeParse(
      validConfig({
        tools: [validTool({ name: "search" }), validTool({ name: "search" })],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Duplicate tool name");
    }
  });

  it("accepts tools with different names", () => {
    const result = createConfigSchema.safeParse(
      validConfig({
        tools: [validTool({ name: "search-products" }), validTool({ name: "add-to-cart" })],
      }),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateConfigSchema
// ---------------------------------------------------------------------------

describe("updateConfigSchema", () => {
  it("accepts partial updates", () => {
    const result = updateConfigSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("accepts tools replacement", () => {
    const result = updateConfigSchema.safeParse({
      tools: [validTool()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty tools array when provided", () => {
    const result = updateConfigSchema.safeParse({ tools: [] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate tool names in update", () => {
    const result = updateConfigSchema.safeParse({
      tools: [validTool({ name: "same-name" }), validTool({ name: "same-name" })],
    });
    expect(result.success).toBe(false);
  });

  it("normalizes urlPattern when provided", () => {
    const result = updateConfigSchema.safeParse({
      urlPattern: "https://example.com/new-path/",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urlPattern).toBe("example.com/new-path");
    }
  });
});

// ---------------------------------------------------------------------------
// toolFieldSchema
// ---------------------------------------------------------------------------

describe("toolFieldSchema", () => {
  const base = { selector: "#el", name: "field", description: "A field" };

  it("accepts text field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "text" }).success).toBe(true);
  });

  it("accepts number field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "number" }).success).toBe(true);
  });

  it("accepts textarea field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "textarea" }).success).toBe(true);
  });

  it("accepts checkbox field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "checkbox" }).success).toBe(true);
  });

  it("accepts date field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "date" }).success).toBe(true);
  });

  it("accepts hidden field", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "hidden" }).success).toBe(true);
  });

  it("accepts select field with options", () => {
    expect(
      toolFieldSchema.safeParse({
        ...base,
        type: "select",
        options: [{ value: "a", label: "A" }],
      }).success,
    ).toBe(true);
  });

  it("accepts select field without options (dynamic)", () => {
    expect(
      toolFieldSchema.safeParse({ ...base, type: "select", dynamicOptions: true }).success,
    ).toBe(true);
  });

  it("accepts radio field with options", () => {
    expect(
      toolFieldSchema.safeParse({
        ...base,
        type: "radio",
        options: [{ value: "a", label: "A", selector: "#a" }],
      }).success,
    ).toBe(true);
  });

  it("rejects radio field without options", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "radio", options: [] }).success).toBe(false);
  });

  it("rejects file field type (removed)", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "file" }).success).toBe(false);
  });

  it("rejects unknown field type", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "color" }).success).toBe(false);
  });

  it("accepts optional defaultValue", () => {
    expect(
      toolFieldSchema.safeParse({ ...base, type: "text", defaultValue: "hello" }).success,
    ).toBe(true);
  });

  it("accepts required: false", () => {
    expect(toolFieldSchema.safeParse({ ...base, type: "text", required: false }).success).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// executionDescriptorSchema
// ---------------------------------------------------------------------------

describe("executionDescriptorSchema", () => {
  it("accepts minimal execution (click mode)", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#btn",
      autosubmit: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts fill+submit mode", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#form",
      autosubmit: true,
      fields: [{ type: "text", selector: "#q", name: "query", description: "Search" }],
      submitSelector: "#submit",
    });
    expect(result.success).toBe(true);
  });

  it("accepts extract mode", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#content",
      autosubmit: false,
      resultSelector: "#results",
      resultExtract: "list",
    });
    expect(result.success).toBe(true);
  });

  it("accepts attribute extract with resultAttribute", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#link",
      autosubmit: false,
      resultSelector: "#link a",
      resultExtract: "attribute",
      resultAttribute: "href",
    });
    expect(result.success).toBe(true);
  });

  it("accepts multi-step mode", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#app",
      autosubmit: false,
      steps: [
        { action: "click", selector: "#open" },
        { action: "fill", selector: "#input", value: "test" },
        { action: "wait", selector: "#result", state: "visible" },
        { action: "extract", selector: "#result", extract: "text" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts enter submit action", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#form",
      autosubmit: true,
      submitAction: "enter",
    });
    expect(result.success).toBe(true);
  });

  it("accepts resultDelay and resultWaitSelector", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#content",
      autosubmit: false,
      resultSelector: "#results",
      resultExtract: "text",
      resultDelay: 1000,
      resultWaitSelector: ".loaded",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty selector", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "",
      autosubmit: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing autosubmit", () => {
    const result = executionDescriptorSchema.safeParse({
      selector: "#form",
    });
    expect(result.success).toBe(false);
  });
});
