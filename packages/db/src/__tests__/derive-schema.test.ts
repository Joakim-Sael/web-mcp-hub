import { describe, it, expect } from "vitest";
import { deriveInputSchema } from "../derive-schema.js";
import type { ToolField } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function derive(fields: ToolField[]) {
  return deriveInputSchema(fields) as {
    type: string;
    properties: Record<string, Record<string, unknown>>;
    required: string[];
  };
}

const base = { selector: "#el", name: "field", description: "A field" };

// ---------------------------------------------------------------------------
// Basic type mapping
// ---------------------------------------------------------------------------

describe("deriveInputSchema — type mapping", () => {
  it("maps text to string", () => {
    const schema = derive([{ ...base, type: "text" }]);
    expect(schema.properties.field.type).toBe("string");
  });

  it("maps textarea to string", () => {
    const schema = derive([{ ...base, type: "textarea" }]);
    expect(schema.properties.field.type).toBe("string");
  });

  it("maps hidden to string", () => {
    const schema = derive([{ ...base, type: "hidden" }]);
    expect(schema.properties.field.type).toBe("string");
  });

  it("maps number to number", () => {
    const schema = derive([{ ...base, type: "number" }]);
    expect(schema.properties.field.type).toBe("number");
  });

  it("maps checkbox to boolean", () => {
    const schema = derive([{ ...base, type: "checkbox" }]);
    expect(schema.properties.field.type).toBe("boolean");
  });

  it("maps date to string with format:date", () => {
    const schema = derive([{ ...base, type: "date" }]);
    expect(schema.properties.field.type).toBe("string");
    expect(schema.properties.field.format).toBe("date");
  });
});

// ---------------------------------------------------------------------------
// Select fields
// ---------------------------------------------------------------------------

describe("deriveInputSchema — select fields", () => {
  it("maps select to string with enum", () => {
    const schema = derive([
      {
        ...base,
        type: "select" as const,
        options: [
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ],
      },
    ]);
    expect(schema.properties.field.type).toBe("string");
    expect(schema.properties.field.enum).toEqual(["a", "b"]);
  });

  it("includes oneOf with titles for select options", () => {
    const schema = derive([
      {
        ...base,
        type: "select" as const,
        options: [
          { value: "express", label: "Express Shipping" },
          { value: "standard", label: "Standard Shipping" },
        ],
      },
    ]);
    expect(schema.properties.field.oneOf).toEqual([
      { const: "express", title: "Express Shipping" },
      { const: "standard", title: "Standard Shipping" },
    ]);
  });

  it("handles select without options (dynamic)", () => {
    const schema = derive([
      { ...base, type: "select" as const, dynamicOptions: true },
    ]);
    expect(schema.properties.field.type).toBe("string");
    expect(schema.properties.field.enum).toBeUndefined();
    expect(schema.properties.field.oneOf).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Radio fields
// ---------------------------------------------------------------------------

describe("deriveInputSchema — radio fields", () => {
  it("maps radio to string with enum", () => {
    const schema = derive([
      {
        ...base,
        type: "radio" as const,
        options: [
          { value: "yes", label: "Yes", selector: "#yes" },
          { value: "no", label: "No", selector: "#no" },
        ],
      },
    ]);
    expect(schema.properties.field.type).toBe("string");
    expect(schema.properties.field.enum).toEqual(["yes", "no"]);
  });

  it("includes oneOf with titles for radio options", () => {
    const schema = derive([
      {
        ...base,
        type: "radio" as const,
        options: [
          { value: "sm", label: "Small", selector: "#sm" },
          { value: "lg", label: "Large", selector: "#lg" },
        ],
      },
    ]);
    expect(schema.properties.field.oneOf).toEqual([
      { const: "sm", title: "Small" },
      { const: "lg", title: "Large" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Required / default handling
// ---------------------------------------------------------------------------

describe("deriveInputSchema — required and defaults", () => {
  it("marks fields as required by default", () => {
    const schema = derive([{ ...base, type: "text" }]);
    expect(schema.required).toContain("field");
  });

  it("excludes fields with required: false", () => {
    const schema = derive([{ ...base, type: "text", required: false }]);
    expect(schema.required).not.toContain("field");
  });

  it("includes defaultValue in schema", () => {
    const schema = derive([{ ...base, type: "text", defaultValue: "hello" }]);
    expect(schema.properties.field.default).toBe("hello");
  });

  it("includes numeric defaultValue", () => {
    const schema = derive([{ ...base, type: "number", defaultValue: 42 }]);
    expect(schema.properties.field.default).toBe(42);
  });

  it("includes boolean defaultValue", () => {
    const schema = derive([{ ...base, type: "checkbox", defaultValue: true }]);
    expect(schema.properties.field.default).toBe(true);
  });

  it("does not include default when not set", () => {
    const schema = derive([{ ...base, type: "text" }]);
    expect(schema.properties.field.default).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Overall structure
// ---------------------------------------------------------------------------

describe("deriveInputSchema — output structure", () => {
  it("produces valid JSON Schema object shape", () => {
    const schema = derive([{ ...base, type: "text" }]);
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();
    expect(schema.required).toBeDefined();
    expect(Array.isArray(schema.required)).toBe(true);
  });

  it("includes description from field", () => {
    const schema = derive([
      { ...base, type: "text", description: "Enter your name" },
    ]);
    expect(schema.properties.field.description).toBe("Enter your name");
  });

  it("handles multiple fields", () => {
    const schema = derive([
      { selector: "#a", name: "firstName", description: "First name", type: "text" as const },
      { selector: "#b", name: "age", description: "Your age", type: "number" as const },
      { selector: "#c", name: "agree", description: "Accept terms", type: "checkbox" as const, required: false },
    ]);

    expect(Object.keys(schema.properties)).toEqual(["firstName", "age", "agree"]);
    expect(schema.properties.firstName.type).toBe("string");
    expect(schema.properties.age.type).toBe("number");
    expect(schema.properties.agree.type).toBe("boolean");
    expect(schema.required).toEqual(["firstName", "age"]);
  });

  it("handles empty fields array", () => {
    const schema = derive([]);
    expect(schema.type).toBe("object");
    expect(schema.properties).toEqual({});
    expect(schema.required).toEqual([]);
  });
});
