import type { Group } from '../components/geometry/Group';
import type { ThemeMode } from '../components/Theme';
import {
  resolveDesignVariableValue,
  type DesignVariablesMap,
} from './design-variables';

type Wire = unknown;

function wireString(
  wire: Wire,
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
): string {
  if (wire === undefined || wire === null) {
    return '';
  }
  const r = resolveDesignVariableValue(
    wire as string | number,
    designVariables,
    themeMode,
  );
  if (r === undefined || r === null) {
    return '';
  }
  return String(r);
}

function wireStrokeWidth(
  wire: Wire,
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
): number {
  if (wire === undefined || wire === null) {
    return -1;
  }
  const r = resolveDesignVariableValue(
    wire as string | number,
    designVariables,
    themeMode,
  );
  if (r === undefined || r === null) {
    return -1;
  }
  const n = typeof r === 'number' ? r : parseFloat(String(r));
  if (!Number.isFinite(n) || n < 0) {
    return -1;
  }
  return n;
}

/**
 * 0–1 不透明度；未设或非法时 -1（与 {@link Group} 哨兵一致）。
 */
function wireOpacity01(
  wire: Wire,
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
): number {
  if (wire === undefined || wire === null) {
    return -1;
  }
  const r = resolveDesignVariableValue(
    wire as string | number,
    designVariables,
    themeMode,
  );
  if (r === undefined || r === null) {
    return -1;
  }
  const n = typeof r === 'number' ? r : parseFloat(String(r));
  if (!Number.isFinite(n)) {
    return -1;
  }
  return Math.max(0, Math.min(1, n));
}

/**
 * 从与 SVG 线框节点兼容的 `attributes` 解出可写入 {@link Group} 的展示属性（与 wire 上 `fill` / `stroke` 等一致，已做设计变量解析）。
 * 空串、`-1` 表示本层未设置，与 `Group` 字段默认一致。
 */
export function buildGroupWirePresentation(
  attributes: {
    fill?: Wire;
    stroke?: Wire;
    strokeWidth?: Wire;
    fillRule?: Wire;
    opacity?: Wire;
    fillOpacity?: Wire;
    strokeOpacity?: Wire;
    strokeLinecap?: Wire;
    strokeLinejoin?: Wire;
  },
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
): Partial<Group> {
  return {
    fill: wireString(attributes.fill, designVariables, themeMode),
    stroke: wireString(attributes.stroke, designVariables, themeMode),
    strokeWidth: wireStrokeWidth(
      attributes.strokeWidth,
      designVariables,
      themeMode,
    ),
    fillRule: wireString(attributes.fillRule, designVariables, themeMode),
    opacity: wireOpacity01(attributes.opacity, designVariables, themeMode),
    fillOpacity: wireOpacity01(
      attributes.fillOpacity,
      designVariables,
      themeMode,
    ),
    strokeOpacity: wireOpacity01(
      attributes.strokeOpacity,
      designVariables,
      themeMode,
    ),
    strokeLinecap: wireString(
      attributes.strokeLinecap,
      designVariables,
      themeMode,
    ),
    strokeLinejoin: wireString(
      attributes.strokeLinejoin,
      designVariables,
      themeMode,
    ),
  };
}
