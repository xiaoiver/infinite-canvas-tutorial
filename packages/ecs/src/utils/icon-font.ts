import { mat3 } from 'gl-matrix';
import { Ellipse } from '../components/geometry/Ellipse';
import { Line } from '../components/geometry/Line';
import { Path } from '../components/geometry/Path';
import {
  transformPath,
  shiftPath,
} from './serialize/transform';
import { resolveDesignVariableValue, type DesignVariablesMap } from './design-variables';
import type { ThemeMode } from '../components/Theme';
import type { Group } from '../components/geometry/Group';
import type {
  IconFontSerializedNode,
  FillAttributes,
  StrokeAttributes,
} from '../types/serialized-node';

/** 与 Iconify `icons[name]` 一项对齐：可有 `body`，以及**该项**的 `width` / `height` 作为该图视口。 */
export type IconifyIconEntry = {
  body?: string;
  width?: number;
  height?: number;
};

export type IconifyIconCollection = {
  icons?: Record<string, IconifyIconEntry | { body?: string; width?: number; height?: number }>;
  /** 集合级默认视口，与 `viewBox` 同语义（Iconify JSON 根字段，如 24 / 32） */
  width?: number;
  height?: number;
};

type RegisteredIconifySet = {
  icons: Record<string, IconifyIconEntry>;
  /** 来自 JSON 根；未给时为 0。解析单枚 icon 时，若该 icon 自带合法 width/height 则优先，否则用此处，再否则 AABB 缩放。 */
  viewWidth: number;
  viewHeight: number;
};

function resolveIconifyViewBoxForIcon(
  setEntry: RegisteredIconifySet,
  icon: IconifyIconEntry | undefined,
): { viewW: number; viewH: number } {
  const iw = icon?.width;
  const ih = icon?.height;
  if (
    typeof iw === 'number' &&
    Number.isFinite(iw) &&
    iw > 0 &&
    typeof ih === 'number' &&
    Number.isFinite(ih) &&
    ih > 0
  ) {
    return { viewW: iw, viewH: ih };
  }
  if (
    setEntry.viewWidth > 0 &&
    setEntry.viewHeight > 0 &&
    Number.isFinite(setEntry.viewWidth) &&
    Number.isFinite(setEntry.viewHeight)
  ) {
    return { viewW: setEntry.viewWidth, viewH: setEntry.viewHeight };
  }
  return { viewW: 0, viewH: 0 };
}

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
  sets: Map<string, RegisteredIconifySet>;
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
 * 每枚 `icons[name]` 若带 **有效的** `width`+`height`，则解析该 `body` 时以其为视口，**优先于** 根上集合级 `width`/`height`；二者皆无时仍按 path 并集 AABB 缩放。
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
  const u = unwrapped as {
    width?: number;
    height?: number;
    icons?: Record<string, IconifyIconEntry>;
  };
  const viewWidth =
    typeof u.width === 'number' && Number.isFinite(u.width) && u.width > 0
      ? u.width
      : 0;
  const viewHeight =
    typeof u.height === 'number' && Number.isFinite(u.height) && u.height > 0
      ? u.height
      : 0;
  sets.set(f, {
    icons: { ...(u.icons ?? {}) } as Record<string, IconifyIconEntry>,
    viewWidth,
    viewHeight,
  });
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

/**
 * 已注册的某 Iconify 集合下全部图标名（`icons` 的 key），已排序。未注册时返回 `[]`。
 * @param family 与 {@link registerIconifyIconSet} 一致，小写集合 id
 */
export function getRegisteredIconifyIconNames(family: string): string[] {
  const f = (family?.trim() || 'lucide').toLowerCase();
  if (!f) {
    return [];
  }
  const set = getIconifyStore().sets.get(f);
  if (!set?.icons) {
    return [];
  }
  return Object.keys(set.icons).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
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
  /** 来自 `fill-rule`（`nonzero` / `evenodd`），小写。 */
  fillRule?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
};

function pickVisualAttrs(attrs: Record<string, string>): IconSvgStyle {
  return {
    fill: attrs['fill'] ?? undefined,
    fillRule: attrs['fill-rule']?.trim().toLowerCase() ?? undefined,
    stroke: attrs['stroke'] ?? undefined,
    strokeWidth: attrs['stroke-width'] ?? undefined,
    strokeLinecap: attrs['stroke-linecap'] ?? undefined,
    strokeLinejoin: attrs['stroke-linejoin'] ?? undefined,
  };
}

/** 与 {@link Path.fillRule} / Canvas `fillRule` 对齐；无法识别时与 SVG 默认一致为 `nonzero`。 */
export function pathFillRuleFromIconStyle(
  style: IconSvgStyle,
): 'nonzero' | 'evenodd' {
  const r = style.fillRule?.trim().toLowerCase();
  if (r === 'evenodd' || r === 'even-odd') {
    return 'evenodd';
  }
  return 'nonzero';
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
const SELF_TAG_RE =
  /<(path|circle|line|ellipse|rect)\b([^/]*?)\s*\/>/g;

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
 * 将 &lt;rect> 转为 path 的 d（非负 rx/ry 圆角，过大时与 SVG 一致截至 min(w,h)/2；无则直角矩形）。
 */
function rectElementToPathD(at: Record<string, string>): string | null {
  const x = parseFloat(String(at['x'] ?? 0)) || 0;
  const y = parseFloat(String(at['y'] ?? 0)) || 0;
  const w = parseFloat(String(at['width'] ?? 0)) || 0;
  const h = parseFloat(String(at['height'] ?? 0)) || 0;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  let rx = 0;
  let ry = 0;
  if (at['rx'] != null && String(at['rx']).trim() !== '') {
    const v = parseFloat(String(at['rx']));
    if (Number.isFinite(v) && v > 0) {
      rx = v;
    }
  }
  if (at['ry'] != null && String(at['ry']).trim() !== '') {
    const v = parseFloat(String(at['ry']));
    if (Number.isFinite(v) && v > 0) {
      ry = v;
    }
  } else if (rx > 0) {
    ry = rx;
  }
  if (rx === 0 && at['r'] != null && String(at['r']).trim() !== '') {
    const v = parseFloat(String(at['r']));
    if (Number.isFinite(v) && v > 0) {
      rx = v;
      ry = v;
    }
  }
  if (ry === 0 && rx > 0) {
    ry = rx;
  }
  if (rx === 0 && ry > 0) {
    rx = ry;
  }
  const cap = Math.min(w, h) * 0.5;
  if (rx > 0) {
    rx = Math.min(rx, cap);
  }
  if (ry > 0) {
    ry = Math.min(ry, cap);
  }
  if (rx <= 0 || ry <= 0) {
    return `M${x} ${y}h${w}v${h}h${-w}Z`;
  }
  return (
    `M${x + rx} ${y}h${w - 2 * rx}` +
    `a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}` +
    `a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}` +
    `a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}` +
    `a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`
  );
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
  if (!/^(g|path|circle|line|ellipse|rect)$/.test(name)) {
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

function toPositiveIconFontDim(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 0;
}

/**
 * 与反序列化、sync、缩放矢量共用：收敛出正的目标框 (w,h)，避免一侧为 0 时与 24 混用成 24×100 等。
 */
export function resolveIconFontTargetDimensions(
  targetWidth: unknown,
  targetHeight: unknown,
): { w: number; h: number } {
  let w = toPositiveIconFontDim(targetWidth);
  let h = toPositiveIconFontDim(targetHeight);
  if (w > 0 && h <= 0) {
    h = w;
  } else if (h > 0 && w <= 0) {
    w = h;
  }
  if (w <= 0 && h <= 0) {
    w = 24;
    h = 24;
  }
  return { w, h };
}

/**
 * 将 Iconify 的 `body`（可含一层或多层 \<g>、`fill="currentColor"` 等）解析为带合并样式后的可缩放子图元。
 * 与 SVG 一致：祖先 `g` 的展示属性与子 path/ellipse/line 自身属性合并，后者优先。
 *
 * @param viewBoxWidth 注册集合 JSON 根上 `width`；>0 时按视口 (0,0)–(vw,vh) 映射到目标框，与官方 viewBox 一致，不按 path 并集平移。
 * @param viewBoxHeight 同上 `height`。
 */
export function resolveIconifyBodyToScalablePrimitives(
  body: string,
  targetWidth: unknown,
  targetHeight: unknown,
  viewBoxWidth = 0,
  viewBoxHeight = 0,
): ScaledIconPrimitive[] | null {
  const { w, h } = resolveIconFontTargetDimensions(targetWidth, targetHeight);
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
        return;
      }
      if (tag === 'rect') {
        const d = rectElementToPathD(at);
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
      } else if (tag === 'rect') {
        const d = rectElementToPathD(at);
        if (!d) {
          continue;
        }
        const b = aabbPath(d);
        if (!isFiniteAabb(b)) {
          continue;
        }
        flat.push({ prim: { kind: 'path', d, style: st }, b });
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
  const { minX, minY } = combined;

  const useViewBox =
    viewBoxWidth > 0 && viewBoxHeight > 0 && Number.isFinite(viewBoxWidth) && Number.isFinite(viewBoxHeight);
  if (useViewBox) {
    const vw = viewBoxWidth;
    const vh = viewBoxHeight;
    const s = Math.min(w / vw, h / vh);
    const tx = (w - s * vw) * 0.5;
    const ty = (h - s * vh) * 0.5;
    return items.map(({ prim }) => {
      if (prim.kind === 'path') {
        return {
          kind: 'path' as const,
          d: shiftPath(
            transformPath(prim.d, mat3.fromScaling(mat3.create(), [s, s])),
            tx,
            ty,
          ),
          style: prim.style,
        };
      }
      if (prim.kind === 'ellipse') {
        return {
          kind: 'ellipse' as const,
          cx: prim.cx * s + tx,
          cy: prim.cy * s + ty,
          rx: prim.rx * s,
          ry: prim.ry * s,
          style: prim.style,
        };
      }
      return {
        kind: 'line' as const,
        x1: prim.x1 * s + tx,
        y1: prim.y1 * s + ty,
        x2: prim.x2 * s + tx,
        y2: prim.y2 * s + ty,
        style: prim.style,
      };
    });
  }

  /**
   * 无集合级 viewBox 时：用 path 并集 AABB 归一化后再等比塞进目标框（与旧版一致）。
   */
  const s = Math.min(w / rawW, h / rawH);
  const tx = (w - s * rawW) * 0.5;
  const ty = (h - s * rawH) * 0.5;

  return items.map(({ prim }) => {
    if (prim.kind === 'path') {
      return {
        kind: 'path' as const,
        d: shiftPath(
          transformPath(
            shiftPath(prim.d, -minX, -minY),
            mat3.fromScaling(mat3.create(), [s, s]),
          ),
          tx,
          ty,
        ),
        style: prim.style,
      };
    }
    if (prim.kind === 'ellipse') {
      return {
        kind: 'ellipse' as const,
        cx: (prim.cx - minX) * s + tx,
        cy: (prim.cy - minY) * s + ty,
        rx: prim.rx * s,
        ry: prim.ry * s,
        style: prim.style,
      };
    }
    return {
      kind: 'line' as const,
      x1: (prim.x1 - minX) * s + tx,
      y1: (prim.y1 - minY) * s + ty,
      x2: (prim.x2 - minX) * s + tx,
      y2: (prim.y2 - minY) * s + ty,
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
  const setEntry = sets.get(setId)!;
  const iconEntry = setEntry.icons[normalized];
  const { viewW, viewH } = resolveIconifyViewBoxForIcon(setEntry, iconEntry);
  const k = `body:${setId}:${normalized}`;
  if (bodyCache.has(k)) {
    const b = bodyCache.get(k);
    if (b == null) {
      return null;
    }
    return resolveIconifyBodyToScalablePrimitives(
      b,
      targetWidth,
      targetHeight,
      viewW,
      viewH,
    );
  }
  const b = iconEntry?.body ?? null;
  bodyCache.set(k, b);
  if (b == null) {
    return null;
  }
  return resolveIconifyBodyToScalablePrimitives(
    b,
    targetWidth,
    targetHeight,
    viewW,
    viewH,
  );
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
  /** 用于 stroke-only 时是否在 ECS 侧补 `FillSolid`（path/line 无 Mesh 填充，仅 ellipse 等可走 SDF）。 */
  primKind?: ScaledIconPrimitive['kind'],
): string {
  const f = (elStyle.fill ?? 'none').trim();
  if (f === 'none' || f === 'transparent') {
    if (primKind === 'path' || primKind === 'line') {
      return 'none';
    }
    // ellipse：与描边同色填充圆盘，使父级 `filter`（纹理空间后处理）有栅格可采；视觉上与实心圆+描边接近。
    return userColorStroke ?? userColorFill ?? '#000';
  }
  if (f === 'currentColor') {
    // 与 `pickStrokeColorForChild` 一致：SVG 的 currentColor 在画布上由节点 fill/stroke 决定，未设时默认可见色
    return userColorFill ?? userColorStroke ?? '#000';
  }
  return f;
}

/** SVG `stroke-linecap` 默认 `butt`（未设或无法识别时）。 */
export function mapSvgLineCap(
  s: string | undefined,
): 'butt' | 'round' | 'square' {
  const v = s?.trim().toLowerCase();
  if (v === 'round' || v === 'square' || v === 'butt') {
    return v;
  }
  return 'butt';
}

/** SVG `stroke-linejoin` 默认 `miter`（未设或无法识别时）。 */
export function mapSvgLineJoin(
  s: string | undefined,
): 'miter' | 'round' | 'bevel' {
  const v = s?.trim().toLowerCase();
  if (v === 'round' || v === 'bevel' || v === 'miter') {
    return v;
  }
  return 'miter';
}
