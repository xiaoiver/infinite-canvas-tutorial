import { v4 as uuidv4 } from 'uuid';
import type {
  Extrude3DOptions,
  GSerializedNode,
  IconFontSerializedNode,
  PathSerializedNode,
} from '../types/serialized-node';
import { buildPathExtrusionMesh } from './path-extrusion-mesh';
import { strokeOutline } from './stroke-outline';
import {
  buildIconFontScalablePrimitives,
  mapSvgLineCap,
  mapSvgLineJoin,
  pathFillRuleFromIconStyle,
  pickChildFill,
  pickStrokeColorForChild,
  resolveIconFontWireStyle,
  strokeWidthFromIconStyle,
  type ScaledIconPrimitive,
} from './icon-font';

export const ICON_3D_MATERIALS = {
  matte: { metallic: 0, roughness: 0.9 },
  glossy: { metallic: 0, roughness: 0.18 },
  metal: { metallic: 1, roughness: 0.25 },
} as const;

export type Icon3DMaterial = keyof typeof ICON_3D_MATERIALS;

function primitivePath(primitive: ScaledIconPrimitive): string {
  if (primitive.kind === 'path') return primitive.d;
  if (primitive.kind === 'line')
    return `M${primitive.x1} ${primitive.y1}L${primitive.x2} ${primitive.y2}`;
  const { cx, cy, rx, ry } = primitive;
  const k = 0.5522847498307936;
  return `M${cx + rx} ${cy}C${cx + rx} ${cy + k * ry} ${cx + k * rx} ${
    cy + ry
  } ${cx} ${cy + ry}C${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${
    cx - rx
  } ${cy}C${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${
    cy - ry
  }C${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy}Z`;
}

function solidColor(color: string): boolean {
  return (
    color !== 'none' &&
    color !== 'transparent' &&
    !/^(?:url\(|var\(|linear-gradient\(|radial-gradient\()/i.test(color)
  );
}

/** A conversion replaces an IconFont with a group of independently editable 3D Paths. */
export function iconFontToExtrudedPaths(
  icon: IconFontSerializedNode,
  options: Extrude3DOptions,
): { group: GSerializedNode; paths: PathSerializedNode[] } | undefined {
  const width = icon.width ?? 24;
  const height = icon.height ?? 24;
  if (width <= 0 || height <= 0) return;
  const primitives = buildIconFontScalablePrimitives(
    String(icon.iconFontName ?? ''),
    String(icon.iconFontFamily ?? 'lucide'),
    width,
    height,
  );
  if (!primitives?.length) return;
  const style = resolveIconFontWireStyle({ ...icon }, undefined, undefined);
  const groupId = uuidv4();
  const group: GSerializedNode = {
    id: groupId,
    type: 'g',
    parentId: icon.parentId,
    name: `${icon.name ?? icon.iconFontName ?? 'Icon'} 3D`,
    x: icon.x ?? 0,
    y: icon.y ?? 0,
    width,
    height,
    rotation: icon.rotation,
    scaleX: icon.scaleX,
    scaleY: icon.scaleY,
    zIndex: icon.zIndex,
    opacity: icon.opacity,
  };
  const paths: PathSerializedNode[] = [];
  for (const primitive of primitives) {
    const d = primitivePath(primitive);
    const fill = pickChildFill(
      primitive.style,
      style.userColorFill,
      style.userColorStroke,
      primitive.kind,
    );
    const addPath = (
      shape: string,
      color: string,
      fillRule: CanvasFillRule,
    ) => {
      if (
        !shape ||
        !solidColor(color) ||
        !buildPathExtrusionMesh(shape, fillRule)
      )
        return;
      paths.push({
        id: uuidv4(),
        type: 'path',
        parentId: groupId,
        zIndex: paths.length,
        d: shape,
        fillRule,
        fills: [{ type: 'solid', value: color }],
        extrude3d: { ...options },
      });
    };
    if (fill !== 'none')
      addPath(d, fill, pathFillRuleFromIconStyle(primitive.style));
    const stroke = primitive.style.stroke;
    const strokeWidth = strokeWidthFromIconStyle(primitive.style, style.rSw, {
      primKind: primitive.kind,
    });
    if (
      ((stroke && stroke !== 'none') || primitive.kind === 'line') &&
      strokeWidth > 0
    ) {
      try {
        addPath(
          strokeOutline(
            d,
            strokeWidth,
            mapSvgLineCap(primitive.style.strokeLinecap),
            mapSvgLineJoin(primitive.style.strokeLinejoin),
            2,
          ),
          pickStrokeColorForChild(
            primitive.style,
            style.userColorStroke,
            style.userColorFill,
          ),
          'evenodd',
        );
      } catch {
        // A malformed SVG stroke does not prevent other icon parts from converting.
      }
    }
  }
  return paths.length ? { group, paths } : undefined;
}
