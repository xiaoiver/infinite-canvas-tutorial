import { vec2 } from 'gl-matrix';
import {
  isNumber,
  isObject,
  isBoolean,
  isFunction,
  isDataUrl,
  isUndefined,
  isNil,
  isVideo,
  isImageBitmapOrCanvases,
  camelToKebabCase,
  kebabToCamelCase,
  Converter,
  pointToLine,
  bisect,
  parsePath,
  LineCurve,
  containsEmoji,
  isClockWise,
  parseGradient,
} from '../../packages/core/src/utils';

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

    it('should check if a value isVideo correctly.', () => {
      // @ts-expect-error
      expect(isVideo({})).toBe(false);
    });

    it('should check if a value isImageBitmapOrCanvases correctly.', () => {
      // @ts-expect-error
      expect(isImageBitmapOrCanvases({})).toBe(false);
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
      let ast = parseGradient('linear-gradient(#e66465, #9198e5)');
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
      ast = parseGradient('linear-gradient(0deg, blue, green 40%, red)');
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
      ast = parseGradient('linear-gradient(to right, blue, green 40%, red)');
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
        parseGradient(`linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
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
      let ast = parseGradient(
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

      ast = parseGradient('radial-gradient(red, blue, green)');
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
      ast = parseGradient(
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

    // it('should parse conic-gradient correctly', () => {
    //   let ast = parseGradient('conic-gradient(red 0deg, blue, green)');
    //   expect(ast).toBe(0);

    //   [
    //     {
    //       colorStops: [
    //         { length: undefined, type: 'literal', value: 'red' },
    //         { length: undefined, type: 'literal', value: 'blue' },
    //         { length: undefined, type: 'literal', value: 'green' },
    //       ],
    //       orientation: undefined,
    //       type: 'conic-gradient',
    //     },
    //   ];
    // });
  });
});
