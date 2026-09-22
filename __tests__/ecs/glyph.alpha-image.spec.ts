import {
  RGBAImage,
  Size,
  Point,
} from '../../packages/ecs/src/utils/glyph/alpha-image';

describe('RGBAImage', () => {
  describe('constructor', () => {
    it('should create image with given size', () => {
      const size: Size = { width: 10, height: 20 };
      const image = new RGBAImage(size);
      expect(image.width).toBe(10);
      expect(image.height).toBe(20);
      expect(image.data).toHaveLength(10 * 20 * 4);
    });

    it('should initialize with zeros when no data provided', () => {
      const size: Size = { width: 2, height: 2 };
      const image = new RGBAImage(size);
      expect(image.data.every((v: number) => v === 0)).toBe(true);
    });

    it('should use provided data', () => {
      const size: Size = { width: 2, height: 2 };
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const image = new RGBAImage(size, data);
      expect(image.data).toBe(data);
      expect(image.data[0]).toBe(1);
      expect(image.data[15]).toBe(16);
    });

    it('should throw error for mismatched data size', () => {
      const size: Size = { width: 2, height: 2 };
      const data = new Uint8Array(8); // Wrong size - should be 16
      expect(() => new RGBAImage(size, data)).toThrow('mismatched image size');
    });
  });

  describe('copy', () => {
    it('should copy image data between images', () => {
      const srcSize: Size = { width: 2, height: 2 };
      const srcData = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
      const srcImg = new RGBAImage(srcSize, srcData);

      const dstSize: Size = { width: 4, height: 4 };
      const dstImg = new RGBAImage(dstSize);

      const srcPt: Point = { x: 0, y: 0 };
      const dstPt: Point = { x: 1, y: 1 };
      const copySize: Size = { width: 2, height: 2 };

      RGBAImage.copy(srcImg, dstImg, srcPt, dstPt, copySize);

      // Check that pixel at (0,0) in src is now at (1,1) in dst
      const dstOffset = (1 * 4 + 1) * 4;
      expect(dstImg.data[dstOffset]).toBe(255);
      expect(dstImg.data[dstOffset + 1]).toBe(0);
      expect(dstImg.data[dstOffset + 2]).toBe(0);
      expect(dstImg.data[dstOffset + 3]).toBe(255);
    });

    it('should handle partial copy', () => {
      const srcSize: Size = { width: 4, height: 4 };
      const srcData = new Uint8Array(4 * 4 * 4).fill(100);
      const srcImg = new RGBAImage(srcSize, srcData);

      const dstSize: Size = { width: 2, height: 2 };
      const dstImg = new RGBAImage(dstSize);

      RGBAImage.copy(srcImg, dstImg, { x: 1, y: 1 }, { x: 0, y: 0 }, { width: 2, height: 2 });

      expect(dstImg.data.every((v: number) => v === 100)).toBe(true);
    });

    it('should return destination image', () => {
      const srcImg = new RGBAImage({ width: 1, height: 1 }, new Uint8Array([0, 0, 0, 0]));
      const dstImg = new RGBAImage({ width: 1, height: 1 }, new Uint8Array([0, 0, 0, 0]));
      const result = RGBAImage.copy(srcImg, dstImg, { x: 0, y: 0 }, { x: 0, y: 0 }, { width: 1, height: 1 });
      expect(result).toBe(undefined);
    });

    it('should throw error for out of range source coordinates', () => {
      const srcImg = new RGBAImage({ width: 2, height: 2 });
      const dstImg = new RGBAImage({ width: 2, height: 2 });

      expect(() =>
        RGBAImage.copy(srcImg, dstImg, { x: 1, y: 1 }, { x: 0, y: 0 }, { width: 2, height: 2 }),
      ).toThrow('out of range source coordinates for image copy');
    });

    it('should throw error for out of range destination coordinates', () => {
      const srcImg = new RGBAImage({ width: 2, height: 2 });
      const dstImg = new RGBAImage({ width: 2, height: 2 });

      expect(() =>
        RGBAImage.copy(srcImg, dstImg, { x: 0, y: 0 }, { x: 1, y: 1 }, { width: 2, height: 2 }),
      ).toThrow('out of range destination coordinates for image copy');
    });

    it('should handle zero size copy gracefully', () => {
      const srcImg = new RGBAImage({ width: 2, height: 2 }, new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      const dstImg = new RGBAImage({ width: 2, height: 2 }, new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

      const result = RGBAImage.copy(srcImg, dstImg, { x: 0, y: 0 }, { x: 0, y: 0 }, { width: 0, height: 0 });
      expect(result).toBe(undefined);
    });
  });
});
