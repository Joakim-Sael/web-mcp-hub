import type { ToolField } from "./types.js";

/**
 * Converts a ToolField array into a JSON Schema object.
 * Used by the hub (to auto-populate inputSchema on upload) and Chrome extension.
 */
export function deriveInputSchema(fields: ToolField[]): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: Record<string, unknown> = {
      description: field.description,
    };

    switch (field.type) {
      case "text":
      case "textarea":
      case "hidden":
        prop.type = "string";
        break;

      case "date":
        prop.type = "string";
        prop.format = "date";
        break;

      case "number":
        prop.type = "number";
        break;

      case "checkbox":
        prop.type = "boolean";
        break;

      case "select":
        prop.type = "string";
        if (field.options && field.options.length > 0) {
          prop.enum = field.options.map((o) => o.value);
          prop.oneOf = field.options.map((o) => ({
            const: o.value,
            title: o.label,
          }));
        }
        break;

      case "radio":
        prop.type = "string";
        if (field.options.length > 0) {
          prop.enum = field.options.map((o) => o.value);
          prop.oneOf = field.options.map((o) => ({
            const: o.value,
            title: o.label,
          }));
        }
        break;
    }

    if (field.defaultValue !== undefined) {
      prop.default = field.defaultValue;
    }

    properties[field.name] = prop;

    // required defaults to true when not specified
    if (field.required !== false) {
      required.push(field.name);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}
