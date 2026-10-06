import {
  API,
  MarkerAttributes,
  SerializedNode,
  StrokeAttributes,
  isDesignVariableReference,
  resolveDesignVariableValue,
} from '@infinite-canvas-tutorial/ecs';

const choices = {
  strokeAlignment: ['center', 'inner', 'outer'],
  strokeLinecap: ['butt', 'round', 'square'],
  strokeLinejoin: ['miter', 'round', 'bevel'],
  strokeDashCap: ['none', 'square', 'round'],
  markerStart: ['none', 'line', 'triangle', 'diamond'],
  markerEnd: ['none', 'line', 'triangle', 'diamond'],
} as const;

type StrokeGeometryCommand =
  | { kind: 'width' | 'dash' | 'gap' | 'style'; value: unknown }
  | { kind: 'choice'; field: keyof typeof choices; value: unknown }
  | { kind: 'bind'; key: string }
  | { kind: 'unbind' };

type GeometryWire = Omit<
  Partial<StrokeAttributes & MarkerAttributes>,
  'strokeWidth'
> & { strokeWidth?: number | string };

/** Reject blank or partially numeric input before writing or recording. */
export function strokeNumber(raw: unknown) {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim()
      ? Number(raw)
      : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function dashParts(dash: string | undefined) {
  const raw = (dash ?? '').trim();
  return raw.includes(',') ? raw.split(',') : raw.split(/\s+/).filter(Boolean);
}

export function strokeStyleFromDasharrayWire(dash: string | undefined) {
  const parts = dashParts(dash);
  const a = strokeNumber(parts[0]);
  const b = strokeNumber(parts[1] ?? parts[0]);
  return a !== undefined && b !== undefined && a > 0 && b > 0
    ? 'dashed'
    : 'solid';
}

export function parseDashGapPxFromWire(dash: string | undefined) {
  const parts = dashParts(dash);
  const a = strokeNumber(parts[0]);
  const b = strokeNumber(parts[1] ?? parts[0]);
  const dashPx = a !== undefined && a > 0 ? a : 6;
  const gapPx = b !== undefined && b > 0 ? b : dashPx;
  return { dashPx, gapPx };
}

function resolvePatch(
  api: API,
  node: GeometryWire,
  command: StrokeGeometryCommand,
): GeometryWire | undefined {
  if (command.kind === 'width') {
    const strokeWidth = strokeNumber(command.value);
    if (strokeWidth === undefined || (node.strokeWidth ?? 1) === strokeWidth)
      return;
    return { strokeWidth };
  }
  if (command.kind === 'style') {
    if (
      !['solid', 'dashed'].includes(command.value as string) ||
      strokeStyleFromDasharrayWire(node.strokeDasharray) === command.value
    )
      return;
    return { strokeDasharray: command.value === 'solid' ? 'none' : '6,6' };
  }
  if (command.kind === 'dash' || command.kind === 'gap') {
    const n = strokeNumber(command.value);
    if (n === undefined || n === 0) return;
    const { dashPx, gapPx } = parseDashGapPxFromWire(node.strokeDasharray);
    if (
      strokeStyleFromDasharrayWire(node.strokeDasharray) === 'dashed' &&
      n === (command.kind === 'dash' ? dashPx : gapPx)
    )
      return;
    return {
      strokeDasharray:
        command.kind === 'dash' ? `${n},${gapPx}` : `${dashPx},${n}`,
    };
  }
  if (command.kind === 'choice') {
    const allowed: readonly string[] = choices[command.field];
    if (
      typeof command.value !== 'string' ||
      !allowed.includes(command.value) ||
      (node[command.field] ?? allowed[0]) === command.value
    )
      return;
    return { [command.field]: command.value };
  }
  if (command.kind === 'bind') {
    if (
      typeof command.key !== 'string' ||
      api.getAppState().variables[command.key]?.type !== 'number'
    )
      return;
    return { strokeWidth: `$${command.key}` };
  }
  const raw = node.strokeWidth;
  if (!isDesignVariableReference(raw)) return;
  const { variables, themeMode } = api.getAppState();
  const strokeWidth = strokeNumber(
    resolveDesignVariableValue(raw, variables, themeMode),
  );
  if (strokeWidth !== undefined) return { strokeWidth };
}

/** Capture the canvas, target and input; resolve dependent geometry at commit. */
export async function editStrokeGeometry(
  api: API,
  id: string | undefined,
  input: StrokeGeometryCommand,
) {
  const source = id && api.getNodeById(id);
  if (!source || source.isDeleted) return false;
  const { type } = source;
  const command = { ...input };
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    return await api.edit(
      (editor) => {
        const node = editor.getNodeById(id);
        if (
          !node ||
          node.isDeleted ||
          node.locked ||
          node.type !== type ||
          !editor.getEntity(node)
        ) {
          controller.abort();
          return;
        }
        const wire = node as GeometryWire;
        const patch = resolvePatch(editor, wire, command);
        if (
          !patch ||
          Object.entries(patch).every(
            ([key, value]) => wire[key as keyof GeometryWire] === value,
          )
        ) {
          // Empty records would capture unrelated pending document edits.
          controller.abort();
          return;
        }
        editor.updateNode(node, patch as Partial<SerializedNode>);
      },
      { signal: controller.signal },
    );
  } catch (error) {
    if (!controller.signal.aborted) console.error(error);
    return false;
  } finally {
    dispose();
  }
}
