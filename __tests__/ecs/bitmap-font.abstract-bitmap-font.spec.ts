import { AbstractBitmapFont } from '../../packages/ecs/src/utils/bitmap-font/AbstractBitmapFont';

// Create a concrete implementation for testing
class TestBitmapFont extends AbstractBitmapFont<TestBitmapFont> {
  constructor() {
    super();
  }
}

describe('AbstractBitmapFont', () => {
  describe('constructor', () => {
    it('should create instance with default values', () => {
      const font = new TestBitmapFont();

      expect(font.chars).toEqual({});
      expect(font.lineHeight).toBe(0);
      expect(font.fontFamily).toBe('');
      expect(font.baseLineOffset).toBe(0);
      expect(font.pages).toEqual([]);
      expect(font.applyFillAsTint).toBe(true);
    });

    it('should have correct fontMetrics defaults', () => {
      const font = new TestBitmapFont();

      expect(font.fontMetrics).toEqual({
        fontSize: 0,
        ascent: 0,
        descent: 0,
      });
    });

    it('should have correct distanceField defaults', () => {
      const font = new TestBitmapFont();

      expect(font.distanceField).toEqual({
        type: 'none',
        range: 0,
      });
    });
  });

  describe('destroy', () => {
    it('should emit destroy event', () => {
      const font = new TestBitmapFont();
      const destroyHandler = jest.fn();

      font.on('destroy', destroyHandler);
      font.destroy();

      expect(destroyHandler).toHaveBeenCalledWith(font);
    });

    it('should remove all listeners', () => {
      const font = new TestBitmapFont();
      const handler = jest.fn();

      font.on('destroy', handler);
      font.destroy();

      // After destroy, emitting should not trigger handler
      font.emit('destroy', font);
      expect(handler).toHaveBeenCalledTimes(1); // Only called once during destroy()
    });

    it('should destroy character textures', () => {
      const font = new TestBitmapFont();
      const mockDestroy = jest.fn();

      font.chars['A'] = {
        id: 65,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 10,
        kerning: {},
        rect: { x: 0, y: 0, w: 10, h: 10 },
        texture: { destroy: mockDestroy } as any,
      };

      font.destroy();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should handle characters without texture', () => {
      const font = new TestBitmapFont();

      font.chars[' '] = {
        id: 32,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 5,
        kerning: {},
        rect: { x: 0, y: 0, w: 0, h: 0 },
        // no texture
      };

      // Should not throw
      expect(() => font.destroy()).not.toThrow();
    });

    it('should set chars to null', () => {
      const font = new TestBitmapFont();
      font.destroy();

      expect(font.chars).toBeNull();
    });

    it('should optionally destroy page textures', () => {
      const font = new TestBitmapFont();
      const mockDestroy = jest.fn();

      (font as any).pages = [
        { texture: { destroy: mockDestroy }, width: 256, height: 256 },
      ];

      font.destroy(true);

      expect(mockDestroy).toHaveBeenCalled();
      expect((font as any).pages).toBeNull();
    });

    it('should not destroy page textures by default', () => {
      const font = new TestBitmapFont();
      const mockDestroy = jest.fn();

      (font as any).pages = [
        { texture: { destroy: mockDestroy }, width: 256, height: 256 },
      ];

      font.destroy();

      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });

  describe('EventEmitter functionality', () => {
    it('should support on/once/off methods', () => {
      const font = new TestBitmapFont();
      const handler = jest.fn();

      font.on('destroy', handler);
      font.destroy();

      expect(handler).toHaveBeenCalled();
    });

    it('should support once', () => {
      const font = new TestBitmapFont();
      const handler = jest.fn();

      font.once('destroy', handler);
      font.destroy();
      font.emit('destroy', font);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support removeListener', () => {
      const font = new TestBitmapFont();
      const handler = jest.fn();

      font.on('destroy', handler);
      font.removeListener('destroy', handler);
      font.destroy();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
