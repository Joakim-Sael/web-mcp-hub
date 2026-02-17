# WebMCP Reference

WebMCP is a proposed web standard that exposes structured tools for AI agents on existing websites. It replaces screen-scraping with robust, high-performance page interaction and knowledge retrieval. The browser mediates between the website and the agent, providing discovery, typed schemas, and state awareness.

## Availability

- Chrome 146+ with the `chrome://flags/#enable-webmcp-testing` flag enabled.
- Top-level browsing contexts only (browser tabs, not iframes or headless).

---

## Imperative API

The imperative API uses JavaScript to define tools via `window.navigator.modelContext`.

### Feature Detection

```js
if ("modelContext" in window.navigator) {
  // WebMCP is supported
}
```

### provideContext

Registers a full set of tools. **Replaces** any previously registered tools.

```js
window.navigator.modelContext.provideContext({
  tools: [
    {
      name: "addTodo",
      description: "Add a new item to the todo list",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text of the todo item" },
        },
        required: ["text"],
      },
      execute: ({ text }) => {
        return { content: [{ type: "text", text: `Added todo: ${text}` }] };
      },
    },
    {
      name: "markComplete",
      description: "Mark a todo item as complete",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The ID of the todo item" },
        },
        required: ["id"],
      },
      execute: ({ id }) => {
        return { content: [{ type: "text", text: `Marked ${id} as complete` }] };
      },
    },
  ],
});
```

### registerTool

Adds a single tool to the existing set without removing others.

```js
window.navigator.modelContext.registerTool({
  name: "addTodo",
  description: "Add a new item to the todo list",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text of the todo item" },
    },
    required: ["text"],
  },
  annotations: {
    readOnlyHint: "true",
  },
  execute: ({ text }) => {
    return { content: [{ type: "text", text: `Added todo: ${text}` }] };
  },
});
```

### unregisterTool

Removes a specific tool by name.

```js
window.navigator.modelContext.unregisterTool("addTodo");
```

### clearContext

Removes all registered tools at once.

```js
window.navigator.modelContext.clearContext();
```

### Tool Descriptor Shape

Every tool passed to `provideContext` or `registerTool` has the following shape:

| Property      | Type       | Required | Description                                        |
| ------------- | ---------- | -------- | -------------------------------------------------- |
| `name`        | `string`   | Yes      | Unique identifier for the tool                     |
| `description` | `string`   | Yes      | Natural language description of what the tool does |
| `inputSchema` | `object`   | Yes      | JSON Schema defining the tool's parameters         |
| `annotations` | `object`   | No       | Metadata hints (e.g. `readOnlyHint`)               |
| `execute`     | `function` | Yes      | Callback `(params, agent) => result`               |

### Execute Callback

The `execute` function receives two arguments:

1. **params** — An object matching the `inputSchema`, populated by the agent.
2. **agent** — An interface scoped to this tool execution, providing:
   - `agent.requestUserInteraction(asyncCallback)` — Pauses execution to get user input (e.g. confirmation dialogs).

The function returns a structured content response:

```js
execute: ({ name }, agent) => {
  return {
    content: [{ type: "text", text: `Done: ${name}` }],
  };
};
```

### requestUserInteraction

Use this for sensitive actions (purchases, deletions) that need user confirmation.

```js
async function buyProduct({ product_id }, agent) {
  const confirmed = await agent.requestUserInteraction(async () => {
    return new Promise((resolve) => {
      const result = confirm(`Buy product ${product_id}?`);
      resolve(result);
    });
  });

  if (!confirmed) {
    throw new Error("Purchase cancelled by user.");
  }

  executePurchase(product_id);
  return { content: [{ type: "text", text: `Product ${product_id} purchased.` }] };
}
```

---

## Declarative API

The declarative API transforms standard HTML forms into WebMCP tools using HTML attributes. No JavaScript is required for simple cases.

### Form Attributes

| Attribute              | Element     | Description                                                         |
| ---------------------- | ----------- | ------------------------------------------------------------------- |
| `toolname`             | `<form>`    | The tool's registered name                                          |
| `tooldescription`      | `<form>`    | Natural language description of the tool                            |
| `toolautosubmit`       | `<form>`    | If present, skips manual user submit — form auto-submits            |
| `toolparamtitle`       | form inputs | Maps to the JSON Schema property key (overrides `name`)             |
| `toolparamdescription` | form inputs | Maps to the JSON Schema property description (overrides label text) |

### Basic Example

```html
<form toolname="my_tool" tooldescription="A simple declarative tool" action="/submit">
  <label for="text">text label</label>
  <input type="text" name="text" />

  <select
    name="select"
    required
    toolparamtitle="Possible Options"
    toolparamdescription="A nice description"
  >
    <option value="Option 1">This is option 1</option>
    <option value="Option 2">This is option 2</option>
    <option value="Option 3">This is option 3</option>
  </select>

  <button type="submit">Submit</button>
</form>
```

The browser internally generates this tool schema from the HTML above:

```json
{
  "name": "my_tool",
  "description": "A simple declarative tool",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "text label"
      },
      "select": {
        "type": "string",
        "oneOf": [
          { "const": "Option 1", "title": "This is option 1" },
          { "const": "Option 2", "title": "This is option 2" },
          { "const": "Option 3", "title": "This is option 3" }
        ],
        "enum": ["Option 1", "Option 2", "Option 3"],
        "title": "Possible Options",
        "description": "A nice description"
      }
    },
    "required": ["select"]
  }
}
```

### How Parameter Descriptions Are Resolved

1. If `toolparamdescription` is set on the input, use that.
2. Otherwise, use the `textContent` of the associated `<label>` element.
3. Otherwise, use `aria-description`.

> **Known issue:** For `<input type="radio">` groups, `toolparamdescription` must be placed on the **first** `<input>` element in the group.

### SubmitEvent Extensions

When an agent triggers a declarative tool, the `SubmitEvent` has two new members:

| Member                 | Type       | Description                                                                             |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `agentInvoked`         | `boolean`  | `true` when the form was submitted by an agent                                          |
| `respondWith(promise)` | `function` | Pass a promise that resolves with the tool's result. Requires `preventDefault()` first. |

```html
<form toolautosubmit toolname="search_tool" tooldescription="Search the web" action="/search">
  <input type="text" name="query" />
</form>

<script>
  document.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();

    if (!myFormIsValid()) {
      if (e.agentInvoked) {
        e.respondWith(Promise.resolve({ error: "Invalid form data" }));
      }
      return;
    }

    if (e.agentInvoked) {
      e.respondWith(Promise.resolve("Search is done!"));
    }
  });
</script>
```

### Window Events

| Event           | Fires When                                                   | Properties |
| --------------- | ------------------------------------------------------------ | ---------- |
| `toolactivated` | Agent has pre-filled form fields                             | `toolName` |
| `toolcancel`    | User cancels the agent operation or `form.reset()` is called | `toolName` |

Both events are non-cancelable.

```js
window.addEventListener("toolactivated", ({ toolName }) => {
  console.log(`Tool "${toolName}" was activated by an agent.`);
});

window.addEventListener("toolcancel", ({ toolName }) => {
  console.log(`Tool "${toolName}" was cancelled.`);
});
```

### CSS Pseudo-Classes

When an agent invokes a declarative tool, the browser applies these pseudo-classes for visual feedback:

| Pseudo-class          | Applied To           | Description                                        |
| --------------------- | -------------------- | -------------------------------------------------- |
| `:tool-form-active`   | The `<form>` element | Indicates the form is being controlled by an agent |
| `:tool-submit-active` | The submit button    | Indicates the submit button is agent-targeted      |

Both are removed when the form submits, the agent cancels, or the user resets the form.

Default Chrome styles:

```css
form:tool-form-active {
  outline: light-dark(blue, cyan) dashed 1px;
  outline-offset: -1px;
}

input:tool-submit-active {
  outline: light-dark(red, pink) dashed 1px;
  outline-offset: -1px;
}
```

---

## How It Works

1. **Registration** — The page registers tools (imperative or declarative) via `navigator.modelContext`.
2. **Discovery** — An AI agent (browser-integrated or extension-based) queries the page for available tools, receiving names, descriptions, and JSON schemas.
3. **Invocation** — The agent selects a tool and provides arguments matching the schema. For imperative tools, the `execute` callback runs. For declarative tools, the browser focuses the form, populates fields, and optionally auto-submits.
4. **Response** — The tool returns structured content to the agent. For declarative forms, this is done via `respondWith()`.
5. **UI Sync** — The page updates its UI to reflect the new state so both the user and the agent can verify the result.

### Execution Model

- Tool calls run **sequentially on the main thread**, one at a time.
- For heavy operations, delegate to **Web Workers** and return a promise.
- The `execute` function can be **async** — the agent waits for the promise to resolve.

### Relationship to MCP

MCP (Model Context Protocol) is a client-server protocol using HTTP/SSE transport. WebMCP is **client-side** — tools live in the webpage itself. They share the same primitives (tool names, JSON schemas, structured responses) but WebMCP requires no separate server. MCP-compatible agents can consume WebMCP tools with minimal translation.

---

## Tool Design Best Practices

### Naming

- Use specific verbs: `create-event` for immediate creation, `start-event-creation-process` if it redirects to a UI form.
- Describe what the tool **does** and when to use it.
- Prefer positive instructions over negative limitations.

### Schema Design

- **Accept raw user input.** Don't require the agent to do math or transformations. If a user says "11:00 to 15:00", accept those strings directly.
- **Use explicit types** (`string`, `number`, `enum`) for all parameters.
- **Explain the why** behind options. E.g. `"Use shipping='EXPRESS' when the user requests next-day delivery"`.

### Error Handling

- Validate constraints in your **execute code**, not just the schema. Return descriptive errors so the agent can self-correct and retry.
- For rate limits, return a meaningful error or advise the user to take over manually.
- Return **after** the UI has been updated so the agent can verify state.

### Tool Composition

- Keep tools **atomic and composable**. Avoid overlapping tools with nuanced differences — combine into one tool with parameters.
- **Don't manage global task flow** inside tools. Trust the agent to orchestrate.

---

## Limitations

- **Browsing context required** — A visible browser tab must be open. No headless tool calls.
- **UI synchronization** — Developers must update UI after tool execution regardless of whether a human or agent triggered it.
- **Complexity overhead** — Complex UIs may require refactoring to handle agent-driven state updates.
- **Tool discoverability** — No built-in mechanism to discover which sites have tools without visiting them. Search engines or directories may fill this gap in the future.

---

## Complete Example

A stamp collection app exposing an "add-stamp" tool:

```js
// Existing helper function used by both UI and agent
function addStamp(stampName, stampDescription, stampYear, stampImageUrl) {
  stamps.push({
    name: stampName,
    description: stampDescription,
    year: stampYear,
    imageUrl: stampImageUrl || null,
  });
  document.getElementById("confirmationMessage").textContent =
    `Stamp "${stampName}" added successfully!`;
  renderStamps();
}

// Human UI handler
document.getElementById("addStampForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addStamp(
    document.getElementById("stampName").value,
    document.getElementById("stampDescription").value,
    document.getElementById("stampYear").value,
    document.getElementById("stampImageUrl").value,
  );
});

// WebMCP tool registration
if ("modelContext" in window.navigator) {
  window.navigator.modelContext.provideContext({
    tools: [
      {
        name: "add-stamp",
        description: "Add a new stamp to the collection",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The name of the stamp" },
            description: { type: "string", description: "A brief description of the stamp" },
            year: { type: "number", description: "The year the stamp was issued" },
            imageUrl: { type: "string", description: "An optional image URL for the stamp" },
          },
          required: ["name", "description", "year"],
        },
        execute({ name, description, year, imageUrl }) {
          addStamp(name, description, year, imageUrl);
          return {
            content: [
              {
                type: "text",
                text: `Stamp "${name}" added successfully! The collection now contains ${stamps.length} stamps.`,
              },
            ],
          };
        },
      },
    ],
  });
}
```
