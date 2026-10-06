import { API, type SerializedNode } from '@infinite-canvas-tutorial/ecs';
import {
  createDefaultEffect,
  formatFilter,
  parseEffect,
  type DefaultEffectKind,
  type Effect,
} from '@infinite-canvas-tutorial/filter';

export type EffectCommand =
  | { kind: 'add'; effectKind: string }
  | { kind: 'replace'; effectKind: string }
  | { kind: 'remove' }
  | { kind: 'move'; delta: -1 | 1 }
  | { kind: 'patch'; patch: object }
  | {
      kind: 'color-stop';
      action: 'add' | 'remove' | 'set';
      index?: number;
      value?: string;
    }
  | {
      kind: 'tuple';
      group: 'rainFx' | 'rainFxSim';
      key: string;
      index: number;
      value: number;
      fallback: readonly number[];
      range: boolean;
    };

type Row = { identity: object; effect: Effect };
type Stack = { wire: string; rows: Row[]; revision: number };
const stacks = new WeakMap<API, Map<string, Stack>>();
const identities = new WeakMap<Effect, object>();
const colorStops = new WeakMap<Effect, object[]>();
const kinds: readonly DefaultEffectKind[] = [
  'brightness',
  'contrast',
  'saturate',
  'noise',
  'fxaa',
  'blur',
  'pixelate',
  'dot',
  'colorHalftone',
  'halftoneDots',
  'flutedGlass',
  'crt',
  'vignette',
  'ascii',
  'glitch',
  'liquidGlass',
  'liquidMetal',
  'heatmap',
  'gemSmoke',
  'lut',
  'tsunami',
  'rain',
  'burn',
  'colorPencil',
];

function row(effect: Effect, identity = {}, stops?: object[]) {
  identities.set(effect, identity);
  const colors = (effect as { colors?: string[] }).colors;
  if (colors) colorStops.set(effect, stops ?? colors.map(() => ({})));
  return { effect, identity };
}

// Filter wire is a string, with no persistent row IDs. Track identities only
// across our own commits. External replacements/undo invalidate rendered rows.
function stack(api: API, node: SerializedNode): Stack {
  let nodes = stacks.get(api);
  if (!nodes) {
    stacks.set(api, (nodes = new Map()));
    api.onDestroy(() => nodes.clear());
  }
  const wire = (node as { filter?: string }).filter ?? '';
  let current = nodes.get(node.id);
  if (!current || current.wire !== wire) {
    current = {
      wire,
      rows: parseEffect(wire).map((effect) => row(effect)),
      revision: 0,
    };
    nodes.set(node.id, current);
  }
  return current;
}

export function effectRows(api: API, node: SerializedNode) {
  return stack(api, node).rows.map(({ effect }) => effect);
}

function valid(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return value !== undefined;
  return Object.entries(value).every(
    ([key, child]) =>
      !['__proto__', 'prototype', 'constructor'].includes(key) && valid(child),
  );
}

function merge(current: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const next = { ...(current as object) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch))
    next[key] = merge(next[key], value);
  return next;
}

/** All targets are validated and prepared before the first write. */
export async function editEffects(
  api: API,
  ids: readonly string[],
  input: EffectCommand,
  effect?: Effect,
  mixed = false,
) {
  const command = structuredClone(input);
  if (!valid(command)) return false;
  if (
    (command.kind === 'add' || command.kind === 'replace') &&
    !kinds.includes(command.effectKind as DefaultEffectKind)
  )
    return false;
  const identity = effect && identities.get(effect);
  const nodes = [...new Set(ids)].map((id) => api.getNodeById(id));
  if (!nodes.length || nodes.some((node) => !node || node.isDeleted))
    return false;
  const first = stack(api, nodes[0]);
  const index = first.rows.findIndex((item) => item.identity === identity);
  if (command.kind !== 'add' && index < 0) return false;
  const stop =
    command.kind === 'color-stop' && command.action !== 'add'
      ? colorStops.get(effect)?.[command.index]
      : undefined;
  const stopIndex = first.rows[index]
    ? colorStops.get(first.rows[index].effect)?.indexOf(stop)
    : -1;
  const targets = nodes.map((node) => {
    const current = stack(api, node);
    return {
      id: node.id,
      type: node.type,
      stack: current,
      identity: current.rows[index]?.identity,
      stop:
        current.rows[index] &&
        colorStops.get(current.rows[index].effect)?.[stopIndex],
      reset: mixed ? current.revision : undefined,
    };
  });
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    return await api.edit(
      (editor) => {
        const changes: {
          node: SerializedNode;
          stack: Stack;
          wire: string;
          rows: Row[];
        }[] = [];
        for (const target of targets) {
          const node = editor.getNodeById(target.id);
          if (
            !node ||
            node.isDeleted ||
            node.locked ||
            node.type !== target.type ||
            !editor.getEntity(node) ||
            stack(editor, node) !== target.stack
          ) {
            controller.abort();
            return;
          }
          const current = target.stack;
          let rows = [...current.rows];
          const i = rows.findIndex((item) => item.identity === target.identity);
          if (command.kind === 'add') {
            if (target.reset !== undefined && current.revision === target.reset)
              rows = [];
            rows.push(
              row(createDefaultEffect(command.effectKind as DefaultEffectKind)),
            );
          } else {
            if (
              i < 0 ||
              ((command.kind === 'patch' ||
                command.kind === 'tuple' ||
                command.kind === 'color-stop') &&
                rows[i].effect.type !== effect.type)
            ) {
              controller.abort();
              return;
            }
            if (command.kind === 'remove') rows.splice(i, 1);
            else if (command.kind === 'move') {
              const j = i + command.delta;
              if (j < 0 || j >= rows.length) continue;
              [rows[i], rows[j]] = [rows[j], rows[i]];
            } else if (command.kind === 'replace') {
              const next = createDefaultEffect(
                command.effectKind as DefaultEffectKind,
              );
              // Choosing the current kind must not reset its parameters.
              if (next.type === rows[i].effect.type) continue;
              rows[i] = row(next, rows[i].identity);
            } else if (command.kind === 'color-stop') {
              const colors = [
                ...((rows[i].effect as { colors?: string[] }).colors ?? []),
              ];
              const stops = [...(colorStops.get(rows[i].effect) ?? [])];
              const position = stops.indexOf(target.stop);
              if (command.action === 'add') {
                if (
                  colors.length >= (rows[i].effect.type === 'gemSmoke' ? 6 : 10)
                )
                  continue;
                colors.push('#888888');
                stops.push({});
              } else {
                if (position < 0) {
                  controller.abort();
                  return;
                }
                if (command.action === 'remove') {
                  if (colors.length <= 1) continue;
                  colors.splice(position, 1);
                  stops.splice(position, 1);
                } else {
                  if (!command.value?.trim()) {
                    controller.abort();
                    return;
                  }
                  colors[position] = command.value;
                }
              }
              rows[i] = row(
                { ...rows[i].effect, colors } as Effect,
                rows[i].identity,
                stops,
              );
            } else if (command.kind === 'tuple') {
              const source = rows[i].effect as unknown as Record<
                string,
                Record<string, number[]>
              >;
              const values = [
                ...(source[command.group]?.[command.key] ?? command.fallback),
              ];
              if (
                !Number.isInteger(command.index) ||
                command.index < 0 ||
                command.index >= values.length
              ) {
                controller.abort();
                return;
              }
              values[command.index] = command.value;
              if (command.range) {
                if (command.index === 0)
                  values[1] = Math.max(values[0], values[1]);
                else values[0] = Math.min(values[0], values[1]);
              }
              rows[i] = row(
                merge(rows[i].effect, {
                  [command.group]: { [command.key]: values },
                }) as Effect,
                rows[i].identity,
              );
            } else {
              rows[i] = row(
                merge(rows[i].effect, command.patch) as Effect,
                rows[i].identity,
                colorStops.get(rows[i].effect),
              );
            }
          }
          const wire = formatFilter(rows.map(({ effect }) => effect));
          if (
            wire === current.wire ||
            (wire === formatFilter(current.rows.map(({ effect }) => effect)) &&
              parseEffect(wire).length === current.rows.length)
          )
            continue;
          const parsed = parseEffect(wire);
          // The formatter omits unsupported effects. Never lose a neighbouring row.
          if (parsed.length !== rows.length) {
            controller.abort();
            return;
          }
          changes.push({
            node,
            stack: current,
            wire,
            rows: parsed.map((value, i) =>
              row(value, rows[i].identity, colorStops.get(rows[i].effect)),
            ),
          });
        }
        if (!changes.length) {
          controller.abort();
          return;
        }
        for (const target of targets) target.stack.revision++;
        for (const change of changes) {
          editor.updateNode(change.node, { filter: change.wire });
          change.stack.wire = change.wire;
          change.stack.rows = change.rows;
        }
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
