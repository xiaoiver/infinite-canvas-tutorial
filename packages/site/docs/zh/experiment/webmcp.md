---
outline: deep
---

# 在无限画布中使用 WebMCP

WebMCP 让网页把“可被 AI 代理调用的站点工具”以结构化方式暴露在当前标签页内。对于无限画布这类交互应用，它与现有公共 API 天然契合：把“创建/选择/移动图形、相机缩放/平移、导出、查询场景”等操作直接映射为可发现、可验证的工具，避免基于截图或脆弱 DOM 结构的猜测。

说明：本仓库当前尚未内置 WebMCP，下面代码仅作“如何封装”的演示示例。

## 什么是 WebMCP，为何适合画布类应用

-   WebMCP 在页面里提供一个模型上下文（Model Context），站点可向其中注册工具；工具以 JSON Schema 描述输入，由页面内的执行函数完成实际动作。
-   相比“电脑使用/截屏式”方案，调用只交换少量 JSON，速度更快、成本更低。
-   画布应用已有稳定的公共 API。将其映射到 WebMCP 工具，能让代理以明确语义执行操作（例如“把这些图形右移 10 像素”），而非靠视觉或结构猜测。

## 工具定义示例（演示）

假设可以拿到画布 API（`api`，见 Reference → Canvas / Camera / Export image）。使用 `navigator.modelContext.registerTool` 注册工具。每个工具包含：

-   `name`：唯一名称
-   `description`：简洁可信的说明（供代理规划时理解）
-   `inputSchema`：用于校验与 UI 的 JSON Schema
-   `execute`：执行函数，返回可序列化的 JSON 结果

```ts
// 仅为演示 —— 本仓库暂未开启 WebMCP。
// 把已有公共 API 的部分操作封装为页面工具。
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

navigator.modelContext?.registerTool({
    name: 'create_rect',
    description:
        '在 (x, y) 创建矩形（宽/高必填，可选填充/描边），返回新节点 id。',
    inputSchema: {
        type: 'object',
        properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number', minimum: 0 },
            height: { type: 'number', minimum: 0 },
            fill: {
                type: 'string',
                description: 'CSS 颜色或图片 URL',
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
                error: (e as Error)?.message ?? 'create_rect 失败',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'move_nodes_by',
    description: '将给定节点整体平移 (dx, dy)，保持其他属性不变。',
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
            if (nodes.length === 0) return { ok: false, error: '无有效 id' };
            api.updateNodes(nodes);
            return { ok: true, data: { moved: nodes.length } };
        } catch (e) {
            return {
                ok: false,
                error: (e as Error)?.message ?? 'move_nodes_by 失败',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'zoom_to',
    description: '设置画布缩放（例如 1 表示 100%）。',
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
                error: (e as Error)?.message ?? 'zoom_to 失败',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'pan_by',
    description: '按视口增量 (dx, dy) 平移相机。',
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
            return { ok: false, error: (e as Error)?.message ?? 'pan_by 失败' };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'export_image',
    description:
        '导出整个画布或部分节点为 PNG/JPEG/SVG。返回 dataURL（PNG/JPEG）或 SVG 字符串。',
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
                error: (e as Error)?.message ?? 'export_image 失败',
            };
        }
    },
});

navigator.modelContext?.registerTool({
    name: 'get_scene_summary',
    description:
        '汇总场景：节点总数与当前选区 id，便于在修改前进行推理与规划。',
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
                error: (e as Error)?.message ?? 'get_scene_summary 失败',
            };
        }
    },
});
```

## 在 Chrome DevTools for Agents 中测试

你可以在没有任何代理的情况下，用 DevTools 面板直接验证工具（注册、Schema 与执行结果）；也可以通过 DevTools for Agents 驱动代理调用这些工具：

1）本地启用 WebMCP

    - 在 Chrome 149+ 打开 `chrome://flags/#enable-webmcp-testing` 并启用（详见 “AI in Chrome → WebMCP” 文档）。
    - 打开开发者工具 → Application → WebMCP，查看已注册的工具，检查其 JSON Schema，并用示例输入运行。

2）使用 Chrome DevTools for Agents

    - 启动 DevTools MCP 服务器并开启 WebMCP 分类，例如：
        - `"args": ["chrome-devtools-mcp@latest", "--categoryExperimentalWebmcp"]`
    - 让你的编码代理先列出工具再执行某个工具（服务器提供 `list_webmcp_tools` / `execute_webmcp_tool`）。

参考资料：

-   [调试 WebMCP 工具](https://developer.chrome.com/docs/devtools/application/webmcp)
-   [使用 AI 代理调试 WebMCP 工具](https://developer.chrome.com/docs/devtools/agents/webmcp-debugging)
-   [WebMCP 概览](https://developer.chrome.com/docs/ai/webmcp)
-   [命令式 API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

## 注意与最佳实践

-   WebMCP 仍在试验阶段，需通过 flag 或 Origin Trial 启用，暂不宜作为关键路径依赖。
-   工具是“页内临时体”，仅在该标签页打开期间可用。
-   工具描述与返回值会进入模型上下文，属于“提示注入”面；请保持描述可控可信、在 `execute` 中校验输入，并对破坏性操作进行用户确认。
-   为副作用加节流与防护，优先保证幂等；返回结构化结果。

## 延伸阅读

-   [LottieFiles 的 WebMCP 介绍](https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-webmcp)
-   [WindTunnel 基准（WebMCP 对比“电脑使用/截屏式”代理）](https://webmcp.com/benchmark)
