import { Device, Format, TextureUsage } from '@antv/g-device-api';
import { bitmapFontJSONParser } from '../../packages/core/src/utils/bitmap-font/bitmap-font-json-parser';
import { BitmapFont } from '../../packages/core/src/utils/bitmap-font';

describe('BitmapFont', () => {
  const mockFontData = {
    info: {
      face: 'Arial',
      size: 32,
    },
    common: {
      lineHeight: 36,
      base: 29,
    },
    pages: [{ id: 0, file: 'arial.png' }],
    chars: [
      {
        id: 65, // 'A'
        x: 0,
        y: 0,
        width: 24,
        height: 28,
        xoffset: 0,
        yoffset: 0,
        xadvance: 26,
        page: 0,
      },
      {
        id: 66, // 'B'
        x: 0,
        y: 0,
        width: 24,
        height: 28,
        xoffset: 0,
        yoffset: 0,
        xadvance: 26,
        page: 0,
      },
    ],
    kernings: [
      {
        first: 65,
        second: 66,
        amount: -2,
      },
    ],
  };

  // 模拟图片数据
  const mockImage = {
    width: 256,
    height: 256,
  } as ImageBitmap;

  // 模拟 Device
  const mockDevice = {
    createTexture: jest.fn().mockReturnValue({
      setImageData: jest.fn(),
      destroy: jest.fn(),
    }),
  } as unknown as Device;

  it('应该正确解析 JSON 格式的字体数据', () => {
    const jsonStr = JSON.stringify(mockFontData);
    const parsedData = bitmapFontJSONParser.parse(jsonStr);

    expect(parsedData.fontFamily).toBe('Arial');
    expect(parsedData.fontSize).toBe(32);
    expect(parsedData.lineHeight).toBe(36);
  });

  it('应该正确创建 BitmapFont 实例', () => {
    const font = new BitmapFont({
      data: bitmapFontJSONParser.parse(JSON.stringify(mockFontData)),
      images: [mockImage],
    });

    expect(font.fontFamily).toBe('Arial');
    expect(font.lineHeight).toBe(36);
    expect(font.chars['A']).toBeDefined();
  });

  it('应该正确创建纹理', () => {
    const font = new BitmapFont({
      data: bitmapFontJSONParser.parse(JSON.stringify(mockFontData)),
      images: [mockImage],
    });

    font.createTexture(mockDevice);

    expect(mockDevice.createTexture).toHaveBeenCalledWith({
      format: Format.U8_RGBA_NORM,
      width: mockImage.width,
      height: mockImage.height,
      usage: TextureUsage.SAMPLED,
    });
  });

  it('应该正确处理销毁', () => {
    const font = new BitmapFont({
      data: bitmapFontJSONParser.parse(JSON.stringify(mockFontData)),
      images: [mockImage],
    });

    font.createTexture(mockDevice);
    font.destroy();

    // 验证所有纹理都被销毁
    expect(font.pages).toBeNull();
    expect(font.chars?.['A']?.texture).toBeUndefined();
  });
});
