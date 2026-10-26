/**
 * `.ic` SerializedNode[] → 框架无关的 {@link CodeIR}。
 *
 * 这是 design-to-code 工作量的主体：把场景图节点按「概念映射表」翻译为元素 + 结构化样式 +
 * 组件定义。具体框架的字符串生成交给各 emitter。
 */
import type {
  IconFontSerializedNode,
  RefSerializedNode,
  SerializedNode,
  SerializedFillLayerItem,
  TextSerializedNode,
} from '../../types/serialized-node';
import {
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  resolveSerializedNodesDesignVariables,
  type DesignVariablesMap,
} from '../design-variables';
import { expandRefSerializedNodes } from '../deserialize/expand-ref-nodes';
import type { ThemeMode } from '../../components/Theme';
import { toComponentName, toPropName } from './string-utils';
import { boxToCss, styleValueToCss } from './emit-style';
import type {
  CodeBindingTarget,
  CodeComponentDef,
  CodeComponentProp,
  CodeIR,
  CodeNode,
  CodeNodeRole,
  CodeSemanticElement,
  CodegenOptions,
  CodeVariablesMode,
  StyleIR,
  StyleValue,
} from './types';

type AnyNode = SerializedNode & Record<string, unknown>;

/** 实例覆盖键（含合成的 `dropShadow`）→ prop 绑定目标。 */
const OVERRIDABLE_KEY_TO_TARGET: Record<string, CodeBindingTarget> = {
  content: 'text',
  fontSize: 'fontSize',
  cornerRadius: 'borderRadius',
  width: 'width',
  height: 'height',
  strokeWidth: 'borderWidth',
  opacity: 'opacity',
  fontWeight: 'fontWeight',
  fontStyle: 'fontStyle',
  fontFamily: 'fontFamily',
  textAlign: 'textAlign',
  letterSpacing: 'letterSpacing',
  lineHeight: 'lineHeight',
  dropShadow: 'boxShadow',
  padding: 'padding',
  margin: 'margin',
  gap: 'gap',
  rowGap: 'rowGap',
  columnGap: 'columnGap',
  flexDirection: 'flexDirection',
  alignItems: 'alignItems',
  justifyContent: 'justifyContent',
  flexWrap: 'flexWrap',
  alignSelf: 'alignSelf',
  flexGrow: 'flexGrow',
  flexShrink: 'flexShrink',
  flexBasis: 'flexBasis',
  minWidth: 'minWidth',
  maxWidth: 'maxWidth',
  minHeight: 'minHeight',
  maxHeight: 'maxHeight',
};

const SHADOW_KEYS = new Set([
  'dropShadowColor',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'dropShadowBlurRadius',
]);

function shadowStyleValue(
  template: AnyNode,
  patch: Record<string, unknown> | undefined,
  mode: CodeVariablesMode,
): StyleValue {
  const shadow = { ...template, ...patch };
  const color = toStyleValue(shadow.dropShadowColor as string);
  if (!color || color.literal === 'none') return { literal: 'none' };
  const px = (raw: unknown) =>
    styleValueToCss(
      toStyleValue(raw as string | number) ?? { literal: 0 },
      mode,
      true,
    );
  return {
    literal: `${px(shadow.dropShadowOffsetX)} ${px(
      shadow.dropShadowOffsetY,
    )} ${px(shadow.dropShadowBlurRadius)} ${styleValueToCss(color, mode)}`,
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** 把一个值包装为 {@link StyleValue}：`$token` → token，其余 → literal。 */
function toStyleValue(
  raw: string | number | null | undefined,
): StyleValue | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string' && isDesignVariableReference(raw)) {
    return { token: designVariableRefKeyFromWire(raw) };
  }
  return { literal: raw };
}

/** 取填充/描边栈里第一层启用的 solid 颜色（含 `$token`）。 */
function primaryColorFromLayers(
  layers: SerializedFillLayerItem[] | undefined,
): StyleValue | undefined {
  if (!layers || layers.length === 0) {
    return undefined;
  }
  for (const layer of layers) {
    if (layer.enabled === false) {
      continue;
    }
    if (layer.type === 'solid') {
      return toStyleValue(layer.value);
    }
  }
  return undefined;
}

/** 取第一层启用的 image 资源 URL。 */
function primaryImageFromLayers(
  layers: SerializedFillLayerItem[] | undefined,
): StyleValue | undefined {
  if (!layers) {
    return undefined;
  }
  for (const layer of layers) {
    if (layer.enabled === false) {
      continue;
    }
    if (layer.type === 'image') {
      return toStyleValue(layer.value);
    }
  }
  return undefined;
}

function normalizeBox(
  v: number | number[] | undefined,
): [number, number, number, number] | undefined {
  if (v === undefined) {
    return undefined;
  }
  if (typeof v === 'number') {
    return [v, v, v, v];
  }
  if (v.length === 2) {
    return [v[0], v[1], v[0], v[1]];
  }
  if (v.length === 4) {
    return [v[0], v[1], v[2], v[3]];
  }
  if (v.length === 1) {
    return [v[0], v[0], v[0], v[0]];
  }
  return undefined;
}

function decideRole(node: AnyNode): CodeNodeRole {
  switch (node.type) {
    case 'text':
      return 'text';
    case 'iconfont':
      return 'icon';
    case 'g':
      return 'container';
    case 'rect':
    case 'rough-rect': {
      const fills = asArray<SerializedFillLayerItem>(node.fills);
      if (fills.some((l) => l.type === 'image' && l.enabled !== false)) {
        return 'image';
      }
      // flex 容器或有子节点者视作容器
      return 'container';
    }
    default:
      return 'shape';
  }
}

/** 把节点上的样式相关字段映射为结构化 {@link StyleIR}。 */
function buildStyle(
  node: AnyNode,
  role: CodeNodeRole,
  hasChildren: boolean,
): StyleIR {
  const style: StyleIR = {};

  // flex 布局
  if (node.display === 'flex') {
    style.display = 'flex';
    if (node.flexDirection) style.flexDirection = node.flexDirection as never;
    if (node.alignItems) style.alignItems = node.alignItems as never;
    if (node.justifyContent)
      style.justifyContent = node.justifyContent as never;
    if (node.flexWrap && node.flexWrap !== 'nowrap')
      style.flexWrap = node.flexWrap as never;
    if (typeof node.gap === 'number') style.gap = node.gap;
    if (typeof node.rowGap === 'number') style.rowGap = node.rowGap;
    if (typeof node.columnGap === 'number') style.columnGap = node.columnGap;
  }
  if (typeof node.flexGrow === 'number' && node.flexGrow)
    style.flexGrow = node.flexGrow;
  if (typeof node.flexShrink === 'number') style.flexShrink = node.flexShrink;
  if (node.alignSelf && node.alignSelf !== 'auto')
    style.alignSelf = node.alignSelf as never;
  if (typeof node.flexBasis === 'number') style.flexBasis = node.flexBasis;

  const padding = normalizeBox(node.padding as number | number[] | undefined);
  if (padding) style.padding = padding;
  const margin = normalizeBox(node.margin as number | number[] | undefined);
  if (margin) style.margin = margin;

  // 反序列化会把未指定尺寸的 flex 容器补为 0；有子节点时应让 CSS 按内容计算。
  const autoSizedContainer =
    role === 'container' && node.display === 'flex' && hasChildren;
  // 尺寸：容器/图片/形状写显式宽高；文本随内容，不强制尺寸
  if (role !== 'text') {
    if (typeof node.width === 'number' && (!autoSizedContainer || node.width))
      style.width = node.width;
    if (typeof node.height === 'number' && (!autoSizedContainer || node.height))
      style.height = node.height;
  }
  if (typeof node.minWidth === 'number') style.minWidth = node.minWidth;
  if (typeof node.maxWidth === 'number') style.maxWidth = node.maxWidth;
  if (typeof node.minHeight === 'number') style.minHeight = node.minHeight;
  if (typeof node.maxHeight === 'number') style.maxHeight = node.maxHeight;

  const fills = asArray<SerializedFillLayerItem>(node.fills);
  const fillColor = primaryColorFromLayers(fills);
  if (role === 'text' || role === 'icon') {
    if (fillColor) style.color = fillColor;
  } else if (role !== 'image' && fillColor) {
    style.backgroundColor = fillColor;
  }

  // 描边 → border
  const strokes = asArray<SerializedFillLayerItem>(node.strokes);
  const strokeColor =
    primaryColorFromLayers(strokes) ?? toStyleValue(node.stroke as string);
  if (typeof node.strokeWidth === 'number' && node.strokeWidth > 0) {
    style.borderWidth = { literal: node.strokeWidth };
    if (strokeColor) style.borderColor = strokeColor;
  }

  if (node.cornerRadius !== undefined) {
    const r = toStyleValue(node.cornerRadius as number);
    if (r) style.borderRadius = r;
  }

  if (
    typeof node.dropShadowColor === 'string' ||
    typeof node.dropShadowBlurRadius === 'number'
  ) {
    const color = toStyleValue(node.dropShadowColor as string);
    if (color && color.literal !== 'none') {
      style.boxShadow = {
        offsetX: (node.dropShadowOffsetX as number) ?? 0,
        offsetY: (node.dropShadowOffsetY as number) ?? 0,
        blur: (node.dropShadowBlurRadius as number) ?? 0,
        color,
      };
    }
  }

  if (typeof node.opacity === 'number' && node.opacity !== 1) {
    style.opacity = node.opacity;
  }

  // 文本排版
  if (role === 'text') {
    const fs = toStyleValue(node.fontSize as number);
    if (fs) style.fontSize = fs;
    if (node.fontWeight !== undefined)
      style.fontWeight = node.fontWeight as string | number;
    if (node.fontStyle && node.fontStyle !== 'normal')
      style.fontStyle = node.fontStyle as string;
    if (typeof node.fontFamily === 'string') style.fontFamily = node.fontFamily;
    if (node.textAlign) style.textAlign = node.textAlign as never;
    const ls = toStyleValue(node.letterSpacing as number);
    if (ls) style.letterSpacing = ls;
    const lh = toStyleValue(node.lineHeight as number);
    if (lh && lh.literal !== 0) style.lineHeight = lh;
  }

  return style;
}

interface BuildContext {
  childrenByParent: Map<string | undefined, AnyNode[]>;
  semanticElements: Record<string, CodeSemanticElement>;
  byId: Map<string, AnyNode>;
  templateToComponentName: Map<string, string>;
  /** 模板 id → 该模板被实例覆盖过的 (key) 集合，用于推断 props。 */
  overridesByTemplate: Map<string, Set<string>>;
  variablesMode: CodeVariablesMode;
}

function sortChildren(nodes: AnyNode[]): AnyNode[] {
  return [...nodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

/** 递归构建一个节点的 {@link CodeNode}（不含组件实例化）。 */
function buildCodeNode(
  node: AnyNode,
  ctx: BuildContext,
  bindingsForTemplate?: Set<string>,
): CodeNode {
  if (node.type === 'ref') {
    const instance = buildInstanceNode(
      node as RefSerializedNode,
      ctx.templateToComponentName,
      ctx.byId,
      ctx.variablesMode,
    );
    if (instance) return instance;
  }
  const role = decideRole(node);
  const children = sortChildren(ctx.childrenByParent.get(node.id) ?? []);
  const style = buildStyle(node, role, children.length > 0);
  const codeNode: CodeNode = {
    role,
    id: node.id,
    name: typeof node.name === 'string' ? node.name : undefined,
    element: ctx.semanticElements[node.id],
    style,
    children: [],
  };

  if (role === 'text') {
    const content = (node as TextSerializedNode).content;
    codeNode.text = toStyleValue(content) ?? { literal: '' };
  } else if (role === 'icon') {
    const iconNode = node as IconFontSerializedNode;
    codeNode.icon = {
      name: toStyleValue(iconNode.iconFontName) ?? { literal: '' },
      family:
        typeof iconNode.iconFontFamily === 'string'
          ? iconNode.iconFontFamily
          : 'lucide',
    };
  } else if (role === 'image') {
    codeNode.image = primaryImageFromLayers(
      asArray<SerializedFillLayerItem>(node.fills),
    );
  }

  // 组件 body 内：根据模板被覆盖的键，给该节点挂上 prop 绑定
  if (bindingsForTemplate && bindingsForTemplate.size) {
    for (const key of bindingsForTemplate) {
      const [descId, attr] = key.split('::');
      if (descId !== node.id) {
        continue;
      }
      const target =
        OVERRIDABLE_KEY_TO_TARGET[attr] ?? colorTargetFor(attr, role);
      if (!target) {
        continue;
      }
      codeNode.bindings = codeNode.bindings ?? [];
      codeNode.bindings.push({
        target,
        prop: propNameFor(node, attr),
      });
    }
  }

  codeNode.children = children.map((c) =>
    buildCodeNode(c, ctx, bindingsForTemplate),
  );
  return codeNode;
}

function colorTargetFor(
  attr: string,
  role: CodeNodeRole,
): CodeBindingTarget | undefined {
  if (attr === 'fills' || attr === 'fill') {
    return role === 'text' || role === 'icon' ? 'color' : 'backgroundColor';
  }
  if (attr === 'strokes' || attr === 'stroke') {
    return role === 'container' || role === 'shape' ? 'borderColor' : undefined;
  }
  return undefined;
}

function propNameFor(node: AnyNode, attr: string): string {
  const base = toPropName(
    typeof node.name === 'string' ? node.name : undefined,
    node.id,
  );
  if (attr === 'content') {
    return base;
  }
  return `${base}${attr.charAt(0).toUpperCase()}${attr.slice(1)}`;
}

/** 从覆盖键提取该 descendant 上某属性的 StyleValue。 */
function overrideStyleValue(
  patch: Record<string, unknown> | undefined,
  attr: string,
): StyleValue | undefined {
  if (!patch) {
    return undefined;
  }
  if (attr === 'fills' || attr === 'fill') {
    const fills = asArray<SerializedFillLayerItem>(patch.fills);
    return primaryColorFromLayers(fills) ?? toStyleValue(patch.fill as string);
  }
  if (attr === 'strokes' || attr === 'stroke') {
    const strokes = asArray<SerializedFillLayerItem>(patch.strokes);
    return (
      primaryColorFromLayers(strokes) ?? toStyleValue(patch.stroke as string)
    );
  }
  if (attr === 'padding' || attr === 'margin') {
    const box = normalizeBox(patch[attr] as number | number[] | undefined);
    return box ? { literal: boxToCss(box) } : undefined;
  }
  return toStyleValue(patch[attr] as string | number);
}

/** 从模板节点取某属性的默认 StyleValue。 */
function templateDefaultValue(
  template: AnyNode,
  descId: string,
  attr: string,
  byId: Map<string, AnyNode>,
): StyleValue | undefined {
  const desc = byId.get(descId);
  if (!desc) {
    return undefined;
  }
  if (attr === 'content') {
    return (
      toStyleValue((desc as TextSerializedNode).content) ?? { literal: '' }
    );
  }
  if (attr === 'opacity') {
    return toStyleValue(desc.opacity as number) ?? { literal: 1 };
  }
  if (attr === 'flexDirection') {
    return toStyleValue(desc.flexDirection as string) ?? { literal: 'row' };
  }
  if (attr === 'alignItems') {
    return toStyleValue(desc.alignItems as string) ?? { literal: 'stretch' };
  }
  if (attr === 'justifyContent') {
    return (
      toStyleValue(desc.justifyContent as string) ?? { literal: 'flex-start' }
    );
  }
  if (attr === 'flexWrap') {
    return toStyleValue(desc.flexWrap as string) ?? { literal: 'nowrap' };
  }
  if (attr === 'alignSelf') {
    return toStyleValue(desc.alignSelf as string) ?? { literal: 'auto' };
  }
  if (attr === 'flexGrow') {
    return toStyleValue(desc.flexGrow as number) ?? { literal: 0 };
  }
  if (attr === 'flexShrink') {
    return toStyleValue(desc.flexShrink as number) ?? { literal: 1 };
  }
  if (attr === 'flexBasis') {
    return toStyleValue(desc.flexBasis as number) ?? { literal: 'auto' };
  }
  if (attr === 'minWidth' || attr === 'minHeight') {
    return toStyleValue(desc[attr] as number) ?? { literal: 'auto' };
  }
  if (attr === 'maxWidth' || attr === 'maxHeight') {
    return toStyleValue(desc[attr] as number) ?? { literal: 'none' };
  }
  if (attr === 'fontWeight') {
    return toStyleValue(desc.fontWeight as string | number) ?? { literal: 400 };
  }
  if (attr === 'fontStyle') {
    return toStyleValue(desc.fontStyle as string) ?? { literal: 'normal' };
  }
  if (attr === 'fontFamily' || attr === 'textAlign') {
    return toStyleValue(desc[attr] as string) ?? { literal: 'inherit' };
  }
  if (attr === 'letterSpacing') {
    return (
      toStyleValue(desc.letterSpacing as string | number) ?? {
        literal: 'normal',
      }
    );
  }
  if (attr === 'padding' || attr === 'margin') {
    const box = normalizeBox(desc[attr] as number | number[] | undefined);
    return { literal: box ? boxToCss(box) : '0px' };
  }
  if (attr === 'fills' || attr === 'fill') {
    return (
      primaryColorFromLayers(asArray<SerializedFillLayerItem>(desc.fills)) ?? {
        literal: '#000000',
      }
    );
  }
  if (attr === 'strokes' || attr === 'stroke') {
    return (
      primaryColorFromLayers(asArray<SerializedFillLayerItem>(desc.strokes)) ??
      toStyleValue(desc.stroke as string) ?? { literal: '#000000' }
    );
  }
  return toStyleValue(desc[attr] as string | number) ?? { literal: 0 };
}

function collectSubtree(
  rootId: string,
  byId: Map<string, AnyNode>,
): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of byId.values()) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

/**
 * 构建代码 IR。
 *
 * @param nodes `.ic` 节点（如 `api.getNodes()`）。
 * @param options 见 {@link CodegenOptions}。
 */
export function buildCodeIR(
  nodes: SerializedNode[],
  options: CodegenOptions = {},
): CodeIR {
  const variablesMode: CodeVariablesMode = options.variablesMode ?? 'resolved';
  const componentStructure = options.componentStructure ?? 'preserve';
  const variables: DesignVariablesMap = options.variables ?? {};
  const themeMode: ThemeMode | undefined = options.themeMode;

  // resolved 模式：先把 $token 解析为字面量，后续 StyleValue 都是 literal
  let working: SerializedNode[] = nodes;
  if (variablesMode === 'resolved') {
    working = resolveSerializedNodesDesignVariables(
      nodes,
      variables,
      themeMode,
    );
  }

  if (componentStructure === 'flatten') {
    const expanded = expandRefSerializedNodes(working, working);
    return {
      components: [],
      roots: buildRootsExcludingReusable(
        expanded as AnyNode[],
        options.semanticElements ?? {},
        variablesMode,
      ),
      variables,
      themeMode,
      variablesMode,
    };
  }

  return buildPreserve(
    working as AnyNode[],
    variables,
    themeMode,
    variablesMode,
    options.semanticElements ?? {},
  );
}

/** 由扁平节点表构建顶层树，跳过 `reusable` 模板根（flatten 模式仍保留实例展开结果）。 */
function buildRootsExcludingReusable(
  nodes: AnyNode[],
  semanticElements: Record<string, CodeSemanticElement>,
  variablesMode: CodeVariablesMode,
): CodeNode[] {
  const byId = new Map<string, AnyNode>(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | undefined, AnyNode[]>();
  for (const n of nodes) {
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n);
    childrenByParent.set(n.parentId, arr);
  }
  const ctx: BuildContext = {
    childrenByParent,
    semanticElements,
    byId,
    templateToComponentName: new Map(),
    overridesByTemplate: new Map(),
    variablesMode,
  };
  const roots = sortChildren(
    nodes.filter((n) => !n.parentId || !byId.has(n.parentId)),
  ).filter((n) => !n.reusable);
  return roots.map((n) => buildCodeNode(n, ctx));
}

function buildPreserve(
  nodes: AnyNode[],
  variables: DesignVariablesMap,
  themeMode: ThemeMode | undefined,
  variablesMode: CodeVariablesMode,
  semanticElements: Record<string, CodeSemanticElement>,
): CodeIR {
  const byId = new Map<string, AnyNode>(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | undefined, AnyNode[]>();
  for (const n of nodes) {
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n);
    childrenByParent.set(n.parentId, arr);
  }

  // 1) 收集各模板被实例覆盖的属性键，用来推断 props
  const overridesByTemplate = new Map<string, Set<string>>();
  for (const n of nodes) {
    if (n.type !== 'ref') {
      continue;
    }
    const refn = n as RefSerializedNode & {
      descendants?: Record<string, Record<string, unknown>>;
    };
    const templateId = refn.ref;
    if (!templateId || !byId.has(templateId)) {
      continue;
    }
    const set = overridesByTemplate.get(templateId) ?? new Set<string>();
    // 实例根的内联覆盖映射到模板根
    for (const attr of Object.keys(n)) {
      if (
        ['id', 'type', 'parentId', 'ref', 'reusable', 'descendants'].includes(
          attr,
        )
      ) {
        continue;
      }
      if (SHADOW_KEYS.has(attr)) {
        set.add(`${templateId}::dropShadow`);
        continue;
      }
      if (
        attr in OVERRIDABLE_KEY_TO_TARGET ||
        attr === 'fills' ||
        attr === 'fill' ||
        attr === 'strokes' ||
        attr === 'stroke'
      ) {
        set.add(`${templateId}::${attr}`);
      }
    }
    const descendants = refn.descendants ?? {};
    for (const [descId, patch] of Object.entries(descendants)) {
      for (const attr of Object.keys(patch)) {
        if (SHADOW_KEYS.has(attr)) {
          set.add(`${descId}::dropShadow`);
          continue;
        }
        if (
          attr in OVERRIDABLE_KEY_TO_TARGET ||
          attr === 'fills' ||
          attr === 'fill' ||
          attr === 'strokes' ||
          attr === 'stroke'
        ) {
          set.add(`${descId}::${attr}`);
        }
      }
    }
    overridesByTemplate.set(templateId, set);
  }

  // 2) 先分配所有模板名，嵌套在普通容器中的 ref 才能解析为组件调用。
  const usedNames = new Set<string>();
  const templateToComponentName = new Map<string, string>();
  for (const n of nodes) {
    if (!n.reusable) {
      continue;
    }
    let name = toComponentName(
      typeof n.name === 'string' ? n.name : undefined,
      n.id,
    );
    while (usedNames.has(name)) {
      name = `${name}_`;
    }
    usedNames.add(name);
    templateToComponentName.set(n.id, name);
  }

  const ctx: BuildContext = {
    childrenByParent,
    semanticElements,
    byId,
    templateToComponentName,
    overridesByTemplate,
    variablesMode,
  };
  const components: CodeComponentDef[] = [];
  for (const n of nodes) {
    if (!n.reusable) continue;
    const name = templateToComponentName.get(n.id)!;

    const bindings = overridesByTemplate.get(n.id) ?? new Set<string>();
    const root = buildCodeNode(n, ctx, bindings);
    const props = buildComponentProps(n, bindings, byId, variablesMode);
    components.push({ name, templateId: n.id, root, props });
  }

  // 3) 顶层树：reusable 模板根与其子树不直接渲染；ref 实例 → 组件调用
  const reusableSubtreeIds = new Set<string>();
  for (const n of nodes) {
    if (n.reusable) {
      for (const id of collectSubtree(n.id, byId)) {
        reusableSubtreeIds.add(id);
      }
    }
  }

  const topLevel = sortChildren(
    nodes.filter((n) => {
      if (n.parentId && byId.has(n.parentId)) {
        return false;
      }
      if (n.reusable) {
        return false;
      }
      return true;
    }),
  );

  const roots: CodeNode[] = [];
  for (const n of topLevel) {
    if (n.type === 'ref') {
      const instance = buildInstanceNode(
        n as RefSerializedNode & {
          descendants?: Record<string, Record<string, unknown>>;
        },
        templateToComponentName,
        byId,
        variablesMode,
      );
      if (instance) {
        roots.push(instance);
        continue;
      }
    }
    if (reusableSubtreeIds.has(n.id)) {
      continue;
    }
    roots.push(buildCodeNode(n, ctx));
  }

  return { components, roots, variables, themeMode, variablesMode };
}

function buildComponentProps(
  template: AnyNode,
  bindings: Set<string>,
  byId: Map<string, AnyNode>,
  variablesMode: CodeVariablesMode,
): CodeComponentProp[] {
  const props: CodeComponentProp[] = [];
  const seen = new Set<string>();
  for (const key of bindings) {
    const [descId, attr] = key.split('::');
    const desc = byId.get(descId);
    if (!desc) {
      continue;
    }
    const role = decideRole(desc);
    const target =
      OVERRIDABLE_KEY_TO_TARGET[attr] ?? colorTargetFor(attr, role);
    if (!target) {
      continue;
    }
    const name = propNameFor(desc, attr);
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    props.push({
      name,
      target,
      defaultValue:
        attr === 'dropShadow'
          ? shadowStyleValue(desc, undefined, variablesMode)
          : templateDefaultValue(template, descId, attr, byId) ?? {
              literal: '',
            },
    });
  }
  return props;
}

function buildInstanceNode(
  refn: RefSerializedNode & {
    descendants?: Record<string, Record<string, unknown>>;
  },
  templateToComponentName: Map<string, string>,
  byId: Map<string, AnyNode>,
  variablesMode: CodeVariablesMode,
): CodeNode | undefined {
  const componentName = templateToComponentName.get(refn.ref);
  if (!componentName) {
    return undefined;
  }
  const props: Record<string, StyleValue> = {};
  const descendants = refn.descendants ?? {};
  const desc = byId.get(refn.ref);

  // 实例根内联覆盖 → 根 descendant 的 props
  const rootPatch: Record<string, unknown> = {};
  const refnRecord = refn as unknown as Record<string, unknown>;
  for (const attr of Object.keys(refn)) {
    if (
      ['id', 'type', 'parentId', 'ref', 'reusable', 'descendants'].includes(
        attr,
      )
    ) {
      continue;
    }
    rootPatch[attr] = refnRecord[attr];
  }

  const collectFrom = (descId: string, patch: Record<string, unknown>) => {
    const descNode = byId.get(descId);
    if (descNode && Object.keys(patch).some((key) => SHADOW_KEYS.has(key))) {
      props[propNameFor(descNode, 'dropShadow')] = shadowStyleValue(
        descNode,
        patch,
        variablesMode,
      );
    }
    for (const attr of Object.keys(patch)) {
      if (
        !(attr in OVERRIDABLE_KEY_TO_TARGET) &&
        attr !== 'fills' &&
        attr !== 'fill' &&
        attr !== 'strokes' &&
        attr !== 'stroke'
      ) {
        continue;
      }
      const sv = overrideStyleValue(patch, attr);
      if (sv && descNode) {
        props[propNameFor(descNode, attr)] = sv;
      }
    }
  };

  if (desc) {
    collectFrom(refn.ref, rootPatch);
  }
  for (const [descId, patch] of Object.entries(descendants)) {
    collectFrom(descId, patch);
  }

  return {
    role: 'container',
    id: refn.id,
    name: typeof refn.name === 'string' ? refn.name : undefined,
    style: {},
    children: [],
    instanceOf: componentName,
    props,
  };
}
