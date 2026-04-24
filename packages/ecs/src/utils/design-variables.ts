/**
 * 文档级设计变量（对标 Pencil pen 格式中的 variables）。
 * @see https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
 */

import type { SerializedNode } from '../types/serialized-node';
import { ThemeMode } from '../components/Theme';

export type DesignVariableType = 'color' | 'number' | 'string';

/** 单条条件取值，如 `{ "value": "#fff", "theme": { "Mode": "Dark" } }`；键名大小写不敏感。 */
export type DesignVariableThemeAxis = Record<string, string>;

export interface DesignVariableThemedEntry {
  value: string | number;
  /** 如 `{ Mode: "Dark" }`；全满足 `context` 时视为匹配。无或空对象表示默认/回退。 */
  theme?: DesignVariableThemeAxis;
}

export type DesignVariableValue = string | number | DesignVariableThemedEntry[];

export interface DesignVariable {
  type: DesignVariableType;
  value: DesignVariableValue;
}

/** 变量名 → 定义；键为不含 `$` 前缀的名称，如 `color.background` */
export type DesignVariablesMap = Record<string, DesignVariable>;

/**
 * 由当前亮/暗模式构建主题上下文，与 Pencil（`Mode`/`mode` 等）多种写法兼容。
 */
export function buildDesignVariableThemeContext(
  mode: ThemeMode,
): DesignVariableThemeAxis {
  const dark = mode === ThemeMode.DARK;
  return {
    mode: dark ? 'dark' : 'light',
    Mode: dark ? 'Dark' : 'Light',
  };
}

function stringEqualsCi(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getContextValueForKey(
  context: DesignVariableThemeAxis,
  key: string,
): string | undefined {
  for (const [k, v] of Object.entries(context)) {
    if (stringEqualsCi(k, key)) {
      return v;
    }
  }
  return undefined;
}

/**
 * 判断 `entryTheme` 是否被 `context` 完全满足（轴名、取值均支持大小写不敏感）。
 */
export function designVariableThemeMatches(
  entryTheme: DesignVariableThemeAxis | undefined,
  context: DesignVariableThemeAxis,
): boolean {
  if (!entryTheme || Object.keys(entryTheme).length === 0) {
    return true;
  }
  for (const [k, expected] of Object.entries(entryTheme)) {
    const found = getContextValueForKey(context, k);
    if (found === undefined || !stringEqualsCi(found, String(expected))) {
      return false;
    }
  }
  return true;
}

/**
 * 从 Pencil 式 `value[]` 中按当前 `themeMode` 选出标量；无主题时优先无 `theme` 的项。
 */
export function pickThemedValueFromVariableEntries(
  entries: DesignVariableThemedEntry[],
  themeMode?: ThemeMode,
): string | number {
  if (entries.length === 0) {
    return '';
  }
  if (themeMode == null) {
    const d = entries.find(
      (e) => !e.theme || Object.keys(e.theme).length === 0,
    );
    return (d ?? entries[0]).value;
  }
  const context = buildDesignVariableThemeContext(themeMode);
  const matches: { i: number; n: number; e: DesignVariableThemedEntry }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.theme && Object.keys(e.theme).length > 0) {
      if (designVariableThemeMatches(e.theme, context)) {
        matches.push({ i, n: Object.keys(e.theme).length, e });
      }
    }
  }
  if (matches.length > 0) {
    const maxN = Math.max(...matches.map((m) => m.n));
    const top = matches.filter((m) => m.n === maxN);
    top.sort((a, b) => a.i - b.i);
    return top[top.length - 1].e.value;
  }
  const d = entries.find(
    (e) => !e.theme || Object.keys(e.theme).length === 0,
  );
  return (d ?? entries[0]).value;
}

/**
 * 为当前 `themeMode` 从变量定义中解析出实际标量值。
 */
export function resolveDesignVariableDefinitionScalar(
  def: DesignVariable,
  themeMode?: ThemeMode,
): string | number {
  if (!Array.isArray(def.value)) {
    return def.value;
  }
  return pickThemedValueFromVariableEntries(def.value, themeMode);
}

/**
 * 在「带多主题 `value` 数组」时，对应当前模式、会被写入/展示的那条下标。
 */
export function findThemedValueEntryIndexForMode(
  entries: DesignVariableThemedEntry[],
  themeMode: ThemeMode,
): number {
  if (entries.length === 0) {
    return 0;
  }
  const context = buildDesignVariableThemeContext(themeMode);
  const matches: { i: number; n: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.theme && Object.keys(e.theme).length > 0) {
      if (designVariableThemeMatches(e.theme, context)) {
        matches.push({ i, n: Object.keys(e.theme).length });
      }
    }
  }
  if (matches.length > 0) {
    const maxN = Math.max(...matches.map((m) => m.n));
    const top = matches.filter((m) => m.n === maxN);
    top.sort((a, b) => a.i - b.i);
    return top[top.length - 1].i;
  }
  const d = entries.findIndex(
    (e) => !e.theme || Object.keys(e.theme).length === 0,
  );
  return d >= 0 ? d : 0;
}

/**
 * 在保留其它主题条目的前提下，只更新与当前 `themeMode` 对应（或默认）的那一条。
 */
export function updateDesignVariableValueForMode(
  def: DesignVariable,
  themeMode: ThemeMode,
  newValue: string | number,
): DesignVariable {
  if (!Array.isArray(def.value)) {
    return { ...def, value: newValue };
  }
  const arr: DesignVariableThemedEntry[] = def.value.map((e) => ({ ...e }));
  if (arr.length === 0) {
    return { ...def, value: newValue };
  }
  const idx = findThemedValueEntryIndexForMode(arr, themeMode);
  arr[idx] = { ...arr[idx], value: newValue };
  return { ...def, value: arr };
}

function coerceValueForType(
  type: DesignVariableType,
  raw: string | number,
): string | number {
  if (type === 'color') {
    return typeof raw === 'string' ? raw : String(raw);
  }
  if (type === 'number') {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n : 0;
  }
  return String(raw);
}

/**
 * 切换 `type` 时：标量直转；`value[]` 为每条子值分别转型并保留 `theme`。
 */
export function coerceDesignVariableType(
  def: DesignVariable,
  newType: DesignVariableType,
): DesignVariable {
  if (!Array.isArray(def.value)) {
    return {
      type: newType,
      value: coerceValueForType(newType, def.value),
    };
  }
  return {
    type: newType,
    value: def.value.map((e) => ({
      ...e,
      value: coerceValueForType(newType, e.value),
    })),
  };
}

/**
 * 同时取 Light / Dark 下解析结果（Pencil 式双列编辑）。
 */
export function getDesignVariableLightDarkValues(
  def: DesignVariable,
): { light: string | number; dark: string | number } {
  return {
    light: resolveDesignVariableDefinitionScalar(def, ThemeMode.LIGHT),
    dark: resolveDesignVariableDefinitionScalar(def, ThemeMode.DARK),
  };
}

/**
 * 更新 Light 或 Dark 其中一列，并规范为两条 `theme: { Mode }`；未改列保持当前解析值。
 */
export function setDesignVariableLightDarkColumn(
  def: DesignVariable,
  mode: ThemeMode,
  newValue: string | number,
): DesignVariable {
  const { light, dark } = getDesignVariableLightDarkValues(def);
  return {
    ...def,
    value: [
      { value: mode === ThemeMode.LIGHT ? newValue : light, theme: { Mode: 'Light' } },
      { value: mode === ThemeMode.DARK ? newValue : dark, theme: { Mode: 'Dark' } },
    ],
  };
}

export const SERIALIZED_NODE_VARIABLE_KEYS = [
  'fill',
  'stroke',
  'fontSize',
  'decorationColor',
  'dropShadowColor',
  'innerShadowColor',
  'strokeWidth',
  'cornerRadius',
  'fillOpacity',
  'strokeOpacity',
  'cornerRadius',
  'letterSpacing',
  'lineHeight',
] as const;

/** 变量表变更时 {@link buildDesignVariableRefreshPatch} 会从节点上抄这些键，避免 `updateNode(node, undefined)` 整表自同步误触 flex。 */
const DESIGN_VARIABLE_REFRESH_EXTRA_KEYS = [
  'filter',
  'opacity',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'fontKerning',
  'textAlign',
  'textBaseline',
  'dropShadowBlurRadius',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'innerShadowBlurRadius',
  'innerShadowOffsetX',
  'innerShadowOffsetY',
  'markerStart',
  'markerEnd',
] as const;

/**
 * 仅包含可能含 `$` 设计变量、需在变量表变化后重走 {@link resolveDesignVariableValue} 的字段；勿含 width/height/x/y。
 */
export function buildDesignVariableRefreshPatch(
  node: SerializedNode,
): Partial<SerializedNode> {
  const keys = new Set<string>([
    ...SERIALIZED_NODE_VARIABLE_KEYS,
    ...DESIGN_VARIABLE_REFRESH_EXTRA_KEYS,
  ]);
  const n = node as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(n, key)) {
      out[key] = n[key];
    }
  }
  return out as Partial<SerializedNode>;
}

export function isDesignVariableReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('$') && value.length > 1;
}

/** 从 `$token` 或字面量得到变量键名；非变量引用时返回空串 */
export function designVariableRefKeyFromWire(
  wire: string | number | undefined,
): string {
  if (wire === undefined) {
    return '';
  }
  if (typeof wire === 'string' && isDesignVariableReference(wire)) {
    return wire.slice(1);
  }
  return '';
}

/** `color.background` → `--color-background`（用于 SVG/CSS 对接） */
export function designTokenKeyToCssCustomProperty(key: string): string {
  return `--${key.replace(/\./g, '-')}`;
}

export type DesignVariablesSvgExportMode =
  | 'resolved'
  /** 保留 `$token` 字符串（属性可能非标准，适合再加工） */
  | 'preserve-token'
  /** `:root{--x:...}` + `fill="var(--x)"` 形式 */
  | 'css-var';

function mapSerializedNodeToCssVarPlaceholders(
  node: SerializedNode,
): SerializedNode {
  const nodeRec = node as unknown as Record<string, unknown>;
  const next = { ...nodeRec };
  let changed = false;
  for (const key of SERIALIZED_NODE_VARIABLE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      continue;
    }
    const raw = nodeRec[key];
    if (typeof raw === 'string' && isDesignVariableReference(raw)) {
      next[key] = `var(${designTokenKeyToCssCustomProperty(raw.slice(1))})`;
      changed = true;
    }
  }
  return (changed ? next : node) as SerializedNode;
}

/** 将文档变量表写成一段可放入 SVG `<style>` 的 `:root{...}`；多主题时按 `themeMode` 解析为当前一种取值。 */
export function buildDesignVariablesCssRootBlock(
  variables: DesignVariablesMap,
  themeMode?: ThemeMode,
): string {
  const parts: string[] = [];
  for (const [k, def] of Object.entries(variables)) {
    const name = designTokenKeyToCssCustomProperty(k);
    const v = resolveDesignVariableDefinitionScalar(def, themeMode);
    const css =
      def.type === 'number' ? `${v}px` : typeof v === 'string' ? v : String(v);
    parts.push(`${name}:${css}`);
  }
  return `:root{${parts.join(';')}}`;
}

/**
 * 按导出策略处理节点列表（解析、`$` 原样或转为 CSS var）。
 */
export function prepareSerializedNodesForSvgExport(
  nodes: SerializedNode[],
  variables: DesignVariablesMap | undefined,
  mode: DesignVariablesSvgExportMode,
  themeMode?: ThemeMode,
): { nodes: SerializedNode[]; cssRootStyle?: string } {
  if (mode === 'preserve-token') {
    return { nodes };
  }
  if (mode === 'resolved') {
    return {
      nodes: resolveSerializedNodesDesignVariables(nodes, variables, themeMode),
    };
  }
  if (!variables || Object.keys(variables).length === 0) {
    return { nodes };
  }
  return {
    nodes: nodes.map((n) => mapSerializedNodeToCssVarPlaceholders(n)),
    cssRootStyle: buildDesignVariablesCssRootBlock(variables, themeMode),
  };
}

/**
 * 将节点属性中的 `$token` 解析为变量表中的值；未命中时保留原样（便于排查）。
 */
export function resolveDesignVariableValue<T>(
  value: T,
  variables: DesignVariablesMap | undefined,
  themeMode?: ThemeMode,
): T {
  if (variables == null || !isDesignVariableReference(value)) {
    return value;
  }
  const key = value.slice(1);
  const def = variables[key];
  if (!def) {
    return value;
  }
  return resolveDesignVariableDefinitionScalar(def, themeMode) as T;
}

/**
 * 浅拷贝每个节点并解析已知字段上的 `$` 引用（用于导出等只读路径）。
 */
export function resolveSerializedNodesDesignVariables(
  nodes: SerializedNode[],
  variables: DesignVariablesMap | undefined,
  themeMode?: ThemeMode,
): SerializedNode[] {
  if (!variables || Object.keys(variables).length === 0) {
    return nodes;
  }
  return nodes.map((node) => {
    let changed = false;
    const nodeRec = node as unknown as Record<string, unknown>;
    const next = { ...nodeRec };
    for (const key of SERIALIZED_NODE_VARIABLE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) {
        continue;
      }
      const raw = nodeRec[key];
      const resolved = resolveDesignVariableValue(
        raw as string | number,
        variables,
        themeMode,
      );
      if (resolved !== raw) {
        next[key] = resolved;
        changed = true;
      }
    }
    return (changed ? next : node) as SerializedNode;
  });
}
