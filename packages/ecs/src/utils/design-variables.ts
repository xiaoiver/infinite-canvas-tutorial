/**
 * 文档级设计变量（对标 Pencil pen 格式中的 variables）。
 * @see https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
 */

import type { SerializedNode } from '../types/serialized-node';

export type DesignVariableType = 'color' | 'number' | 'string';

export interface DesignVariable {
  type: DesignVariableType;
  value: string | number;
}

/** 变量名 → 定义；键为不含 `$` 前缀的名称，如 `color.background` */
export type DesignVariablesMap = Record<string, DesignVariable>;

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

/** 将文档变量表写成一段可放入 SVG `<style>` 的 `:root{...}` */
export function buildDesignVariablesCssRootBlock(
  variables: DesignVariablesMap,
): string {
  const parts: string[] = [];
  for (const [k, def] of Object.entries(variables)) {
    const name = designTokenKeyToCssCustomProperty(k);
    const v = def.value;
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
): { nodes: SerializedNode[]; cssRootStyle?: string } {
  if (mode === 'preserve-token') {
    return { nodes };
  }
  if (mode === 'resolved') {
    return {
      nodes: resolveSerializedNodesDesignVariables(nodes, variables),
    };
  }
  if (!variables || Object.keys(variables).length === 0) {
    return { nodes };
  }
  return {
    nodes: nodes.map((n) => mapSerializedNodeToCssVarPlaceholders(n)),
    cssRootStyle: buildDesignVariablesCssRootBlock(variables),
  };
}

/**
 * 将节点属性中的 `$token` 解析为变量表中的值；未命中时保留原样（便于排查）。
 */
export function resolveDesignVariableValue<T>(
  value: T,
  variables: DesignVariablesMap | undefined,
): T {
  if (variables == null || !isDesignVariableReference(value)) {
    return value;
  }
  const key = value.slice(1);
  const def = variables[key];
  if (!def) {
    return value;
  }
  return def.value as T;
}

/**
 * 浅拷贝每个节点并解析已知字段上的 `$` 引用（用于导出等只读路径）。
 */
export function resolveSerializedNodesDesignVariables(
  nodes: SerializedNode[],
  variables: DesignVariablesMap | undefined,
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
      );
      if (resolved !== raw) {
        next[key] = resolved;
        changed = true;
      }
    }
    return (changed ? next : node) as SerializedNode;
  });
}
