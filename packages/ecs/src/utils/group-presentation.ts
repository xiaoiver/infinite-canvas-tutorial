import type { Group } from '../components/geometry/Group';
import type { ThemeMode } from '../components/Theme';
import type { SerializedFillLayerItem } from '../types/serialized-node';
import {
  resolveDesignVariableValue,
  type DesignVariablesMap,
} from './design-variables';
import {
  firstEnabledFillPresentation,
  migrateLegacyFillWireInPlace,
} from './normalize-fill-wire';

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
 * 从与 SVG 线框节点兼容的 `attributes` 解出可写入 {@link Group} 的展示属性（与 wire 上 `fills` / `stroke` 等一致，已做设计变量解析）。
 * 空串、`-1` 表示本层未设置，与 `Group` 字段默认一致。
 */
export function buildGroupWirePresentation(
  attributes: {
    fills?: SerializedFillLayerItem[];
    stroke?: Wire;
    strokeWidth?: Wire;
    fillRule?: Wire;
    opacity?: Wire;
    strokeOpacity?: Wire;
    strokeLinecap?: Wire;
    strokeLinejoin?: Wire;
  },
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
): Partial<Group> {
  const attrs = attributes as Record<string, unknown>;
  migrateLegacyFillWireInPlace(attrs);
  const pres = firstEnabledFillPresentation(
    attrs.fills as SerializedFillLayerItem[] | undefined,
  );
  return {
    fill: pres
      ? wireString(pres.fill, designVariables, themeMode)
      : '',
    stroke: wireString(attributes.stroke, designVariables, themeMode),
    strokeWidth: wireStrokeWidth(
      attributes.strokeWidth,
      designVariables,
      themeMode,
    ),
    fillRule: wireString(attributes.fillRule, designVariables, themeMode),
    opacity: wireOpacity01(attributes.opacity, designVariables, themeMode),
    fillOpacity: pres
      ? wireOpacity01(pres.fillOpacity, designVariables, themeMode)
      : -1,
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
