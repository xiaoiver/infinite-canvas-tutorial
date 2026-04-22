import { vec2 } from 'gl-matrix';
import {
  isNumber,
  isObject,
  isBoolean,
  isFunction,
  isDataUrl,
  isUndefined,
  isNil,
  camelToKebabCase,
  kebabToCamelCase,
  Converter,
  pointToLine,
  bisect,
  parsePath,
  LineCurve,
  containsEmoji,
  isClockWise,
  parseGradientAST,
} from '../../packages/core/src/utils';
import {
  parseGradient,
  formatMeshGradientStringSuffix,
  effectiveMeshGradientPointsNum,
  type MeshGradient,
} from '../../packages/core/src/utils/gradient';

describe('Utils', () => {
  describe('Lang', () => {
    it('should check if a value isNumber correctly.', () => {
      expect(isNumber('2')).toBe(false);
      expect(isNumber(2)).toBe(true);
    });

    it('should check if a value isObject correctly.', () => {
      expect(isObject('2')).toBe(false);
      expect(isObject(2)).toBe(false);
      expect(isObject({})).toBe(true);
    });

    it('should check if a value isBoolean correctly.', () => {
      expect(isBoolean('2')).toBe(false);
      expect(isBoolean(2)).toBe(false);
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('should check if a value isFunction correctly.', () => {
      expect(isFunction('2')).toBe(false);
      expect(isFunction(() => {})).toBe(true);
    });

    it('should check if a value isNil correctly.', () => {
      expect(isNil('2')).toBe(false);
      expect(isNil(null)).toBe(true);
      expect(isNil(undefined)).toBe(true);
    });

    it('should check if a value isUndefined correctly.', () => {
      expect(isUndefined('2')).toBe(false);
      expect(isUndefined(null)).toBe(false);
      expect(isUndefined(undefined)).toBe(true);
    });

    it('should check if a value isDataUrl correctly.', () => {
      expect(isDataUrl('2')).toBe(false);
      expect(isDataUrl('')).toBe(false);
      expect(isDataUrl('data:image')).toBe(false);
      expect(
        isDataUrl(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
        ),
      ).toBe(true);
    });

    it('should convert camelToKebabCase correctly.', () => {
      expect(camelToKebabCase('fillOpacity')).toBe('fill-opacity');
      expect(camelToKebabCase('fill-opacity')).toBe('fill-opacity');
    });

    it('should convert kebabToCamelCase correctly.', () => {
      expect(kebabToCamelCase('fillOpacity')).toBe('fillOpacity');
      expect(kebabToCamelCase('fill-opacity')).toBe('fillOpacity');
    });
  });

  describe('Converter', () => {});

  describe('Math', () => {
    it('should calculate distance from point to line correctly.', () => {
      expect(pointToLine(0, 0, 100, 100, 50, 50)).toBe(0);
      expect(pointToLine(0, 0, 0, 0, 100, 0)).toBe(100);
    });

    it('should calculate bisect correctly.', () => {
      expect(bisect(vec2.fromValues(1, 0), vec2.fromValues(1, 0), 10)).toEqual(
        vec2.fromValues(10, 0),
      );

      expect(bisect(vec2.fromValues(1, 0), vec2.fromValues(0, 1), 10)).toEqual(
        vec2.fromValues(10, 10),
      );
    });
  });

  describe('Curve', () => {
    it('LineCurve', () => {
      const curve = new LineCurve(
        vec2.fromValues(0, 0),
        vec2.fromValues(120, 0),
      );
      expect(curve.getLength()).toBe(120);
      expect(curve.getPoint(0)).toEqual(vec2.fromValues(0, 0));
      expect(curve.getPoint(1)).toEqual(vec2.fromValues(120, 0));

      expect(curve.getPointAt(0)).toEqual(vec2.fromValues(0, 0));
      expect(curve.getPointAt(1)).toEqual(vec2.fromValues(120, 0));

      expect(curve.getPoints().length).toEqual(6);
      expect(curve.getPoints()[0]).toEqual(vec2.fromValues(0, 0));
      expect(curve.getPoints()[1]).toEqual(vec2.fromValues(24, 0));
      expect(curve.getPoints()[5]).toEqual(vec2.fromValues(120, 0));
    });
  });

  // describe('Parse Path', () => {
  //   it('should parse line correctly.', () => {
  //     const path = parsePath('M 100 100 L 100 100');
  //     expect(path.currentPath?.type).toEqual(LineCurve.TYPE);
  //     expect(path.subPaths.length).toEqual(1);
  //     // expect((path.subPaths[0].curves[0] as LineCurve).toEqual(1);
  //   });
  // });

  describe('Emoji', () => {
    it('should check if a value containsEmoji correctly.', () => {
      expect(containsEmoji('Hello, world!')).toBe(false);
      expect(containsEmoji('Hello, 😊!')).toBe(true);
    });
  });

  describe('isClockWise', () => {
    it('should check if a value isClockWise correctly.', () => {
      expect(
        isClockWise([
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ]),
      ).toBe(true);
      expect(
        isClockWise([
          [0, 0],
          [0, 100],
          [100, 100],
          [100, 0],
        ]),
      ).toBe(false);
    });
  });

  describe('Gradient parser', () => {
    it('should parse linear-gradient correctly', () => {
      let ast = parseGradientAST('linear-gradient(#e66465, #9198e5)');
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'hex', value: 'e66465' },
            { length: undefined, type: 'hex', value: '9198e5' },
          ],
          orientation: undefined,
          type: 'linear-gradient',
        },
      ]);

      // angular
      ast = parseGradientAST('linear-gradient(0deg, blue, green 40%, red)');
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'blue' },
            {
              length: { type: '%', value: '40' },
              type: 'literal',
              value: 'green',
            },
            { length: undefined, type: 'literal', value: 'red' },
          ],
          orientation: { type: 'angular', value: '0' },
          type: 'linear-gradient',
        },
      ]);

      // directional
      ast = parseGradientAST('linear-gradient(to right, blue, green 40%, red)');
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'blue' },
            {
              length: { type: '%', value: '40' },
              type: 'literal',
              value: 'green',
            },
            { length: undefined, type: 'literal', value: 'red' },
          ],
          orientation: { type: 'directional', value: 'right' },
          type: 'linear-gradient',
        },
      ]);

      // multiple gradients
      ast =
        parseGradientAST(`linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`);
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'rgba', value: ['255', '0', '0', '.8'] },
            {
              length: { type: '%', value: '70.71' },
              type: 'rgba',
              value: ['255', '0', '0', '0'],
            },
          ],
          orientation: { type: 'angular', value: '217' },
          type: 'linear-gradient',
        },
        {
          colorStops: [
            { length: undefined, type: 'rgba', value: ['0', '255', '0', '.8'] },
            {
              length: { type: '%', value: '70.71' },
              type: 'rgba',
              value: ['0', '255', '0', '0'],
            },
          ],
          orientation: { type: 'angular', value: '127' },
          type: 'linear-gradient',
        },
        {
          colorStops: [
            { length: undefined, type: 'rgba', value: ['0', '0', '255', '.8'] },
            {
              length: { type: '%', value: '70.71' },
              type: 'rgba',
              value: ['0', '0', '255', '0'],
            },
          ],
          orientation: { type: 'angular', value: '336' },
          type: 'linear-gradient',
        },
      ]);
    });

    it('should parse radial-gradient correctly', () => {
      let ast = parseGradientAST(
        'radial-gradient(circle at center, red, blue, green 100%)',
      );
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'red' },
            { length: undefined, type: 'literal', value: 'blue' },
            {
              length: { type: '%', value: '100' },
              type: 'literal',
              value: 'green',
            },
          ],
          orientation: [
            {
              at: {
                type: 'position',
                value: {
                  x: { type: 'position-keyword', value: 'center' },
                  y: undefined,
                },
              },
              style: undefined,
              type: 'shape',
              value: 'circle',
            },
          ],
          type: 'radial-gradient',
        },
      ]);

      ast = parseGradientAST('radial-gradient(red, blue, green)');
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'red' },
            { length: undefined, type: 'literal', value: 'blue' },
            { length: undefined, type: 'literal', value: 'green' },
          ],
          orientation: undefined,
          type: 'radial-gradient',
        },
      ]);

      // multiple radial gradients
      ast = parseGradientAST(
        'radial-gradient(red, blue, green), radial-gradient(red, blue, green)',
      );
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'red' },
            { length: undefined, type: 'literal', value: 'blue' },
            { length: undefined, type: 'literal', value: 'green' },
          ],
          orientation: undefined,
          type: 'radial-gradient',
        },
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'red' },
            { length: undefined, type: 'literal', value: 'blue' },
            { length: undefined, type: 'literal', value: 'green' },
          ],
          orientation: undefined,
          type: 'radial-gradient',
        },
      ]);
    });

    it('should parse conic-gradient correctly', () => {
      let ast = parseGradientAST('conic-gradient(red, blue, green)');
      expect(ast).toStrictEqual([
        {
          colorStops: [
            { length: undefined, type: 'literal', value: 'red' },
            { length: undefined, type: 'literal', value: 'blue' },
            { length: undefined, type: 'literal', value: 'green' },
          ],
          orientation: undefined,
          type: 'conic-gradient',
        },
      ]);
    });

    it('should parse mesh-gradient with optional U V after corner colors', () => {
      const ast = parseGradientAST(
        'mesh-gradient(#1a1a2e, #ff6b6b 0.6 0.15, #4ecdc4, #45b7d1)',
      );
      expect(ast[0]?.type).toBe('mesh-gradient');
      const mesh = ast[0] as {
        type: 'mesh-gradient';
        corners: { color: { type: string; value: string }; uv?: [number, number] }[];
      };
      expect(mesh.corners[0]?.uv).toEqual([0.6, 0.15]);
      expect(mesh.corners[1]?.uv).toBeUndefined();

      const g = parseGradient(
        'mesh-gradient(#1a1a2e, #ff6b6b 0.6 0.15, #4ecdc4, #45b7d1)',
      )![0] as MeshGradient;
      expect(g.positions?.[0]).toEqual([0.6, 0.15]);
    });

    it('should parse multi-corner mesh with U V (no 7-hex overconsume before numbers)', () => {
      const s =
        'mesh-gradient(#777000, #6ed02f 0.462 0.134, #b83248 0.41 0.489, #8555eb 0.722 0.889)';
      const g = parseGradient(s)![0] as MeshGradient;
      expect(g.colors[0]).toBe('#6ed02f');
      expect(g.positions?.[0]).toEqual([0.462, 0.134]);
      expect(g.positions?.[1]).toEqual([0.41, 0.489]);
      expect(g.positions?.[2]).toEqual([0.722, 0.889]);
    });

    it('should parse tail warp / gtype / wshape / time / points(10) in mesh-gradient', () => {
      const s =
        'mesh-gradient(#111, #f00, warp(0.3, 0.7), gtype(0), wshape(2), time(1.5), points(10))';
      const g = parseGradient(s)![0] as MeshGradient;
      expect(g.warpSize).toBe(0.3);
      expect(g.warpRatio).toBe(0.7);
      expect(g.gradientTypeIndex).toBe(0);
      expect(g.warpShapeIndex).toBe(2);
      expect(g.time).toBe(1.5);
      expect(g.pointsNum).toBe(10);
    });

    it('should infer pointsNum from number of written corner colors', () => {
      const a = parseGradient('mesh-gradient(#111, #222, #333)')![0] as MeshGradient;
      expect(a.pointsNum).toBe(2);
      const b = parseGradient(
        'mesh-gradient(#100, #200, #300, #400, #500)',
      )![0] as MeshGradient;
      expect(b.pointsNum).toBe(4);
    });

    it('effectiveMeshGradientPointsNum infers 1 when pointsNum stripped (gtype(0) single corner)', () => {
      const s =
        'mesh-gradient(#24145f, #50b4fd 0.28 0.26, warp(0.5, 0.8), gtype(0), wshape(0))';
      const g = parseGradient(s)![0] as MeshGradient;
      expect(g.pointsNum).toBe(1);
      const { pointsNum: _p, ...rest } = g;
      const stripped = { ...rest } as MeshGradient;
      expect(effectiveMeshGradientPointsNum(stripped)).toBe(1);
    });

    it('should set pointsNum to explicit corner count with tail extras (two corners + UV)', () => {
      const s =
        'mesh-gradient(#24145f, #50b4fd 0.68 0.26, #9436cc 0.669 0.175, warp(0.5, 0.8), gtype(0), wshape(0))';
      const g = parseGradient(s)![0] as MeshGradient;
      expect(g.pointsNum).toBe(2);
      expect(g.colors[0]).toBe('#50b4fd');
      expect(g.colors[1]).toBe('#9436cc');
      expect(g.colors[2]).toBe('#24145f');
      expect(g.positions![0]).toEqual([0.68, 0.26]);
      expect(g.positions![1]).toEqual([0.669, 0.175]);
    });

    it('formatMeshGradientStringSuffix should match tail tokens', () => {
      const suffix = formatMeshGradientStringSuffix({
        type: 'mesh-gradient',
        backgroundColor: '#000',
        colors: ['#f00', '#0f0', '#00f', '#0ff', '#f0f', '#ff0', '#888', '#999', '#aaa'],
        gradientTypeIndex: 1,
        warpShapeIndex: 0,
        warpSize: 0.4,
        warpRatio: 0.6,
        time: 0.25,
        pointsNum: 9,
      } as MeshGradient);
      expect(suffix).toContain('gtype(1)');
      expect(suffix).toContain('warp(0.4, 0.6)');
      expect(suffix).toContain('time(0.25)');
      expect(suffix).not.toContain('wshape(');
      expect(suffix).not.toContain('points(');
    });

    it('formatMeshGradientStringSuffix emits points(10) only for tenth logical point', () => {
      expect(
        formatMeshGradientStringSuffix({ type: 'mesh-gradient', backgroundColor: '#0', colors: [] } as MeshGradient),
      ).toBe('');
      const s = formatMeshGradientStringSuffix({ type: 'mesh-gradient', backgroundColor: '#0', colors: [], pointsNum: 2 } as MeshGradient);
      expect(s).toBe('');
      const s10 = formatMeshGradientStringSuffix({ type: 'mesh-gradient', backgroundColor: '#0', colors: [], pointsNum: 10 } as MeshGradient);
      expect(s10).toBe(', points(10)');
    });
  });
});
