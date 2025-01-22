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
});
