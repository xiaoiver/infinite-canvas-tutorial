import { mat3 } from 'gl-matrix';
import { Ellipse } from '../components/geometry/Ellipse';
import { Line } from '../components/geometry/Line';
import { Path } from '../components/geometry/Path';
import { transformPath, shiftPath } from './serialize';
import { resolveDesignVariableValue, type DesignVariablesMap } from './design-variables';
import type { ThemeMode } from '../components/Theme';
import type { Group } from '../components/geometry/Group';
import type {
  IconFontSerializedNode,
  FillAttributes,
  StrokeAttributes,
} from '../types/serialized-node';

export type IconifyIconCollection = {
  icons?: Record<string, { body?: string }>;
};

/** 传给 {@link registerIconifyIconSet} 的值：完整 iconify 包 JSON、或 `import('*.json')` 的模块（含 `default`）。 */
export type RegisterableIconifyCollection =
  | IconifyIconCollection
  | { default?: IconifyIconCollection }
  | null
  | undefined;

/**
 * 与反序列化 `iconfont` 时一致，从节点上的 fill/stroke/strokeWidth 解析出子 path 用的用户色与线宽。
 * 若某键在 wire 上未设或解出空串，则用 `groupPresentation`（同层 ECS `Group` 上与 SVG \<g\> 对齐的展示字段）作回退，便于子 path 的 `currentColor` / 描边 与组上一致。
 */
export function resolveIconFontWireStyle(
  attributes: IconFontSerializedNode,
  designVariables: DesignVariablesMap | undefined,
  themeMode: ThemeMode | undefined,
  groupPresentation?: Partial<Group> | null,
): {
  userColorStroke: string | undefined;
  userColorFill: string | undefined;
  rSw: unknown;
} {
  const wireStroke = (attributes as StrokeAttributes).stroke;
  const wireFill = (attributes as FillAttributes).fill;
  const wireSw = (attributes as StrokeAttributes).strokeWidth;
  const rStrokeS =
    wireStroke != null
      ? resolveDesignVariableValue(wireStroke, designVariables, themeMode)
      : undefined;
  const rFillS =
    wireFill != null
      ? resolveDesignVariableValue(wireFill, designVariables, themeMode)
      : undefined;
  let rSw =
    wireSw != null
      ? resolveDesignVariableValue(wireSw, designVariables, themeMode)
      : undefined;
  let userColorStroke =
    rStrokeS == null
      ? undefined
      : typeof rStrokeS === 'string'
        ? rStrokeS
        : String(rStrokeS);
  let userColorFill =
    rFillS == null
      ? undefined
      : typeof rFillS === 'string'
        ? rFillS
        : String(rFillS);

  if (userColorStroke == null || `${userColorStroke}`.trim() === '') {
    const gs = groupPresentation?.stroke?.trim();
    if (gs) {
      userColorStroke = gs;
    }
  }
  if (userColorFill == null || `${userColorFill}`.trim() === '') {
    const gf = groupPresentation?.fill?.trim();
    if (gf) {
      userColorFill = gf;
    }
  }
  if (rSw == null && groupPresentation) {
    const gw = groupPresentation.strokeWidth;
    if (typeof gw === 'number' && Number.isFinite(gw) && gw >= 0) {
      rSw = gw;
    }
  }

  return { userColorStroke, userColorFill, rSw };
}

/**
 * 使用 globalThis 单例：同一应用里常同时以「源码」与包入口的 `esm` 两路径加载 ecs（见 webcomponents 示例
 * `import … from '…/src/utils/icon-font'` vs `import … from '@infinite-canvas-tutorial/ecs'`），会实例化
 * 两份本模块。共享 Map 避免注册进 A 表、反序列化读 B 表。
 */
const ICONIFY_STORE_KEY = Symbol.for(
  '@infinite-canvas-tutorial/ecs/iconify-icon-store',
);
type IconifyStore = {
  sets: Map<string, Record<string, { body?: string }>>;
  bodyCache: Map<string, string | null>;
};

function getIconifyStore(): IconifyStore {
  const w = globalThis as unknown as Record<symbol, IconifyStore | undefined>;
  if (!w[ICONIFY_STORE_KEY]) {
    w[ICONIFY_STORE_KEY] = {
      sets: new Map(),
      bodyCache: new Map(),
    };
  }
  return w[ICONIFY_STORE_KEY]!;
}

/**
 * 注册与 {@link buildIconFontScalablePrimitives} 使用的 Iconify 风格 `icons` 表。
 * 同一 `family` 会整表覆盖（可再次调用以热更新或切换版本）。
 * 可传入完整 `lucide.json` 对象、仅 `{ icons }`、或动态 `import()` 得到的 `{ default: 完整JSON }`。
 */
export function registerIconifyIconSet(
  family: string,
  collection: RegisterableIconifyCollection,
): void {
  const f = family?.trim().toLowerCase();
  if (!f || collection == null) {
    return;
  }
  const unwrapped: IconifyIconCollection =
    typeof collection === 'object' &&
      collection !== null &&
      'default' in collection &&
      (collection as { default?: IconifyIconCollection }).default != null
      ? (collection as { default: IconifyIconCollection }).default
      : (collection as IconifyIconCollection);
  const { sets, bodyCache } = getIconifyStore();
  sets.set(f, { ...(unwrapped.icons ?? {}) });
  for (const k of Array.from(bodyCache.keys())) {
    if (k.startsWith(`body:${f}:`)) {
      bodyCache.delete(k);
    }
  }
}

/**
 * 取消注册某套图标，或不传 `family` 时清空所有已注册集合与 body 解析缓存。
 */
export function unregisterIconifyIconSet(family?: string): void {
  const { sets, bodyCache } = getIconifyStore();
  if (family == null) {
    sets.clear();
    bodyCache.clear();
    return;
  }
  const f = family.trim().toLowerCase();
  sets.delete(f);
  for (const k of Array.from(bodyCache.keys())) {
    if (k.startsWith(`body:${f}:`)) {
      bodyCache.delete(k);
    }
  }
}

export function getRegisteredIconifyIconFamilies(): string[] {
  return Array.from(getIconifyStore().sets.keys());
}

function normalizeIconName(name: string): string {
  return name
    .trim()
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function parseTagAttrs(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  if (!s) {
    return o;
  }
  const re = /\s([a-zA-Z0-9:-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) != null) {
    o[m[1]!] = m[2]!;
  }
  return o;
}

export type IconSvgStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
};

function pickVisualAttrs(attrs: Record<string, string>): IconSvgStyle {
  return {
    fill: attrs['fill'] ?? undefined,
    stroke: attrs['stroke'] ?? undefined,
    strokeWidth: attrs['stroke-width'] ?? undefined,
    strokeLinecap: attrs['stroke-linecap'] ?? undefined,
    strokeLinejoin: attrs['stroke-linejoin'] ?? undefined,
  };
}

function mergeSvgStyle(a: IconSvgStyle, b: IconSvgStyle): IconSvgStyle {
  const o: IconSvgStyle = { ...a };
  (Object.keys(b) as (keyof IconSvgStyle)[]).forEach((k) => {
    const v = b[k];
    if (v !== undefined) {
      o[k] = v;
    }
  });
  return o;
}

export type ScaledIconPrimitive =
  | { kind: 'path'; d: string; style: IconSvgStyle }
  | {
    kind: 'ellipse';
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    style: IconSvgStyle;
  }
  | {
    kind: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    style: IconSvgStyle;
  };

/** 仅作后备：栈式解析失败时尝试平铺自闭合形状（与旧版一致） */
const SELF_TAG_RE = /<(path|circle|line|ellipse)\b([^/]*?)\s*\/>/g;

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type BoundLike = { minX: number; minY: number; maxX: number; maxY: number };

function aabbPath(d: string): BoundLike {
  return Path.getGeometryBounds({ d });
}

function aabbLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): BoundLike {
  return Line.getGeometryBounds({ x1, y1, x2, y2 });
}

function aabbEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): BoundLike {
  return Ellipse.getGeometryBounds({ cx, cy, rx, ry });
}

function isFiniteAabb(p: BoundLike): p is Bounds {
  return (
    Number.isFinite(p.minX) &&
    Number.isFinite(p.minY) &&
    Number.isFinite(p.maxX) &&
    Number.isFinite(p.maxY)
  );
}

function skipSvgWs(s: string, i: number): number {
  let j = i;
  while (j < s.length && /\s/.test(s[j]!)) {
    j++;
  }
  return j;
}

/**
 * 读取开始标签到第一个 `>`；`d` 等属性中不含 `>`（与 Iconify / body 常见形态一致）。
 */
function readStartTag(
  s: string,
  from: number,
): { name: string; attr: string; selfClose: boolean; end: number } | null {
  if (s[from] !== '<') {
    return null;
  }
  if (s.slice(from, from + 2) === '</') {
    return null;
  }
  const gt = s.indexOf('>', from + 1);
  if (gt < 0) {
    return null;
  }
  const t = s.slice(from, gt + 1);
  const m = t.match(/^<\s*([a-zA-Z][\w-]*)\b/);
  if (!m) {
    return null;
  }
  const name = m[1]!.toLowerCase();
  if (!/^(g|path|circle|line|ellipse)$/.test(name)) {
    return null;
  }
  const oneLine = t.replace(/\s/g, '');
  const selfClose = oneLine.endsWith('/>');
  const afterName = m[0]!.length;
  const attr = (
    selfClose ? t.slice(afterName, t.length - 2) : t.slice(afterName, t.length - 1)
  ).trim();
  return { name, attr, selfClose, end: gt + 1 };
}

/**
 * 将 Iconify 的 `body`（可含一层或多层 \<g>、`fill="currentColor"` 等）解析为带合并样式后的可缩放子图元。
 * 与 SVG 一致：祖先 `g` 的展示属性与子 path/ellipse/line 自身属性合并，后者优先。
 */
export function resolveIconifyBodyToScalablePrimitives(
  body: string,
  targetWidth: number,
  targetHeight: number,
): ScaledIconPrimitive[] | null {
  const inner0 = body.trim();
  if (!inner0) {
    return null;
  }

  const tryStackParse = (inner: string): { prim: ScaledIconPrimitive; b: BoundLike }[] | null => {
    const items: { prim: ScaledIconPrimitive; b: BoundLike }[] = [];
    const styleStack: IconSvgStyle[] = [{}];
    let i = 0;
    const len = inner.length;
    const pushVoidPrim = (tag: string, at: Record<string, string>) => {
      const st = mergeSvgStyle(
        styleStack[styleStack.length - 1]!,
        pickVisualAttrs(at) as IconSvgStyle,
      );
      if (tag === 'path') {
        const d = at.d?.trim();
        if (!d) {
          return;
        }
        const b = aabbPath(d);
        if (!isFiniteAabb(b)) {
          return;
        }
        items.push({ prim: { kind: 'path', d, style: st }, b });
        return;
      }
      if (tag === 'circle') {
        const cx = parseFloat(String(at['cx'] ?? 0));
        const cy = parseFloat(String(at['cy'] ?? 0));
        const r = parseFloat(String(at['r'] ?? 0));
        if (!Number.isFinite(r) || r < 0) {
          return;
        }
        const b = aabbEllipse(cx, cy, r, r);
        if (!isFiniteAabb(b)) {
          return;
        }
        items.push({ prim: { kind: 'ellipse', cx, cy, rx: r, ry: r, style: st }, b });
        return;
      }
      if (tag === 'ellipse') {
        const cx = parseFloat(String(at['cx'] ?? 0));
        const cy = parseFloat(String(at['cy'] ?? 0));
        const rx = parseFloat(String(at['rx'] ?? 0));
        const ry = parseFloat(String(at['ry'] ?? 0));
        if (rx < 0 || ry < 0) {
          return;
        }
        const b = aabbEllipse(cx, cy, rx, ry);
        if (!isFiniteAabb(b)) {
          return;
        }
        items.push({ prim: { kind: 'ellipse', cx, cy, rx, ry, style: st }, b });
        return;
      }
      if (tag === 'line') {
        const x1 = parseFloat(String(at['x1'] ?? 0));
        const y1 = parseFloat(String(at['y1'] ?? 0));
        const x2 = parseFloat(String(at['x2'] ?? 0));
        const y2 = parseFloat(String(at['y2'] ?? 0));
        const b = aabbLine(x1, y1, x2, y2);
        if (!isFiniteAabb(b)) {
          return;
        }
        items.push({ prim: { kind: 'line', x1, y1, x2, y2, style: st }, b });
      }
    };

    while (i < len) {
      i = skipSvgWs(inner, i);
      if (i >= len) {
        break;
      }
      if (inner[i] === '<' && inner.slice(i, i + 2) === '</') {
        const closeG = inner.slice(i).match(/^<\/\s*g\s*>/i);
        if (closeG) {
          if (styleStack.length > 1) {
            styleStack.pop();
          }
          i += closeG[0]!.length;
          continue;
        }
        const j = inner.indexOf('>', i);
        i = j < 0 ? i + 1 : j + 1;
        continue;
      }

      const open = readStartTag(inner, i);
      if (!open) {
        const j = inner.indexOf('>', i);
        if (j < 0) {
          i++;
        } else {
          i = j + 1;
        }
        continue;
      }
      i = open.end;
      if (open.name === 'g') {
        if (open.selfClose) {
          continue;
        }
        const gattrs = parseTagAttrs(` ${open.attr}`);
        const top = styleStack[styleStack.length - 1]!;
        styleStack.push(
          mergeSvgStyle(top, pickVisualAttrs(gattrs) as IconSvgStyle),
        );
        continue;
      }
      if (!open.selfClose) {
        continue;
      }
      const at = parseTagAttrs(` ${open.attr}`);
      pushVoidPrim(open.name, at);
    }

    return items.length > 0 ? items : null;
  };

  let items: { prim: ScaledIconPrimitive; b: BoundLike }[] | null = tryStackParse(
    inner0,
  );
  if (!items || items.length === 0) {
    const gMatch = body.match(/^\s*<g\s([^>]+)>([\s\S]*)<\/g>\s*$/i);
    const rootAttrs = gMatch ? parseTagAttrs((gMatch[1] as string) ?? '') : {};
    const gStyle: IconSvgStyle = gMatch ? pickVisualAttrs(rootAttrs) : {};
    const inner = gMatch ? (gMatch[2] as string) : body;
    if (!inner.trim()) {
      return null;
    }
    const flat: { prim: ScaledIconPrimitive; b: BoundLike }[] = [];
    for (const m of inner.matchAll(SELF_TAG_RE) as Iterable<RegExpMatchArray>) {
      const tag = (m[1] as string).toLowerCase();
      const at = parseTagAttrs((m[2] as string) || '');
      const st = mergeSvgStyle(gStyle, pickVisualAttrs(at) as IconSvgStyle);
      if (tag === 'path') {
        const d = at.d?.trim();
        if (!d) {
          continue;
        }
        const b = aabbPath(d);
        if (!isFiniteAabb(b)) {
          continue;
        }
        flat.push({ prim: { kind: 'path', d, style: st }, b });
      } else if (tag === 'circle') {
        const cx = parseFloat(String(at['cx'] ?? 0));
        const cy = parseFloat(String(at['cy'] ?? 0));
        const r = parseFloat(String(at['r'] ?? 0));
        if (!Number.isFinite(r) || r < 0) {
          continue;
        }
        const b = aabbEllipse(cx, cy, r, r);
        if (!isFiniteAabb(b)) {
          continue;
        }
        flat.push({
          prim: { kind: 'ellipse', cx, cy, rx: r, ry: r, style: st },
          b,
        });
      } else if (tag === 'ellipse') {
        const cx = parseFloat(String(at['cx'] ?? 0));
        const cy = parseFloat(String(at['cy'] ?? 0));
        const rx = parseFloat(String(at['rx'] ?? 0));
        const ry = parseFloat(String(at['ry'] ?? 0));
        if (rx < 0 || ry < 0) {
          continue;
        }
        const b = aabbEllipse(cx, cy, rx, ry);
        if (!isFiniteAabb(b)) {
          continue;
        }
        flat.push({
          prim: { kind: 'ellipse', cx, cy, rx, ry, style: st },
          b,
        });
      } else if (tag === 'line') {
        const x1 = parseFloat(String(at['x1'] ?? 0));
        const y1 = parseFloat(String(at['y1'] ?? 0));
        const x2 = parseFloat(String(at['x2'] ?? 0));
        const y2 = parseFloat(String(at['y2'] ?? 0));
        const b = aabbLine(x1, y1, x2, y2);
        if (!isFiniteAabb(b)) {
          continue;
        }
        flat.push({
          prim: { kind: 'line', x1, y1, x2, y2, style: st },
          b,
        });
      }
    }
    if (flat.length === 0) {
      return null;
    }
    items = flat;
  }
  if (items.length === 0) {
    return null;
  }
  const combined: Bounds = { ...items[0]!.b };
  for (let k = 1; k < items.length; k++) {
    const cur = { ...items[k]!.b };
    combined.minX = Math.min(combined.minX, cur.minX);
    combined.minY = Math.min(combined.minY, cur.minY);
    combined.maxX = Math.max(combined.maxX, cur.maxX);
    combined.maxY = Math.max(combined.maxY, cur.maxY);
  }
  const rawW = combined.maxX - combined.minX;
  const rawH = combined.maxY - combined.minY;
  if (rawW <= 0 || rawH <= 0) {
    return null;
  }
  const w = targetWidth > 0 ? targetWidth : 24;
  const h = targetHeight > 0 ? targetHeight : 24;
  const sx = w / rawW;
  const sy = h / rawH;
  const { minX, minY } = combined;

  return items.map(({ prim }) => {
    if (prim.kind === 'path') {
      return {
        kind: 'path' as const,
        d: transformPath(
          shiftPath(prim.d, -minX, -minY),
          mat3.fromScaling(mat3.create(), [sx, sy]),
        ),
        style: prim.style,
      };
    }
    if (prim.kind === 'ellipse') {
      return {
        kind: 'ellipse' as const,
        cx: (prim.cx - minX) * sx,
        cy: (prim.cy - minY) * sy,
        rx: prim.rx * sx,
        ry: prim.ry * sy,
        style: prim.style,
      };
    }
    return {
      kind: 'line' as const,
      x1: (prim.x1 - minX) * sx,
      y1: (prim.y1 - minY) * sy,
      x2: (prim.x2 - minX) * sx,
      y2: (prim.y2 - minY) * sy,
      style: prim.style,
    };
  });
}

/**
 * 根据已注册的 Iconify 集合与节点上的 `iconfont` 名解析 path/circle/line/ellipse 并缩放到目标尺寸。
 * `iconFontName` 可写 `lucide:foo` 显式指集合，否则用 `iconFontFamily` 作为集合 id（小写，如 `lucide`）。
 */
export function buildIconFontScalablePrimitives(
  iconFontName: string,
  iconFontFamily: string,
  targetWidth: number,
  targetHeight: number,
): ScaledIconPrimitive[] | null {
  const rawName = iconFontName?.trim();
  if (!rawName) {
    return null;
  }
  const rawFamily = iconFontFamily?.trim().toLowerCase() || 'lucide';
  const colon = rawName.indexOf(':');
  const [prefixMaybe, bareMaybe] =
    colon >= 0
      ? [rawName.slice(0, colon), rawName.slice(colon + 1)]
      : [rawFamily, rawName];
  const setId = prefixMaybe.trim().toLowerCase();
  const { sets, bodyCache } = getIconifyStore();
  if (!sets.has(setId)) {
    return null;
  }
  const normalized = normalizeIconName(
    (bareMaybe ?? rawName).trim() || rawName,
  );
  const k = `body:${setId}:${normalized}`;
  if (bodyCache.has(k)) {
    const b = bodyCache.get(k);
    if (b == null) {
      return null;
    }
    return resolveIconifyBodyToScalablePrimitives(b, targetWidth, targetHeight);
  }
  const icons = sets.get(setId)!;
  const b = icons[normalized]?.body ?? null;
  bodyCache.set(k, b);
  if (b == null) {
    return null;
  }
  return resolveIconifyBodyToScalablePrimitives(b, targetWidth, targetHeight);
}

export function strokeWidthFromIconStyle(
  elStyle: IconSvgStyle,
  userResolvedStrokeWidth: unknown,
  options?: { primKind: ScaledIconPrimitive['kind'] },
): number {
  if (userResolvedStrokeWidth != null) {
    const n = typeof userResolvedStrokeWidth === 'number'
      ? userResolvedStrokeWidth
      : parseFloat(String(userResolvedStrokeWidth));
    if (Number.isFinite(n) && n >= 0) {
      return n;
    }
  }
  // 无 `stroke` 的 path/ellipse 不应套默认 2px 线宽，否则 `fill=currentColor` 的标会多一圈描边
  const strokeAttr = elStyle.stroke?.trim();
  if (strokeAttr == null || strokeAttr === '' || strokeAttr === 'none') {
    if (options?.primKind === 'line') {
      return 2;
    }
    return 0;
  }
  const s = elStyle.strokeWidth;
  if (s != null && s !== '') {
    const p = parseFloat(s);
    if (Number.isFinite(p) && p > 0) {
      return p;
    }
  }
  return 2;
}

export function pickStrokeColorForChild(
  elStyle: IconSvgStyle,
  userStroke: string | undefined,
  userFill: string | undefined,
): string {
  const s = (elStyle.stroke ?? 'currentColor').trim();
  if (s === 'currentColor' || s === '') {
    return userStroke ?? userFill ?? '#000';
  }
  if (s === 'none') {
    return userStroke ?? userFill ?? '#000';
  }
  return s;
}

export function pickChildFill(
  elStyle: IconSvgStyle,
  userColorFill: string | undefined,
  userColorStroke: string | undefined,
): string {
  const f = (elStyle.fill ?? 'none').trim();
  if (f === 'none' || f === 'transparent') {
    return 'none';
  }
  if (f === 'currentColor') {
    // 与 `pickStrokeColorForChild` 一致：SVG 的 currentColor 在画布上由节点 fill/stroke 决定，未设时默认可见色
    return userColorFill ?? userColorStroke ?? '#000';
  }
  return f;
}

export function mapSvgLineCap(
  s: string | undefined,
): 'butt' | 'round' | 'square' {
  if (s === 'round' || s === 'square' || s === 'butt') {
    return s;
  }
  return 'round';
}

export function mapSvgLineJoin(
  s: string | undefined,
): 'miter' | 'round' | 'bevel' {
  if (s === 'round' || s === 'bevel' || s === 'miter') {
    return s;
  }
  return 'round';
}
