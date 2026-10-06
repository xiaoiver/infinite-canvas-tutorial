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
  | { kind: 'unbind'; field: 'value' | 'opacity' };

/** Read legacy paint without mutating the document during rendering. */
function paintLayers(node: SerializedNode, field: PaintField) {
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

/** Edit the first paint layer; retain the latest remaining layers and metadata. */
export async function editPaint(
  api: API,
  id: string | undefined,
  field: PaintField,
  input: PaintCommand,
  fallback: SerializedFillLayerItem,
) {
  const source = id && api.getNodeById(id);
  if (!source || source.isDeleted) return false;
  const { type } = source;
  const command = { ...input };
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
        const layer = layers[0] ?? defaultLayer;
        let next: SerializedFillLayerItem = { ...layer };
        if (command.kind === 'color') {
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
        editor.updateNode(node, {
          [field]: [next, ...layers.slice(1)],
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
