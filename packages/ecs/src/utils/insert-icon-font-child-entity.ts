import { EntityCommands } from '../commands/EntityCommands';
import {
  Ellipse,
  Line,
  Name,
  Path,
  Renderable,
  Stroke,
  FillSolid,
  TesselationMethod,
  Transform,
  Visibility,
  ZIndex,
} from '../components';
import type { ScaledIconPrimitive } from './icon-font';
import {
  mapSvgLineCap,
  mapSvgLineJoin,
  pathFillRuleFromIconStyle,
  pickChildFill,
  pickStrokeColorForChild,
  strokeWidthFromIconStyle,
} from './icon-font';

export type IconFontChildInsertOptions = {
  userColorStroke: string | undefined;
  userColorFill: string | undefined;
  rSw: unknown;
  zIndex: number;
  visibility: 'inherited' | 'hidden' | 'visible';
  name: string;
  /** 根节点带栅格类 `filter` 时置 true，ellipse 才补 `FillSolid` 以便后处理。 */
  strokeAsPlaceholderFillForRasterFilter?: boolean;
};

/**
 * 与 `serializedNodesToEntities` 中 `iconfont` 子实体一致，用于反序列化与
 * `syncIconFontChildrenFromUpdatedNode` 补全子 path。
 */
export function insertIconFontChildFromPrimitive(
  ch: EntityCommands,
  prim: ScaledIconPrimitive,
  opts: IconFontChildInsertOptions,
): void {
  ch.insert(
    new Transform({
      translation: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
    }),
  );
  ch.insert(new Renderable());
  if (prim.kind === 'path') {
    ch.insert(
      new Path({
        d: prim.d,
        tessellationMethod: TesselationMethod.LIBTESS,
        fillRule: pathFillRuleFromIconStyle(prim.style),
      }),
    );
  } else if (prim.kind === 'ellipse') {
    ch.insert(
      new Ellipse({
        cx: prim.cx,
        cy: prim.cy,
        rx: prim.rx,
        ry: prim.ry,
      }),
    );
  } else {
    ch.insert(
      new Line({
        x1: prim.x1,
        y1: prim.y1,
        x2: prim.x2,
        y2: prim.y2,
      }),
    );
  }
  ch.insert(
    new Stroke({
      color: pickStrokeColorForChild(
        prim.style,
        opts.userColorStroke,
        opts.userColorFill,
      ),
      width: strokeWidthFromIconStyle(prim.style, opts.rSw, {
        primKind: prim.kind,
      }),
      linecap: mapSvgLineCap(prim.style.strokeLinecap),
      linejoin: mapSvgLineJoin(prim.style.strokeLinejoin),
    }),
  );
  const fillPart = pickChildFill(
    prim.style,
    opts.userColorFill,
    opts.userColorStroke,
    prim.kind,
    opts.strokeAsPlaceholderFillForRasterFilter === true,
  );
  if (fillPart && fillPart !== 'none') {
    ch.insert(new FillSolid(fillPart, ''));
  }
  ch.insert(new ZIndex(opts.zIndex));
  ch.insert(new Visibility(opts.visibility));
  ch.insert(new Name(opts.name));
}
