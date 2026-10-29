---
outline: deep
---

# WebMCP for the infinite canvas

WebMCP lets a web app expose safe, structured tools that AI agents can discover and call directly in the same tab. For an infinite‑canvas editor, this is a natural fit: tools map one‑to‑one to the app’s public API (create/select/move shapes, pan/zoom the camera, export, query state), without brittle vision or DOM heuristics.

Note: This repository does not ship WebMCP yet. The snippets below are illustrative examples showing how the existing canvas API could be wrapped as WebMCP tools.

## What is WebMCP and why it suits a canvas app

-   WebMCP defines a page‑local model context with tools described by JSON Schema and executed inside the page.
-   Calls are fast and cheap because the agent exchanges small JSON payloads instead of screenshots or DOM diffs.
-   A canvas app already has a stable public API. Mapping that API into WebMCP tools gives agents precise, semantic operations (e.g. “move these nodes by 10px”) instead of guesswork.

## Example tool definitions (illustrative)

Assume you have access to the canvas API as `api` (see Reference → Canvas/Camera/Export image). You can register tools with `navigator.modelContext.registerTool`. Each tool provides:

-   `name`: unique identifier
-   `description`: concise, trusted text (used by agents for planning)
-   `inputSchema`: JSON Schema for validation and UI
-   `execute`: async function that performs the action and returns a JSON‑serializable result

```ts
// Illustrative only — this repo does not enable WebMCP today.
// Wrap selected parts of the public API as page tools.
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

navigator.modelContext?.registerTool({
    name: 'create_rect',
    description:
        'Create a rectangle at (x, y) with width/height; optional fill/stroke. Returns the new node id.',
    inputSchema: {
        type: 'object',
        properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number', minimum: 0 },
            height: { type: 'number', minimum: 0 },
            fill: {
                type: 'string',
                description: 'CSS color or image URL',
                nullable: true,
            },
            stroke: { type: 'string', nullable: true },
            strokeWidth: { type: 'number', minimum: 0, nullable: true },
        },
        required: ['x', 'y', 'width', 'height'],
        additionalProperties: false,
    },
    async execute(input): Promise<Result<{ id: string }>> {
        try {
            const id = crypto.randomUUID();
            const node: any = {
                id,
                type: 'rect',
                x: input.x,
                y: input.y,
                width: input.width,
                height: input.height,
            };
            if (input.fill)
                node.fills = [{ type: 'solid', value: input.fill, opacity: 1 }];
            if (input.stroke) {
                node.strokes = [
                    { type: 'solid', value: input.stroke, opacity: 1 },
                ];
                if (typeof input.strokeWidth === 'number')
                    node.strokeWidth = input.strokeWidth;
            }
            api.updateNodes([node]);
            api.selectNodes([api.getNodeById(id)!]);
            return { ok: true, data: { id } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'create_rect failed',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'move_nodes_by',
    description:
        'Translate nodes by (dx, dy). Keeps other properties unchanged.',
    inputSchema: {
        type: 'object',
        properties: {
            ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
            dx: { type: 'number' },
            dy: { type: 'number' },
        },
        required: ['ids', 'dx', 'dy'],
        additionalProperties: false,
    },
    async execute({ ids, dx, dy }): Promise<Result<{ moved: number }>> {
        try {
            const nodes = ids
                .map((id: string) => api.getNodeById(id))
                .filter(Boolean)
                .map((node: any) => ({
                    ...node,
                    x: (Number(node.x) || 0) + dx,
                    y: (Number(node.y) || 0) + dy,
                }));
            if (nodes.length === 0) return { ok: false, error: 'no valid ids' };
            api.updateNodes(nodes);
            return { ok: true, data: { moved: nodes.length } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'move_nodes_by failed',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'zoom_to',
    description: 'Set canvas zoom (e.g., 1 = 100%).',
    inputSchema: {
        type: 'object',
        properties: { zoom: { type: 'number', minimum: 0.05, maximum: 16 } },
        required: ['zoom'],
        additionalProperties: false,
    },
    async execute({ zoom }): Promise<Result<{ zoom: number }>> {
        try {
            api.zoomTo(zoom);
            return { ok: true, data: { zoom } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'zoom_to failed',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'pan_by',
    description: 'Pan camera by viewport delta (dx, dy).',
    inputSchema: {
        type: 'object',
        properties: { dx: { type: 'number' }, dy: { type: 'number' } },
        required: ['dx', 'dy'],
        additionalProperties: false,
    },
    async execute({ dx, dy }): Promise<Result<{ x: number; y: number }>> {
        try {
            const { cameraX = 0, cameraY = 0 } = api.getAppState();
            const x = Number(cameraX) + dx;
            const y = Number(cameraY) + dy;
            api.setAppState({ cameraX: x, cameraY: y });
            return { ok: true, data: { x, y } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'pan_by failed',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'export_image',
    description:
        'Export current canvas or a set of nodes as PNG/JPEG/SVG. Returns a data URL (PNG/JPEG) or SVG string.',
    inputSchema: {
        type: 'object',
        properties: {
            format: { type: 'string', enum: ['png', 'jpeg', 'svg'] },
            nodeIds: { type: 'array', items: { type: 'string' } },
            download: { type: 'boolean' },
        },
        required: ['format'],
        additionalProperties: false,
    },
    async execute({
        format,
        nodeIds = [],
        download = false,
    }): Promise<Result<{ dataURL?: string; svg?: string }>> {
        try {
            const nodes = (nodeIds as string[])
                .map((id) => api.getNodeById(id))
                .filter(Boolean);
            const result = await api.export({
                format: String(format).toUpperCase(), // 'PNG' | 'JPEG' | 'SVG'
                download,
                nodes,
            } as any);
            return {
                ok: true,
                data: { dataURL: result?.dataURL, svg: result?.svg },
            };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'export_image failed',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'get_scene_summary',
    description:
        'Summarize scene: total node count and current selection ids. Useful for reasoning before edits.',
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
    async execute(): Promise<Result<{ total: number; selected: string[] }>> {
        try {
            const state = api.getAppState();
            const selected = [...(state.layersSelected ?? [])];
            const total = (api.getNodes?.() ?? state.nodes ?? []).length ?? 0;
            return { ok: true, data: { total, selected } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'get_scene_summary failed',
            };
        }
    },
});
```

## Test with Chrome DevTools for Agents

You can validate and iterate on WebMCP tools without any agent, and you can also drive them from an agent via DevTools:

1. Enable WebMCP locally

    - In Chrome 149+ open `chrome://flags/#enable-webmcp-testing` and enable it. See “AI in Chrome → WebMCP” docs.
    - Open DevTools → Application → WebMCP to see registered tools, inspect their JSON Schema, and run them with sample inputs.

2. Use Chrome DevTools for Agents

    - Start the DevTools MCP server with WebMCP category enabled (for example):
        - `"args": ["chrome-devtools-mcp@latest", "--categoryExperimentalWebmcp"]`
    - Ask your coding agent to list tools and execute one (the server exposes `list_webmcp_tools` / `execute_webmcp_tool`).

References:

-   [Debug WebMCP tools](https://developer.chrome.com/docs/devtools/application/webmcp)
-   [Debug WebMCP tools with AI agents](https://developer.chrome.com/docs/devtools/agents/webmcp-debugging)
-   [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
-   [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

## Caveats and best practices

-   WebMCP is experimental and still behind a flag or origin trial; do not depend on it for critical paths yet.
-   Tools are ephemeral: they exist only while the tab is open.
-   Descriptions and outputs are a prompt‑injection surface. Keep descriptions trusted, validate inputs in `execute`, and ask users to confirm destructive actions.
-   Rate‑limit and guard side effects. Prefer idempotent operations and return structured results.

## Further reading

-   [LottieFiles’ WebMCP write‑up](https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-webmcp)
-   [WindTunnel benchmark (WebMCP vs. computer‑use / screenshot agents)](https://webmcp.com/benchmark)
