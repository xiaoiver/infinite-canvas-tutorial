import type { API, SerializedNode } from '@infinite-canvas-tutorial/ecs';

type InputSchema = Record<string, unknown>;
type CanvasTool = {
  name: string;
  description: string;
  inputSchema: InputSchema;
  annotations: {
    readOnlyHint: boolean;
    consequentialHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (
    input: unknown,
    context?: { signal?: AbortSignal },
  ) => Promise<string>;
};

export interface ModelContext {
  registerTool: (
    tool: CanvasTool,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
}

const MAX_NODES = 20;
const MAX_CODE_LENGTH = 32_000;
const MAX_LABEL_LENGTH = 120;

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Expected an object');
  }
  return input as Record<string, unknown>;
}

function string(value: unknown, name: string, max = MAX_LABEL_LENGTH): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TypeError(
      `${name} must be a non-empty string of at most ${max} characters`,
    );
  }
  return value;
}

function number(
  value: unknown,
  name: string,
  min = -100_000,
  max = 100_000,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new TypeError(
      `${name} must be a finite number between ${min} and ${max}`,
    );
  }
  return value;
}

function optionalNumber(
  input: Record<string, unknown>,
  key: string,
  min?: number,
  max?: number,
): number | undefined {
  return input[key] === undefined
    ? undefined
    : number(input[key], key, min, max);
}

function optionalColor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const color = string(value, 'fill', 32);
  if (!/^#[\da-fA-F]{3,8}$/.test(color)) {
    throw new TypeError('fill must be a hexadecimal color');
  }
  return color;
}

function assertKeys(input: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key))
      throw new TypeError(`Unsupported field: ${key}`);
  }
}

function describeNode(node: SerializedNode) {
  return {
    id: node.id,
    type: node.type,
    name:
      typeof node.name === 'string'
        ? node.name.slice(0, MAX_LABEL_LENGTH)
        : undefined,
    parentId: node.parentId,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
  };
}

function liveNodes(api: API) {
  return api.getNodes().filter((node) => !node.isDeleted);
}

function schema(
  properties: InputSchema = {},
  required: string[] = [],
): InputSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

/** Register tools only for a loaded, authorized project canvas. Abort removes every tool. */
export async function registerCanvasWebMcp(
  api: API,
  projectId: string,
  signal: AbortSignal,
  context?: ModelContext,
): Promise<number> {
  if (signal.aborted || !projectId || !context) return 0;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();

  const tool = (
    name: string,
    description: string,
    inputSchema: InputSchema,
    readOnly: boolean,
    execute: CanvasTool['execute'],
  ): CanvasTool => ({
    name,
    description,
    inputSchema,
    annotations: {
      readOnlyHint: readOnly,
      consequentialHint: !readOnly,
      untrustedContentHint: true,
    },
    execute: async (input, options) => {
      if (controller.signal.aborted || options?.signal?.aborted) {
        throw new Error('Canvas tool is no longer available');
      }
      return execute(input, options);
    },
  });

  const tools: CanvasTool[] = [
    tool(
      'get_canvas_summary',
      'Summarize the current canvas project and root shapes.',
      schema(),
      true,
      async (input) => {
        assertKeys(object(input), []);
        const nodes = liveNodes(api);
        const roots = nodes.filter((node) => !node.parentId);
        return JSON.stringify({
          projectId,
          nodeCount: nodes.length,
          roots: roots.slice(0, MAX_NODES).map(describeNode),
          rootsTruncated: roots.length > MAX_NODES,
        });
      },
    ),
    tool(
      'get_selection',
      'Read IDs and basic properties of selected canvas shapes.',
      schema(),
      true,
      async (input) => {
        assertKeys(object(input), []);
        const ids = api.getAppState().layersSelected;
        const selected = new Set(ids);
        return JSON.stringify({
          selectedCount: ids.length,
          nodes: liveNodes(api)
            .filter((node) => selected.has(node.id))
            .slice(0, MAX_NODES)
            .map(describeNode),
          truncated: ids.length > MAX_NODES,
        });
      },
    ),
    tool(
      'get_nodes',
      'Read basic properties for up to 20 canvas node IDs.',
      schema(
        {
          ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: MAX_NODES,
          },
        },
        ['ids'],
      ),
      true,
      async (input) => {
        const args = object(input);
        assertKeys(args, ['ids']);
        if (
          !Array.isArray(args.ids) ||
          args.ids.length < 1 ||
          args.ids.length > MAX_NODES
        ) {
          throw new TypeError('ids must contain 1 to 20 node IDs');
        }
        const ids = args.ids.map((id) => string(id, 'id'));
        const nodes = new Map(liveNodes(api).map((node) => [node.id, node]));
        return JSON.stringify({
          nodes: ids
            .map((id) => nodes.get(id))
            .filter((node): node is SerializedNode => Boolean(node))
            .map(describeNode),
        });
      },
    ),
    tool(
      'export_canvas_code',
      'Export code for the current canvas, up to 32000 characters.',
      schema(
        { framework: { type: 'string', enum: ['html-css', 'react-tailwind'] } },
        ['framework'],
      ),
      true,
      async (input) => {
        const args = object(input);
        assertKeys(args, ['framework']);
        if (
          args.framework !== 'html-css' &&
          args.framework !== 'react-tailwind'
        ) {
          throw new TypeError('framework must be html-css or react-tailwind');
        }
        const code = api.exportCode(undefined, { framework: args.framework });
        return JSON.stringify({
          code: code.slice(0, MAX_CODE_LENGTH),
          truncated: code.length > MAX_CODE_LENGTH,
        });
      },
    ),
    tool(
      'create_shape',
      'Create a rectangle or ellipse in the current project canvas. This changes the canvas and can be undone.',
      schema(
        {
          type: { type: 'string', enum: ['rect', 'ellipse'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', exclusiveMinimum: 0 },
          height: { type: 'number', exclusiveMinimum: 0 },
          fill: { type: 'string' },
          name: { type: 'string' },
        },
        ['type', 'x', 'y', 'width', 'height'],
      ),
      false,
      async (input, options) => {
        const args = object(input);
        assertKeys(args, ['type', 'x', 'y', 'width', 'height', 'fill', 'name']);
        if (args.type !== 'rect' && args.type !== 'ellipse')
          throw new TypeError('type must be rect or ellipse');
        const node: SerializedNode = {
          id: crypto.randomUUID(),
          type: args.type,
          zIndex: 0,
          x: number(args.x, 'x'),
          y: number(args.y, 'y'),
          width: number(args.width, 'width', 0.01, 100_000),
          height: number(args.height, 'height', 0.01, 100_000),
          ...(args.name === undefined
            ? {}
            : { name: string(args.name, 'name') }),
          ...(args.fill === undefined
            ? {}
            : {
                fills: [
                  { type: 'solid' as const, value: optionalColor(args.fill)! },
                ],
              }),
        };
        const committed = await api.edit(
          (editor) => {
            node.zIndex =
              editor
                .getNodes()
                .reduce((max, current) => Math.max(max, current.zIndex), 0) + 1;
            editor.updateNode(node);
          },
          {
            signal: options?.signal
              ? AbortSignal.any([options.signal, controller.signal])
              : controller.signal,
          },
        );
        if (!committed) throw new Error('Canvas edit was cancelled');
        return JSON.stringify({ id: node.id, type: node.type });
      },
    ),
    tool(
      'update_node',
      'Update a rectangle or ellipse position, size, fill, or name. This changes the canvas and can be undone.',
      schema(
        {
          id: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', exclusiveMinimum: 0 },
          height: { type: 'number', exclusiveMinimum: 0 },
          fill: { type: 'string' },
          name: { type: 'string' },
        },
        ['id'],
      ),
      false,
      async (input, options) => {
        const args = object(input);
        assertKeys(args, ['id', 'x', 'y', 'width', 'height', 'fill', 'name']);
        const id = string(args.id, 'id');
        const patch: Partial<SerializedNode> & {
          fills?: [{ type: 'solid'; value: string }];
        } = {};
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          const value = optionalNumber(
            args,
            key,
            key === 'width' || key === 'height' ? 0.01 : -100_000,
            100_000,
          );
          if (value !== undefined) patch[key] = value;
        }
        if (args.name !== undefined) patch.name = string(args.name, 'name');
        const fill = optionalColor(args.fill);
        if (fill !== undefined) patch.fills = [{ type: 'solid', value: fill }];
        if (!Object.keys(patch).length)
          throw new TypeError('At least one property is required');
        const committed = await api.edit(
          (editor) => {
            const node = editor
              .getNodes()
              .find((candidate) => candidate.id === id && !candidate.isDeleted);
            if (
              !node ||
              (node.type !== 'rect' && node.type !== 'ellipse') ||
              node.locked
            ) {
              throw new Error('Editable rectangle or ellipse not found');
            }
            editor.updateNode(node, patch);
          },
          {
            signal: options?.signal
              ? AbortSignal.any([options.signal, controller.signal])
              : controller.signal,
          },
        );
        if (!committed) throw new Error('Canvas edit was cancelled');
        return JSON.stringify({ id, updated: Object.keys(patch) });
      },
    ),
  ];

  try {
    let count = 0;
    for (const registered of tools) {
      if (controller.signal.aborted) break;
      await context.registerTool(registered, { signal: controller.signal });
      count++;
    }
    return count;
  } catch (error) {
    controller.abort();
    signal.removeEventListener('abort', stop);
    throw error;
  }
}
