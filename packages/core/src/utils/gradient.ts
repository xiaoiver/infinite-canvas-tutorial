/**
 * borrow from gradient-parser, but we delete some browser compatible prefix such as `-webkit-`
 * @see https://github.com/rafaelcaricio/gradient-parser
 */

import { distanceSquareRoot, isNil, isString } from '@antv/util';
import { DEG_TO_RAD } from '@pixi/math';

/** 与 ECS `mesh-gradient-padding` 中默认 UV 一致（供 opts 默认比较）。 */
const DEFAULT_MESH_GRADIENT_CORNER_POSITIONS: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [0.5, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
  [0, 0],
];

export interface LinearGradientNode {
  type: 'linear-gradient';
  orientation?: DirectionalNode | AngularNode | undefined;
  colorStops: ColorStop[];
}

export interface RepeatingLinearGradientNode {
  type: 'repeating-linear-gradient';
  orientation?: DirectionalNode | AngularNode | undefined;
  colorStops: ColorStop[];
}

export interface RadialGradientNode {
  type: 'radial-gradient';
  orientation?:
    | (ShapeNode | DefaultRadialNode | ExtentKeywordNode)[]
    | undefined;
  colorStops: ColorStop[];
}

export interface ConicGradientNode {
  type: 'conic-gradient';
  orientation?:
    | (ShapeNode | DefaultRadialNode | ExtentKeywordNode)[]
    | undefined;
  colorStops: ColorStop[];
}

/**
 * 单个角点：颜色 + 可选的归一化 UV `x y`（0～1），在串里可写作 `#rgb 0.1 0.2`。
 */
export interface MeshGradientCorner {
  color: ColorStop;
  uv?: [number, number];
}

/**
 * 3×3 网格角点（行主序，AST 中 1～9 个）+ 背景色。`parseGradient` 不足 9 个角点用背景色填充；未写 UV
 * 的角点使用默认 3×3 网格位置。
 */
export interface MeshGradientNode {
  type: 'mesh-gradient';
  background: ColorStop;
  corners: MeshGradientCorner[];
  /** 与 `gtype()` / `wshape()` / `warp()` / `time()` / `points()` 等尾部函数字段对应。 */
  gradientTypeIndex?: number;
  warpShapeIndex?: number;
  warpSize?: number;
  warpRatio?: number;
  time?: number;
  pointsNum?: number;
}

export interface RepeatingRadialGradientNode {
  type: 'repeating-radial-gradient';
  orientation?:
    | (ShapeNode | DefaultRadialNode | ExtentKeywordNode)[]
    | undefined;
  colorStops: ColorStop[];
}

export interface DirectionalNode {
  type: 'directional';
  value:
    | 'left'
    | 'top'
    | 'bottom'
    | 'right'
    | 'left top'
    | 'top left'
    | 'left bottom'
    | 'bottom left'
    | 'right top'
    | 'top right'
    | 'right bottom'
    | 'bottom right';
}

export interface AngularNode {
  type: 'angular';
  value: string;
}

export interface LiteralNode {
  type: 'literal';
  value: string;
  length?: PxNode | EmNode | PercentNode | undefined;
}

export interface HexNode {
  type: 'hex';
  value: string;
  length?: PxNode | EmNode | PercentNode | undefined;
}

export interface RgbNode {
  type: 'rgb';
  value: [string, string, string];
  length?: PxNode | EmNode | PercentNode | undefined;
}

export interface RgbaNode {
  type: 'rgba';
  value: [string, string, string, string?];
  length?: PxNode | EmNode | PercentNode | undefined;
}

export interface ShapeNode {
  type: 'shape';
  style?:
    | ExtentKeywordNode
    | PxNode
    | EmNode
    | PercentNode
    | PositionKeywordNode
    | undefined;
  value: 'ellipse' | 'circle';
  at?: PositionNode | undefined;
}

export interface DefaultRadialNode {
  type: 'default-radial';
  at: PositionNode;
}

export interface PositionKeywordNode {
  type: 'position-keyword';
  value: 'center' | 'left' | 'top' | 'bottom' | 'right';
}

export interface PositionNode {
  type: 'position';
  value: {
    x: ExtentKeywordNode | PxNode | EmNode | PercentNode | PositionKeywordNode;
    y: ExtentKeywordNode | PxNode | EmNode | PercentNode | PositionKeywordNode;
  };
}

export interface ExtentKeywordNode {
  type: 'extent-keyword';
  value:
    | 'closest-side'
    | 'closest-corner'
    | 'farthest-side'
    | 'farthest-corner'
    | 'contain'
    | 'cover';
  at?: PositionNode | undefined;
}

export interface PxNode {
  type: 'px';
  value: string;
}

export interface EmNode {
  type: 'em';
  value: string;
}

export interface PercentNode {
  type: '%';
  value: string;
}

export type ColorStop = LiteralNode | HexNode | RgbNode | RgbaNode;

export type GradientNode =
  | LinearGradientNode
  | RepeatingLinearGradientNode
  | RadialGradientNode
  | RepeatingRadialGradientNode
  | ConicGradientNode
  | MeshGradientNode;

export function colorStopToString(colorStop: ColorStop) {
  const { type, value } = colorStop;
  if (type === 'hex') {
    return `#${value}`;
  }
  if (type === 'literal') {
    return value;
  }
  if (type === 'rgb') {
    return `rgb(${value.join(',')})`;
  }
  return `rgba(${value.join(',')})`;
}

export const parseGradientAST = (function () {
  const tokens = {
    linearGradient: /^(linear\-gradient)/i,
    repeatingLinearGradient: /^(repeating\-linear\-gradient)/i,
    radialGradient: /^(radial\-gradient)/i,
    repeatingRadialGradient: /^(repeating\-radial\-gradient)/i,
    /**
     * @see https://projects.verou.me/conic-gradient/
     */
    conicGradient: /^(conic\-gradient)/i,
    meshGradient: /^(mesh\-gradient)/i,
    sideOrCorner:
      /^to (left (top|bottom)|right (top|bottom)|top (left|right)|bottom (left|right)|left|right|top|bottom)/i,
    extentKeywords:
      /^(closest\-side|closest\-corner|farthest\-side|farthest\-corner|contain|cover)/,
    positionKeywords: /^(left|center|right|top|bottom)/i,
    pixelValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))px/,
    percentageValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))\%/,
    emValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))em/,
    angleValue: /^(-?(([0-9]*\.[0-9]+)|([0-9]+\.?)))deg/,
    startCall: /^\(/,
    endCall: /^\)/,
    comma: /^,/,
    // 仅 3/4/6/8 位，避免把「#rrggbb + 0.5 0.5」里的 0 吃进 hex，导致后面数字无法按 UV 解析
    hexColor:
      /^\#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})/i,
    literalColor: /^([a-zA-Z]+)/,
    rgbColor: /^rgb/i,
    rgbaColor: /^rgba/i,
    number: /^(([0-9]*\.[0-9]+)|([0-9]+\.?))/,
  };

  let input = '';

  function error(msg: string) {
    throw new Error(`${input}: ${msg}`);
  }

  function getAST() {
    const ast = matchListDefinitions();

    if (input.length > 0) {
      error('Invalid input not EOF');
    }

    return ast;
  }

  function matchListDefinitions() {
    return matchListing(matchDefinition);
  }

  function isMeshFunctionExtraNext() {
    const s = input.replace(/^\s+/, '');
    return (
      /^warp\s*\(/i.test(s) ||
      /^gtype\s*\(/i.test(s) ||
      /^wshape\s*\(/i.test(s) ||
      /^time\s*\(/i.test(s) ||
      /^points\s*\(/i.test(s)
    );
  }

  function parseMeshGradientExtras(): {
    extras: {
      gradientTypeIndex?: number;
      warpShapeIndex?: number;
      warpSize?: number;
      warpRatio?: number;
      time?: number;
      pointsNum?: number;
    };
  } {
    const extras: {
      gradientTypeIndex?: number;
      warpShapeIndex?: number;
      warpSize?: number;
      warpRatio?: number;
      time?: number;
      pointsNum?: number;
    } = {};

    function tryReadWarp(): boolean {
      if (!scan(/^warp\s*\(/i)) {
        return false;
      }
      const a = tryScanNumber();
      if (a === null) {
        error('mesh-gradient: warp() expects a number');
      }
      if (!scan(tokens.comma)) {
        error('mesh-gradient: warp() expected comma between numbers');
      }
      const b = tryScanNumber();
      if (b === null) {
        error('mesh-gradient: warp() expects two numbers');
      }
      if (!scan(tokens.endCall)) {
        error('mesh-gradient: warp() expected )');
      }
      extras.warpSize = a;
      extras.warpRatio = b;
      return true;
    }

    function tryReadOneArg(
      pattern: RegExp,
      key: 'gradientTypeIndex' | 'warpShapeIndex' | 'time' | 'pointsNum',
    ): boolean {
      if (!scan(pattern)) {
        return false;
      }
      const n = tryScanNumber();
      if (n === null) {
        error('mesh-gradient: expected number in ()');
      }
      if (!scan(tokens.endCall)) {
        error('mesh-gradient: expected )');
      }
      extras[key] = n;
      return true;
    }

    let atStart = true;
    for (;;) {
      if (/^\s*\)/.test(input)) {
        return { extras };
      }
      if (atStart) {
        atStart = false;
        if (scan(tokens.comma)) {
          // ok
        } else if (isMeshFunctionExtraNext()) {
          // early break: comma already consumed before this tail
        } else if (/^\s*\)/.test(input)) {
          return { extras };
        } else {
          error('mesh-gradient: expected color / tail options or )');
        }
      } else if (!scan(tokens.comma)) {
        if (/^\s*\)/.test(input)) {
          return { extras };
        }
        error('mesh-gradient: expected , or )');
      }

      if (tryReadWarp()) {
        continue;
      }
      if (tryReadOneArg(/^gtype\s*\(/i, 'gradientTypeIndex')) {
        continue;
      }
      if (tryReadOneArg(/^wshape\s*\(/i, 'warpShapeIndex')) {
        continue;
      }
      if (tryReadOneArg(/^time\s*\(/i, 'time')) {
        continue;
      }
      if (tryReadOneArg(/^points\s*\(/i, 'pointsNum')) {
        continue;
      }
      error('mesh-gradient: expected warp(), gtype(), wshape(), time() or points()');
    }
  }

  function tryScanNumber(): number | null {
    const cap = scan(tokens.number);
    if (!cap) {
      return null;
    }
    return Number(cap[1]);
  }

  function matchMeshCorner():
    | { color: ColorStop; uv?: [number, number] }
    | null {
    const color = matchColor();
    if (!color) {
      return null;
    }
    const saved = input;
    const u = tryScanNumber();
    if (u === null) {
      return { color };
    }
    const v = tryScanNumber();
    if (v === null) {
      input = saved;
      error(
        'mesh-gradient: after a corner color, either omit U V or provide two numbers',
      );
    }
    return { color, uv: [u, v] as [number, number] };
  }

  function matchMeshGradient() {
    return matchCall(tokens.meshGradient, function () {
      const background = matchColor();
      if (!background) {
        error('mesh-gradient: expected background color');
      }
      if (!scan(tokens.comma)) {
        error('mesh-gradient: expected comma after background color');
      }
      const c0 = matchMeshCorner();
      if (!c0) {
        error('mesh-gradient: expected at least one corner color');
      }
      const corners: {
        color: ColorStop;
        uv?: [number, number];
      }[] = [c0];
      while (corners.length < 9) {
        if (!scan(tokens.comma)) {
          break;
        }
        if (isMeshFunctionExtraNext()) {
          break;
        }
        const c = matchMeshCorner();
        if (!c) {
          error('mesh-gradient: expected color or tail options after comma');
        }
        corners.push(c);
      }
      const { extras } = parseMeshGradientExtras();
      return {
        type: 'mesh-gradient',
        background,
        corners,
        ...extras,
      };
    });
  }

  function matchDefinition() {
    return (
      matchMeshGradient() ||
      matchGradient(
        'linear-gradient',
        tokens.linearGradient,
        matchLinearOrientation,
      ) ||
      matchGradient(
        'repeating-linear-gradient',
        tokens.repeatingLinearGradient,
        matchLinearOrientation,
      ) ||
      matchGradient(
        'radial-gradient',
        tokens.radialGradient,
        matchListRadialOrientations,
      ) ||
      matchGradient(
        'repeating-radial-gradient',
        tokens.repeatingRadialGradient,
        matchListRadialOrientations,
      ) ||
      matchGradient(
        'conic-gradient',
        tokens.conicGradient,
        matchListRadialOrientations,
      )
    );
  }

  function matchGradient(
    gradientType: string,
    pattern: RegExp,
    orientationMatcher,
  ) {
    return matchCall(pattern, function (captures) {
      const orientation = orientationMatcher();
      if (orientation) {
        if (!scan(tokens.comma)) {
          error('Missing comma before color stops');
        }
      }

      return {
        type: gradientType,
        orientation,
        colorStops: matchListing(matchColorStop),
      };
    });
  }

  function matchCall(pattern, callback) {
    const captures = scan(pattern);

    if (captures) {
      if (!scan(tokens.startCall)) {
        error('Missing (');
      }

      const result = callback(captures);

      if (!scan(tokens.endCall)) {
        error('Missing )');
      }

      return result;
    }
  }

  function matchLinearOrientation() {
    return matchSideOrCorner() || matchAngle();
  }

  function matchSideOrCorner() {
    return match('directional', tokens.sideOrCorner, 1);
  }

  function matchAngle() {
    return match('angular', tokens.angleValue, 1);
  }

  function matchListRadialOrientations() {
    let radialOrientations;
    let radialOrientation = matchRadialOrientation();
    let lookaheadCache;

    if (radialOrientation) {
      radialOrientations = [];
      radialOrientations.push(radialOrientation);

      lookaheadCache = input;
      if (scan(tokens.comma)) {
        radialOrientation = matchRadialOrientation();
        if (radialOrientation) {
          radialOrientations.push(radialOrientation);
        } else {
          input = lookaheadCache;
        }
      }
    }

    return radialOrientations;
  }

  function matchRadialOrientation() {
    let radialType = matchCircle() || matchEllipse();

    if (radialType) {
      // @ts-ignore
      radialType.at = matchAtPosition();
    } else {
      const extent = matchExtentKeyword();
      if (extent) {
        radialType = extent;
        const positionAt = matchAtPosition();
        if (positionAt) {
          // @ts-ignore
          radialType.at = positionAt;
        }
      } else {
        const defaultPosition = matchPositioning();
        if (defaultPosition) {
          radialType = {
            type: 'default-radial',
            // @ts-ignore
            at: defaultPosition,
          };
        }
      }
    }

    return radialType;
  }

  function matchCircle() {
    const circle = match('shape', /^(circle)/i, 0);

    if (circle) {
      // @ts-ignore
      circle.style = matchLength() || matchExtentKeyword();
    }

    return circle;
  }

  function matchEllipse() {
    const ellipse = match('shape', /^(ellipse)/i, 0);

    if (ellipse) {
      // @ts-ignore
      ellipse.style = matchDistance() || matchExtentKeyword();
    }

    return ellipse;
  }

  function matchExtentKeyword() {
    return match('extent-keyword', tokens.extentKeywords, 1);
  }

  function matchAtPosition() {
    if (match('position', /^at/, 0)) {
      const positioning = matchPositioning();

      if (!positioning) {
        error('Missing positioning value');
      }

      return positioning;
    }
  }

  function matchPositioning() {
    const location = matchCoordinates();

    if (location.x || location.y) {
      return {
        type: 'position',
        value: location,
      };
    }
  }

  function matchCoordinates() {
    return {
      x: matchDistance(),
      y: matchDistance(),
    };
  }

  function matchListing(matcher: () => any) {
    let captures = matcher();
    const result = [];

    if (captures) {
      result.push(captures);
      while (scan(tokens.comma)) {
        captures = matcher();
        if (captures) {
          result.push(captures);
        } else {
          error('One extra comma');
        }
      }
    }

    return result;
  }

  function matchColorStop() {
    const color = matchColor();

    if (!color) {
      error('Expected color definition');
    }

    color.length = matchDistance();
    return color;
  }

  function matchColor() {
    return (
      matchHexColor() ||
      matchRGBAColor() ||
      matchRGBColor() ||
      matchLiteralColor()
    );
  }

  function matchLiteralColor() {
    return match('literal', tokens.literalColor, 0);
  }

  function matchHexColor() {
    return match('hex', tokens.hexColor, 1);
  }

  function matchRGBColor() {
    return matchCall(tokens.rgbColor, function () {
      return {
        type: 'rgb',
        value: matchListing(matchNumber),
      };
    });
  }

  function matchRGBAColor() {
    return matchCall(tokens.rgbaColor, function () {
      return {
        type: 'rgba',
        value: matchListing(matchNumber),
      };
    });
  }

  function matchNumber() {
    return scan(tokens.number)[1];
  }

  function matchDistance() {
    return (
      match('%', tokens.percentageValue, 1) ||
      matchPositionKeyword() ||
      matchLength()
    );
  }

  function matchPositionKeyword() {
    return match('position-keyword', tokens.positionKeywords, 1);
  }

  function matchLength() {
    return match('px', tokens.pixelValue, 1) || match('em', tokens.emValue, 1);
  }

  function match(type: string, pattern, captureIndex: number) {
    const captures = scan(pattern);
    if (captures) {
      return {
        type,
        value: captures[captureIndex],
      };
    }
  }

  function scan(regexp) {
    const blankCaptures = /^[\n\r\t\s]+/.exec(input);
    if (blankCaptures) {
      consume(blankCaptures[0].length);
    }

    const captures = regexp.exec(input);
    if (captures) {
      consume(captures[0].length);
    }

    return captures;
  }

  function consume(size: number) {
    input = input.substring(size);
  }

  return function (code: string): GradientNode[] {
    input = code;
    return getAST();
  };
})();

export function computeLinearGradient(
  min: [number, number],
  width: number,
  height: number,
  angle: number,
) {
  const rad = DEG_TO_RAD * angle;
  const rx = 0;
  const ry = 0;
  const rcx = rx + width / 2;
  const rcy = ry + height / 2;
  // get the length of gradient line
  // @see https://observablehq.com/@danburzo/css-gradient-line
  const length =
    Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
  const x1 = min[0] + rcx - (Math.cos(rad) * length) / 2;
  const y1 = min[1] + rcy - (Math.sin(rad) * length) / 2;
  const x2 = min[0] + rcx + (Math.cos(rad) * length) / 2;
  const y2 = min[1] + rcy + (Math.sin(rad) * length) / 2;

  return { x1, y1, x2, y2 };
}

export function computeConicGradient(
  min: [number, number],
  width: number,
  height: number,
  cx: {
    type: string;
    value: number;
  },
  cy: {
    type: string;
    value: number;
  },
) {
  // 'px'
  let x = cx.value;
  let y = cy.value;

  // '%'
  if (cx.type === '%') {
    x = (cx.value / 100) * width;
  }
  if (cy.type === '%') {
    y = (cy.value / 100) * height;
  }

  return { x: x + min[0], y: y + min[1] };
}

export function computeRadialGradient(
  min: [number, number],
  width: number,
  height: number,
  cx: {
    type: string;
    value: number;
  },
  cy: {
    type: string;
    value: number;
  },
  size?: {
    type: string;
    value: number | string;
  },
) {
  // 'px'
  let x = cx.value;
  let y = cy.value;

  // '%'
  if (cx.type === '%') {
    x = (cx.value / 100) * width;
  }
  if (cy.type === '%') {
    y = (cy.value / 100) * height;
  }

  // default to farthest-side
  let r = Math.max(
    distanceSquareRoot([0, 0], [x, y]),
    distanceSquareRoot([0, height], [x, y]),
    distanceSquareRoot([width, height], [x, y]),
    distanceSquareRoot([width, 0], [x, y]),
  );
  if (size) {
    if (size.type === 'extent-keyword') {
      if (size.value === 'closest-side') {
        r = Math.min(x, width - x, y, height - y);
      } else if (size.value === 'farthest-side') {
        r = Math.max(x, width - x, y, height - y);
      } else if (size.value === 'closest-corner') {
        r = Math.min(
          distanceSquareRoot([0, 0], [x, y]),
          distanceSquareRoot([0, height], [x, y]),
          distanceSquareRoot([width, height], [x, y]),
          distanceSquareRoot([width, 0], [x, y]),
        );
      }
    } else {
      r = Number(size.value);
    }
  }

  return { x: x + min[0], y: y + min[1], r };
}

function spaceColorStops(colorStops: ColorStop[]) {
  const { length } = colorStops;
  colorStops[length - 1].length = colorStops[length - 1].length ?? {
    type: '%',
    value: '100',
  };
  if (length > 1) {
    colorStops[0].length = colorStops[0].length ?? {
      type: '%',
      value: '0',
    };
  }

  let previousIndex = 0;
  let previousOffset = Number(colorStops[0].length.value);
  for (let i = 1; i < length; i++) {
    // support '%' & 'px'
    const offset = colorStops[i].length?.value;
    if (!isNil(offset) && !isNil(previousOffset)) {
      for (let j = 1; j < i - previousIndex; j++)
        colorStops[previousIndex + j].length = {
          type: '%',
          value: `${
            previousOffset +
            ((Number(offset) - previousOffset) * j) / (i - previousIndex)
          }`,
        };
      previousIndex = i;
      previousOffset = Number(offset);
    }
  }
}

// The position of the gradient line's starting point.
// different from CSS side(to top) @see https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient#values
const SideOrCornerToDegMap: Record<DirectionalNode['value'], number> = {
  left: 270 - 90,
  top: 0 - 90,
  bottom: 180 - 90,
  right: 90 - 90,
  'left top': 315 - 90,
  'top left': 315 - 90,
  'left bottom': 225 - 90,
  'bottom left': 225 - 90,
  'right top': 45 - 90,
  'top right': 45 - 90,
  'right bottom': 135 - 90,
  'bottom right': 135 - 90,
};

function angleToDeg(orientation: DirectionalNode | AngularNode) {
  let angle: number;
  if (orientation.type === 'angular') {
    angle = Number(orientation.value);
  } else {
    angle = SideOrCornerToDegMap[orientation.value] || 0;
  }
  return angle;
}

function positonToCSSUnitValue(position: PositionNode) {
  let cx = 50;
  let cy = 50;
  let unitX = '%';
  let unitY = '%';
  if (position?.type === 'position') {
    const { x, y } = position.value;
    if (x?.type === 'position-keyword') {
      if (x.value === 'left') {
        cx = 0;
      } else if (x.value === 'center') {
        cx = 50;
      } else if (x.value === 'right') {
        cx = 100;
      } else if (x.value === 'top') {
        cy = 0;
      } else if (x.value === 'bottom') {
        cy = 100;
      }
    }

    if (y?.type === 'position-keyword') {
      if (y.value === 'left') {
        cx = 0;
      } else if (y.value === 'center') {
        cy = 50;
      } else if (y.value === 'right') {
        cx = 100;
      } else if (y.value === 'top') {
        cy = 0;
      } else if (y.value === 'bottom') {
        cy = 100;
      }
    }

    if (x?.type === 'px' || x?.type === '%' || x?.type === 'em') {
      unitX = x?.type;
      cx = Number(x.value);
    }
    if (y?.type === 'px' || y?.type === '%' || y?.type === 'em') {
      unitY = y?.type;
      cy = Number(y.value);
    }
  }

  return {
    cx: {
      value: cx,
      type: unitX,
    },
    cy: {
      value: cy,
      type: unitY,
    },
  };
}

export interface LinearGradient {
  type: 'linear-gradient';
  angle: number;
  steps: {
    offset: {
      type: string;
      value: number;
    };
    color: string;
  }[];
}

export interface RadialGradient {
  type: 'radial-gradient';
  cx: {
    value: number;
    type: string;
  };
  cy: {
    value: number;
    type: string;
  };
  size?: {
    value: number | string;
    type: string;
  };
  steps: {
    offset: {
      type: string;
      value: number;
    };
    color: string;
  }[];
}

export interface ConicGradient {
  type: 'conic-gradient';
  cx: {
    value: number;
    type: string;
  };
  cy: {
    value: number;
    type: string;
  };
  angle: number;
  steps: {
    offset: {
      type: string;
      value: number;
    };
    color: string;
  }[];
}

/**
 * 3×3 UV 网格渐变（Canvas2D 无法表达），由 GPU 全屏 pass 光栅化，与站点
 * `shaders/mesh-gradient.ts` 的 `Uniforms` 一致。`colors` 为行主序 9 个角点色；可选字段用于
 * warp/类型/非默认 UV，缺省为静态 3×3 网格、无 warp。
 */
export interface MeshGradient {
  type: 'mesh-gradient';
  backgroundColor: string;
  colors: string[];
  /** 每点 [0,1]² UV，最多 10 点；缺省为 3×3 网格 9 点 + 占位 */
  positions?: [number, number][];
  /**
   * 片元中参与混合的点数；解析时默认可由显式角点个数（1～9）推断。仅第 10 点需
   * `points(10)` 显式声明。
   */
  pointsNum?: number;
  /** 0–3：original warp / bezier / mesh(3×3) / enhanced bezier，默认 2 */
  gradientTypeIndex?: number;
  warpShapeIndex?: number;
  warpSize?: number;
  /** 0 为关闭 warp */
  warpRatio?: number;
  time?: number;
}

export type Gradient = LinearGradient | RadialGradient | ConicGradient | MeshGradient;

export function isMeshGradientGradient(g: Gradient): g is MeshGradient {
  return g.type === 'mesh-gradient';
}

function meshGradientFillColorEquals(a: string, b: string): boolean {
  return a.replace(/\s/g, '').toLowerCase() === b.replace(/\s/g, '').toLowerCase();
}

/**
 * 与 `parseGradient` 在 `pointsNum` 缺省时的推断一致，供非 gtype(2) 的 mesh UBO 与 ecs 行为对齐。
 */
export function effectiveMeshGradientPointsNum(g: MeshGradient): number {
  if (g.pointsNum != null) {
    return Math.min(9, Math.max(1, g.pointsNum));
  }
  if (g.colors.length < 9) {
    return Math.max(1, g.colors.length);
  }
  const bg = g.backgroundColor;
  for (let i = 0; i < 9; i++) {
    const c = g.colors[i];
    if (c == null) {
      return Math.max(1, i);
    }
    if (meshGradientFillColorEquals(c, bg)) {
      return Math.max(1, i);
    }
  }
  return 9;
}

export function formatMeshGradientStringSuffix(
  g: Pick<
    MeshGradient,
    | 'gradientTypeIndex'
    | 'warpShapeIndex'
    | 'warpSize'
    | 'warpRatio'
    | 'pointsNum'
    | 'time'
  >,
): string {
  const parts: string[] = [];
  if (g.gradientTypeIndex != null && g.gradientTypeIndex !== 2) {
    parts.push(`gtype(${g.gradientTypeIndex})`);
  }
  if (g.warpShapeIndex != null && g.warpShapeIndex !== 0) {
    parts.push(`wshape(${g.warpShapeIndex})`);
  }
  const needWarp =
    (g.warpSize != null && g.warpSize !== 0.5) ||
    (g.warpRatio != null && g.warpRatio !== 0);
  if (needWarp) {
    const ws = g.warpSize ?? 0.5;
    const wr = g.warpRatio ?? 0;
    parts.push(`warp(${ws}, ${wr})`);
  }
  if (g.time != null && g.time !== 0) {
    parts.push(`time(${g.time})`);
  }
  if (g.pointsNum === 10) {
    parts.push('points(10)');
  }
  if (parts.length === 0) {
    return '';
  }
  return `, ${parts.join(', ')}`;
}

export function isGradient(colorStr: string) {
  return (
    isString(colorStr) &&
    (colorStr.indexOf('linear') > -1 ||
      colorStr.indexOf('radial') > -1 ||
      colorStr.indexOf('conic') > -1 ||
      colorStr.indexOf('mesh-gradient') > -1)
  );
}

export function parseGradient(colorStr: string): Gradient[] | undefined {
  if (!colorStr || !isGradient(colorStr)) {
    return undefined;
  }
  const ast = parseGradientAST(colorStr);
  return ast
    .map((node): Gradient | undefined => {
      if (node.type === 'mesh-gradient') {
        const backgroundColor = colorStopToString(node.background);
        const def = DEFAULT_MESH_GRADIENT_CORNER_POSITIONS;
        const colors: string[] = [];
        const positions: [number, number][] = [];
        for (let i = 0; i < 9; i++) {
          const cc = node.corners[i];
          if (cc) {
            colors.push(colorStopToString(cc.color));
            positions[i] = cc.uv
              ? [cc.uv[0], cc.uv[1]]
              : [def[i]![0], def[i]![1]];
          } else {
            colors.push(backgroundColor);
            positions[i] = [def[i]![0], def[i]![1]];
          }
        }
        positions[9] = [def[9]![0], def[9]![1]];
        const m: MeshGradient = {
          type: 'mesh-gradient',
          backgroundColor,
          colors,
          positions,
        };
        if (node.gradientTypeIndex != null) {
          m.gradientTypeIndex = node.gradientTypeIndex;
        }
        if (node.warpShapeIndex != null) {
          m.warpShapeIndex = node.warpShapeIndex;
        }
        if (node.warpSize != null) {
          m.warpSize = node.warpSize;
        }
        if (node.warpRatio != null) {
          m.warpRatio = node.warpRatio;
        }
        if (node.time != null) {
          m.time = node.time;
        }
        m.pointsNum =
          node.pointsNum != null
            ? node.pointsNum
            : Math.min(9, Math.max(1, node.corners.length));
        return m;
      }
      const { type, colorStops } = node;
      let { orientation } = node;

      spaceColorStops(colorStops);
      const steps = colorStops.map((colorStop) => {
        return {
          offset: {
            type: colorStop.length.type,
            value: Number(colorStop.length.value),
          },
          color: colorStopToString(colorStop),
        };
      });
      if (type === 'linear-gradient') {
        return {
          type,
          angle: orientation
            ? angleToDeg(orientation as DirectionalNode | AngularNode)
            : 0,
          steps,
        };
      } else if (type === 'radial-gradient') {
        if (!orientation) {
          orientation = [
            {
              type: 'shape',
              value: 'circle',
            },
          ];
        }
        if (
          orientation[0].type === 'shape' &&
          orientation[0].value === 'circle'
        ) {
          const { cx, cy } = positonToCSSUnitValue(orientation[0].at);
          let size: {
            value: number | string;
            type: string;
          };
          if (orientation[0].style) {
            const { type, value } = orientation[0].style;
            size = {
              value,
              type,
            };
          }
          return {
            type,
            cx,
            cy,
            size,
            steps,
          };
        }
        // TODO: support ellipse shape
      } else if (type === 'conic-gradient') {
        if (!orientation) {
          orientation = [
            {
              type: 'shape',
              value: 'circle',
            },
          ];
        }
        if (
          orientation[0].type === 'shape' &&
          orientation[0].value === 'circle'
        ) {
          const { cx, cy } = positonToCSSUnitValue(orientation[0].at);
          return {
            type,
            cx,
            cy,
            angle: orientation
              ? angleToDeg(orientation as DirectionalNode | AngularNode)
              : 0,
            steps,
          };
        }
        // } else if (type === 'repeating-linear-gradient') {
        //   console.log(node);
      }
      // TODO: repeating-radial-gradient

      return undefined;
    })
    .filter((g): g is Gradient => g != null);
}
