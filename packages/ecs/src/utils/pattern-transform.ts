/** Affine transform shared by canvas patterns and exported CSS paint layers. */
export interface PatternMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: PatternMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(left: PatternMatrix, right: PatternMatrix): PatternMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function angle(raw: string): number {
  const value = parseFloat(raw);
  return raw.endsWith('rad') ? value : (value * Math.PI) / 180;
}

/** Supports the 2D SVG/CSS matrix, translate, scale, rotate and skew functions. */
export function parsePatternTransform(
  value: string,
): PatternMatrix | undefined {
  if (!value.trim()) return { ...IDENTITY };
  const command = /([a-zA-Z]+)\(([^()]*)\)/g;
  let matrix = { ...IDENTITY };
  let end = 0;
  for (const match of value.matchAll(command)) {
    if (value.slice(end, match.index).trim()) return undefined;
    end = match.index! + match[0].length;
    const tokens = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (
      tokens.some(
        (token) =>
          !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px|deg|rad)?$/i.test(
            token,
          ),
      )
    )
      return undefined;
    const args = tokens.map(Number.parseFloat);
    if (!args.every(Number.isFinite)) return undefined;
    let next: PatternMatrix;
    switch (match[1].toLowerCase()) {
      case 'matrix':
        if (args.length !== 6) return undefined;
        next = {
          a: args[0],
          b: args[1],
          c: args[2],
          d: args[3],
          e: args[4],
          f: args[5],
        };
        break;
      case 'translate':
        if (args.length < 1 || args.length > 2) return undefined;
        next = { ...IDENTITY, e: args[0], f: args[1] ?? 0 };
        break;
      case 'scale':
        if (args.length < 1 || args.length > 2) return undefined;
        next = { ...IDENTITY, a: args[0], d: args[1] ?? args[0] };
        break;
      case 'rotate': {
        if (args.length !== 1 && args.length !== 3) return undefined;
        const radians = angle(tokens[0]);
        const rotation = {
          a: Math.cos(radians),
          b: Math.sin(radians),
          c: -Math.sin(radians),
          d: Math.cos(radians),
          e: 0,
          f: 0,
        };
        next =
          args.length === 3
            ? multiply(
                multiply({ ...IDENTITY, e: args[1], f: args[2] }, rotation),
                { ...IDENTITY, e: -args[1], f: -args[2] },
              )
            : rotation;
        break;
      }
      case 'skewx':
        if (args.length !== 1) return undefined;
        next = { ...IDENTITY, c: Math.tan(angle(tokens[0])) };
        break;
      case 'skewy':
        if (args.length !== 1) return undefined;
        next = { ...IDENTITY, b: Math.tan(angle(tokens[0])) };
        break;
      default:
        return undefined;
    }
    matrix = multiply(matrix, next);
  }
  if (value.slice(end).trim()) return undefined;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  return Math.abs(determinant) > 1e-9 ? matrix : undefined;
}

/** Size a transformed tiled surface so it covers the untransformed shape. */
export function patternOverlayLayout(
  matrix: PatternMatrix,
  width: number,
  height: number,
) {
  const precise = (value: number) => Number(value.toFixed(6));
  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  const inverse = (x: number, y: number) => {
    const tx = x - matrix.e;
    const ty = y - matrix.f;
    return {
      x: (matrix.d * tx - matrix.c * ty) / det,
      y: (-matrix.b * tx + matrix.a * ty) / det,
    };
  };
  const corners = [
    inverse(0, 0),
    inverse(width, 0),
    inverse(width, height),
    inverse(0, height),
  ];
  const left = Math.min(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const right = Math.max(...corners.map((point) => point.x));
  const bottom = Math.max(...corners.map((point) => point.y));
  const transform = {
    ...matrix,
    e: matrix.e + matrix.a * left + matrix.c * top - left,
    f: matrix.f + matrix.b * left + matrix.d * top - top,
  };
  return {
    left: precise(left),
    top: precise(top),
    width: precise(right - left),
    height: precise(bottom - top),
    backgroundPosition: `${precise(-left)}px ${precise(-top)}px`,
    transform: `matrix(${[
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    ]
      .map(precise)
      .join(', ')})`,
  };
}
