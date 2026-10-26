import { documentValueEqual } from '../../document';
import type {
  RefSerializedNode,
  SerializedNode,
} from '../../types/serialized-node';
import { expandRefSerializedNodes } from '../deserialize/expand-ref-nodes';
import { hasUnsupportedPaintFillOverride } from './paint-fill-override';

const PROP_KEYS = [
  'content',
  'fills',
  'fontSize',
  'cornerRadius',
  'width',
  'height',
  'strokeWidth',
  'strokes',
  'opacity',
  'visibility',
  'blendMode',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'fontKerning',
  'fontFamily',
  'textAlign',
  'wordWrapWidth',
  'letterSpacing',
  'lineHeight',
  'decorationLine',
  'decorationStyle',
  'decorationColor',
  'decorationThickness',
  'dropShadowColor',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'dropShadowBlurRadius',
  'padding',
  'margin',
  'gap',
  'rowGap',
  'columnGap',
  'flexDirection',
  'alignItems',
  'justifyContent',
  'flexWrap',
  'alignSelf',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'anchorX',
] as const;
const DIMENSION_KEYS = new Set(['width', 'height']);
const ROOT_POSITION_KEYS = new Set(['parentId', 'x', 'y', 'zIndex', 'name']);
const TEXT_LAYOUT_KEYS = new Set(['width', 'height']);
const TRANSIENT_KEYS = new Set(['version', 'versionNonce', 'updated']);
const REF_IDENTITY_KEYS = new Set([
  'id',
  'type',
  'parentId',
  'ref',
  'x',
  'y',
  'zIndex',
  'name',
  'descendants',
]);

type NodeRecord = SerializedNode & Record<string, unknown>;

function hasUnsupportedStrokes(strokes: unknown): boolean {
  if (strokes === undefined) return false;
  if (!Array.isArray(strokes) || strokes.length > 1) return true;
  return strokes.some(
    (layer) =>
      layer.type !== 'solid' ||
      layer.enabled === false ||
      (layer.opacity !== undefined && layer.opacity !== 1) ||
      (layer.blendMode !== undefined && layer.blendMode !== 'normal'),
  );
}

function descendantIds(rootId: string, nodes: readonly SerializedNode[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  const ids = new Set([rootId]);
  const pending = [rootId];
  while (pending.length) {
    for (const child of childrenByParent.get(pending.pop()!) ?? []) {
      if (ids.has(child)) continue;
      ids.add(child);
      pending.push(child);
    }
  }
  return ids;
}

function hasUnsupportedChange(
  baseline: NodeRecord,
  current: NodeRecord,
  root: boolean,
  template: NodeRecord,
) {
  if (baseline.type !== current.type) return true;
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const key of keys) {
    if (key === 'id' || key === 'type' || TRANSIENT_KEYS.has(key)) continue;
    if (key === 'anchorX' && baseline.type === 'text') {
      if (documentValueEqual(baseline[key], current[key])) continue;
      if (!documentValueEqual(baseline.textAlign, current.textAlign)) continue;
      return true;
    }
    if (
      key === 'wordWrapWidth' &&
      baseline.type === 'text' &&
      (template.wordWrap !== true ||
        typeof template.wordWrapWidth !== 'number' ||
        template.wordWrapWidth <= 0)
    ) {
      if (!documentValueEqual(baseline[key], current[key])) return true;
    }
    if (PROP_KEYS.some((prop) => prop === key)) continue;
    if (root && ROOT_POSITION_KEYS.has(key)) continue;
    if (baseline.type === 'text' && TEXT_LAYOUT_KEYS.has(key)) continue;
    if ((key === 'width' || key === 'height') && template[key] === undefined)
      continue;
    if (!documentValueEqual(baseline[key], current[key])) return true;
  }
  return false;
}

/**
 * Recover a scene's reusable/ref source graph after the editor has expanded
 * instances for rendering. Supported text, color, typography, opacity,
 * explicit size, flex layout, solid border, and drop shadow edits become ref overrides.
 * Text alignment also preserves the editor's adjusted anchor. Other instance
 * or template edits fall back to the visible expanded graph.
 */
export function reconcileRefInstances(
  source: readonly SerializedNode[],
  baseline: readonly SerializedNode[],
  current: readonly SerializedNode[],
): SerializedNode[] {
  const refs = source.filter(
    (node): node is RefSerializedNode => node.type === 'ref',
  );
  if (!refs.length) return [...current];

  const baselineById = new Map(baseline.map((node) => [node.id, node]));
  const currentById = new Map(current.map((node) => [node.id, node]));
  const sourceById = new Map(source.map((node) => [node.id, node]));
  const templateIds = new Set<string>();
  for (const node of source) {
    if (!node.reusable) continue;
    for (const id of descendantIds(node.id, source)) templateIds.add(id);
  }
  const flattened = () => current.filter((node) => !templateIds.has(node.id));
  for (const id of templateIds) {
    const before = baselineById.get(id) as NodeRecord | undefined;
    const after = currentById.get(id) as NodeRecord | undefined;
    if (!before || !after) return flattened();
    if (
      Object.keys({ ...before, ...after }).some(
        (key) =>
          !TRANSIENT_KEYS.has(key) &&
          !documentValueEqual(before[key], after[key]),
      )
    )
      return flattened();
  }
  if (
    current.some(
      (node) =>
        node.parentId &&
        templateIds.has(node.parentId) &&
        !templateIds.has(node.id),
    )
  ) {
    return flattened();
  }

  const expandedIds = new Set<string>();
  const recovered: RefSerializedNode[] = [];
  for (const ref of refs) {
    if (
      hasUnsupportedStrokes(ref.strokes) ||
      Object.values(ref.descendants ?? {}).some((patch) =>
        hasUnsupportedStrokes(patch.strokes),
      ) ||
      Object.keys(ref).some(
        (key) =>
          !REF_IDENTITY_KEYS.has(key) &&
          !TRANSIENT_KEYS.has(key) &&
          (!PROP_KEYS.some((prop) => prop === key) ||
            (key === 'anchorX' && !('textAlign' in ref))),
      ) ||
      Object.values(ref.descendants ?? {}).some((patch) =>
        Object.keys(patch).some(
          (key) =>
            !PROP_KEYS.some((prop) => prop === key) ||
            (key === 'anchorX' && !('textAlign' in patch)),
        ),
      )
    )
      return flattened();
    const expanded = expandRefSerializedNodes([ref], source);
    const expectedIds = new Set(expanded.map((node) => node.id));
    for (const id of expectedIds) expandedIds.add(id);
    const currentRoot = currentById.get(ref.id);
    if (!currentRoot) {
      if (expanded.some((node) => currentById.has(node.id))) return flattened();
      continue;
    }
    for (const node of expanded) {
      const before = baselineById.get(node.id) as NodeRecord | undefined;
      const after = currentById.get(node.id) as NodeRecord | undefined;
      const templateId =
        node.id === ref.id
          ? ref.ref
          : node.id.slice(ref.id.length + '__'.length);
      const template = sourceById.get(templateId) as NodeRecord | undefined;
      if (!before || !after || !template) return flattened();
      if (
        hasUnsupportedPaintFillOverride(
          template.fills,
          after.fills,
          template.type === 'rect' ||
            template.type === 'rough-rect' ||
            template.type === 'g' ||
            template.type === 'ellipse',
        )
      )
        return flattened();
      if (hasUnsupportedChange(before, after, node.id === ref.id, template))
        return flattened();
    }
    if (
      current.some(
        (node) =>
          node.parentId &&
          expectedIds.has(node.parentId) &&
          !expectedIds.has(node.id),
      )
    ) {
      return flattened();
    }

    const next = structuredClone(ref);
    next.parentId = currentRoot.parentId;
    next.x = currentRoot.x;
    next.y = currentRoot.y;
    next.zIndex = currentRoot.zIndex;
    next.name = currentRoot.name;
    const descendants = { ...next.descendants };
    for (const node of expanded) {
      const templateId =
        node.id === ref.id
          ? ref.ref
          : node.id.slice(ref.id.length + '__'.length);
      const template = sourceById.get(templateId) as NodeRecord | undefined;
      const rendered = currentById.get(node.id) as NodeRecord | undefined;
      if (!template || !rendered) return flattened();
      if (hasUnsupportedStrokes(rendered.strokes)) return flattened();
      const patch = {
        ...(node.id === ref.id ? next : descendants[templateId]),
      } as Record<string, unknown>;
      for (const key of PROP_KEYS) {
        if (
          key === 'anchorX' &&
          template[key] === undefined &&
          rendered[key] === 0
        ) {
          delete patch[key];
          continue;
        }
        if (DIMENSION_KEYS.has(key) && template[key] === undefined) {
          delete patch[key];
          continue;
        }
        if (documentValueEqual(rendered[key], template[key])) delete patch[key];
        else patch[key] = structuredClone(rendered[key]);
      }
      if (node.id === ref.id) {
        for (const key of PROP_KEYS) {
          if (key in patch) Reflect.set(next, key, patch[key]);
          else Reflect.deleteProperty(next, key);
        }
      } else {
        const overrides = Object.fromEntries(
          PROP_KEYS.filter((key) => key in patch).map((key) => [
            key,
            patch[key],
          ]),
        );
        if (Object.keys(overrides).length) descendants[templateId] = overrides;
        else delete descendants[templateId];
      }
    }
    next.descendants = descendants;
    recovered.push(next);
  }

  return [...current.filter((node) => !expandedIds.has(node.id)), ...recovered];
}
