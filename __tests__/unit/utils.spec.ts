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
});
