import { BitmapFont } from '../../packages/ecs/src/utils/bitmap-font/BitmapFont';
import { BitmapFontData } from '../../packages/ecs/src/utils/bitmap-font/bitmap-font-text-parser';

// Mock device for createTexture tests
const mockDevice = {
  createTexture: jest.fn(() => ({
    setImageData: jest.fn(),
    destroy: jest.fn(),
  })),
};

describe('BitmapFont', () => {
  const sampleData: BitmapFontData = {
    chars: {
      'A': {
        id: 65,
        x: 10,
        y: 10,
        width: 20,
        height: 22,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 20,
        page: 0,
        kerning: {},
      },
      'B': {
        id: 66,
        x: 40,
        y: 10,
        width: 18,
        height: 22,
        xOffset: 1,
        yOffset: 2,
        xAdvance: 19,
        page: 0,
        kerning: { 'A': -1 },
      },
    },
    pages: [
      { id: 0, file: 'page0.png' },
    ],
    lineHeight: 28,
    fontSize: 24,
    fontFamily: 'TestFont',
    distanceField: { type: 'sdf' as const, range: 4 },
    baseLineOffset: 6,
  };

  const mockImageBitmap = {
    width: 256,
    height: 256,
  } as ImageBitmap;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create BitmapFont with provided data', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      expect(font.fontFamily).toBe('TestFont');
      expect(font.lineHeight).toBe(28);
      expect(font.baseLineOffset).toBe(6);
    });

    it('should process characters', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      expect(Object.keys(font.chars)).toHaveLength(2);
      expect(font.chars['A']).toBeDefined();
      expect(font.chars['B']).toBeDefined();
    });

    it('should create CharData with correct properties', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      const charA = font.chars['A'];
      expect(charA.id).toBe(65);
      expect(charA.xOffset).toBe(0);
      expect(charA.yOffset).toBe(0);
      expect(charA.xAdvance).toBe(20);
      expect(charA.rect).toEqual({ x: 10, y: 10, w: 20, h: 22 });
      expect(charA.kerning).toEqual({});
    });

    it('should preserve kerning information', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      const charB = font.chars['B'];
      expect(charB.kerning).toEqual({ 'A': -1 });
    });

    it('should set font metrics', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      expect(font.fontMetrics.fontSize).toBe(24);
      expect(font.fontMetrics.ascent).toBe(0);
      expect(font.fontMetrics.descent).toBe(0);
    });

    it('should set distance field info', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      expect(font.distanceField).toEqual({ type: 'sdf', range: 4 });
    });

    it('should handle null distance field', () => {
      const dataWithoutDF = { ...sampleData, distanceField: undefined };
      const font = new BitmapFont({
        data: dataWithoutDF,
        images: [mockImageBitmap],
      });

      expect(font.distanceField).toEqual({ type: 'none', range: 0 });
    });
  });

  describe('createTexture', () => {
    it('should create textures from images', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      font.createTexture(mockDevice as any);

      expect(mockDevice.createTexture).toHaveBeenCalledTimes(1);
      expect(mockDevice.createTexture).toHaveBeenCalledWith({
        format: expect.any(Number),
        width: 256,
        height: 256,
        usage: expect.any(Number),
      });
    });

    it('should handle multiple pages', () => {
      const multiPageData: BitmapFontData = {
        ...sampleData,
        pages: [
          { id: 0, file: 'page0.png' },
          { id: 1, file: 'page1.png' },
        ],
        chars: {
          'A': { ...sampleData.chars['A'], page: 0 },
          'B': { ...sampleData.chars['B'], page: 1 },
        },
      };

      const font = new BitmapFont({
        data: multiPageData,
        images: [mockImageBitmap, mockImageBitmap],
      });

      font.createTexture(mockDevice as any);

      expect(mockDevice.createTexture).toHaveBeenCalledTimes(2);
      expect(font.pages).toHaveLength(2);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      font.createTexture(mockDevice as any);
      font.destroy();

      expect(font.chars).toBeNull();
    });

    it('should destroy textures when requested', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      font.createTexture(mockDevice as any);

      const mockTexture = font.pages[0].texture;
      font.destroy();

      expect(mockTexture.destroy).toHaveBeenCalled();
      expect(font.pages).toBeNull();
    });

    it('should emit destroy event', () => {
      const font = new BitmapFont({
        data: sampleData,
        images: [mockImageBitmap],
      });

      const destroyHandler = jest.fn();
      font.on('destroy', destroyHandler);

      font.destroy();

      expect(destroyHandler).toHaveBeenCalledWith(font);
    });
  });
});
