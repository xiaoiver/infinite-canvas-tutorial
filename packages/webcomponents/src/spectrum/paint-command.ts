import {
  API,
  SerializedNode,
  SerializedFillLayerItem,
  isDesignVariableReference,
  migrateLegacyFillWireInPlace,
  migrateLegacyStrokeWireInPlace,
  resolveDesignVariableValue,
} from '@infinite-canvas-tutorial/ecs';
import type { ColorPickerChangeDetail } from './color-picker';
import { applyImageFillChangeFields } from './image-fill-fields';
import { normalizeSolidCssValue } from './normalize-solid-css';

type PaintField = 'fills' | 'strokes';
type PaintCommand =
  | ({ kind: 'color' } & ColorPickerChangeDetail)
  | { kind: 'opacity'; value: number }
  | { kind: 'bind'; field: 'value' | 'opacity'; key: string }
  | { kind: 'unbind'; field: 'value' | 'opacity' }
  | { kind: 'add'; layer: SerializedFillLayerItem }
  | { kind: 'remove' }
  | { kind: 'toggle' }
  | { kind: 'value'; value: string };

/** Read legacy paint without mutating the document during rendering. */
export function paintLayers(node: SerializedNode, field: PaintField) {
  const wire = { ...node } as unknown as Record<string, unknown>;
  if (field === 'fills') migrateLegacyFillWireInPlace(wire);
  else migrateLegacyStrokeWireInPlace(wire);
  return (wire[field] as SerializedFillLayerItem[] | undefined) ?? [];
}

export function primaryPaint(
  node: SerializedNode | undefined,
  field: PaintField,
  fallback: SerializedFillLayerItem,
): SerializedFillLayerItem {
  const layer = node && paintLayers(node, field)[0];
  return { ...(layer ?? fallback) };
}

// Paint wire has no persistent layer IDs. Preserve identity across our own
// immutable layer patches without adding editor-only metadata to the document.
// Replaced objects (including undo/import) invalidate an old row's commands;
// array reorders that retain the objects can still locate their original layer.
const identities = new WeakMap<API, WeakMap<SerializedFillLayerItem, object>>();
function layerIdentity(api: API, layer: SerializedFillLayerItem) {
  let layers = identities.get(api);
  if (!layers) identities.set(api, (layers = new WeakMap()));
  let identity = layers.get(layer);
  if (!identity) layers.set(layer, (identity = {}));
  return identity;
}

/** Edit a captured paint layer, or the first layer for toolbar shortcuts. */
export async function editPaint(
  api: API,
  id: string | undefined,
  field: PaintField,
  input: PaintCommand,
  fallback: SerializedFillLayerItem,
  target?: SerializedFillLayerItem,
) {
  const source = id && api.getNodeById(id);
  if (!source || source.isDeleted) return false;
  const { type } = source;
  const command =
    input.kind === 'add'
      ? { ...input, layer: { ...input.layer } }
      : { ...input };
  const identity = target && layerIdentity(api, target);
  const defaultLayer = { ...fallback };
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
        const layers = paintLayers(node, field);
        if (command.kind === 'add') {
          editor.updateNode(node, {
            [field]: [...layers, command.layer],
          } as Partial<SerializedNode>);
          return;
        }
        const matches =
          identity &&
          layers.flatMap((layer, index) =>
            layerIdentity(api, layer) === identity ? [index] : [],
          );
        if (matches && matches.length !== 1) {
          controller.abort();
          return;
        }
        const index = matches ? matches[0] : 0;
        const layer = layers[index] ?? defaultLayer;
        if (command.kind === 'remove') {
          if (!layers[index]) {
            controller.abort();
            return;
          }
          editor.updateNode(node, {
            [field]: layers.filter((_, i) => i !== index),
          } as Partial<SerializedNode>);
          return;
        }
        let next: SerializedFillLayerItem = { ...layer };
        if (command.kind === 'toggle') {
          next.enabled = layer.enabled === false;
        } else if (command.kind === 'value') {
          const raw = command.value.trim();
          if (!raw) {
            controller.abort();
            return;
          }
          next.value =
            layer.type === 'solid' ? normalizeSolidCssValue(raw) : raw;
        } else if (command.kind === 'color') {
          const { value, type: colorType } = command;
          if (
            typeof value !== 'string' ||
            !['none', 'solid', 'gradient', 'image'].includes(colorType)
          ) {
            controller.abort();
            return;
          }
          next = {
            ...layer,
            type:
              colorType === 'gradient' || colorType === 'image'
                ? colorType
                : 'solid',
            value:
              colorType === 'none'
                ? 'none'
                : colorType === 'solid'
                ? normalizeSolidCssValue(value)
                : value,
          };
          if (next.type === 'image')
            next = applyImageFillChangeFields(next, command);
          const opacity =
            field === 'fills' ? command.fillOpacity : command.strokeOpacity;
          if (opacity !== undefined) {
            if (!Number.isFinite(opacity)) {
              controller.abort();
              return;
            }
            next.opacity = Math.max(0, Math.min(1, opacity));
          }
        } else if (command.kind === 'opacity') {
          if (!Number.isFinite(command.value)) {
            controller.abort();
            return;
          }
          next.opacity = Math.max(0, Math.min(1, command.value));
        } else if (command.kind === 'bind') {
          const variable = editor.getAppState().variables[command.key];
          if (
            !variable ||
            variable.type !== (command.field === 'value' ? 'color' : 'number')
          ) {
            controller.abort();
            return;
          }
          next[command.field] = `$${command.key}`;
        } else {
          const raw = layer[command.field];
          if (!isDesignVariableReference(raw)) {
            controller.abort();
            return;
          }
          const { variables, themeMode } = editor.getAppState();
          const resolved: unknown = resolveDesignVariableValue(
            raw,
            variables,
            themeMode,
          );
          if (
            resolved == null ||
            (typeof resolved === 'string' && resolved.startsWith('$'))
          ) {
            controller.abort();
            return;
          }
          if (command.field === 'opacity') {
            const n =
              typeof resolved === 'number'
                ? resolved
                : typeof resolved === 'string' && resolved.trim()
                ? Number(resolved)
                : NaN;
            if (!Number.isFinite(n)) {
              controller.abort();
              return;
            }
            next.opacity = Math.max(0, Math.min(1, n));
          } else {
            if (typeof resolved !== 'string') {
              controller.abort();
              return;
            }
            next.value =
              layer.type === 'solid'
                ? normalizeSolidCssValue(resolved)
                : resolved;
          }
        }
        if (layers.length && JSON.stringify(next) === JSON.stringify(layer)) {
          // An empty record would capture unrelated pending edits.
          controller.abort();
          return;
        }
        // Carry the logical identity to the replacement before the next queued edit.
        const nextIdentity = layerIdentity(api, layer);
        identities.get(api)!.set(next, nextIdentity);
        editor.updateNode(node, {
          [field]: layers.length
            ? layers.map((item, i) => (i === index ? next : item))
            : [next],
        } as Partial<SerializedNode>);
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
