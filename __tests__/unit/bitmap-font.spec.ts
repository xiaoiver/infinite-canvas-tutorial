import { Device, Format, TextureUsage } from '@antv/g-device-api';
import { bitmapFontJSONParser } from '../../packages/core/src/utils/bitmap-font/bitmap-font-json-parser';
import { bitmapFontTextParser } from '../../packages/core/src/utils/bitmap-font/bitmap-font-text-parser';
// import { bitmapFontXMLStringParser } from '../../packages/core/src/utils/bitmap-font/bitmap-font-xml-string-parser';
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

  it('should parse text correctly', () => {
    const rawFontString = `
info face="sans-serif" size=36 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=1,1,1,1 spacing=1,1
common lineHeight=36 base=27 scaleW=256 scaleH=256 pages=1 packed=0
page id=0 file="sans-serif.png"
chars count=2
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=12 page=0 chnl=15
char id=33 x=244 y=107 width=8 height=30 xoffset=4 yoffset=0 xadvance=15 page=0 chnl=15
`;
    const parsedText = bitmapFontTextParser.parse(rawFontString);
    expect(parsedText.chars['!']).toEqual({
      id: 33,
      page: 0,
      x: 244,
      y: 107,
      width: 8,
      height: 30,
      xOffset: 4,
      yOffset: 0,
      xAdvance: 15,
      kerning: {},
    });
  });

  //   it('should parse xml correctly', () => {
  //     const rawFontString = `<?xml version="1.0"?>
  // <font>
  //   <info face="ERAMv1_1" size="12" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="0,0" outline="0"/>
  //   <common lineHeight="12" base="11" scaleW="1010" scaleH="12" pages="1" packed="0" alphaChnl="0" redChnl="4" greenChnl="4" blueChnl="4"/>
  //   <pages>
  //     <page id="0" file="eram-text-1.png" />
  //   </pages>
  //   <chars count="75">
  //     <char id="32" x="0" y="0" width="10" height="12" xoffset="0" yoffset="0" xadvance="9" page="0" chnl="15" />
  //     <char id="33" x="10" y="0" width="10" height="12" xoffset="0" yoffset="0" xadvance="9" page="0" chnl="15" />
  //   </chars>
  // </font>`;
  //     const parsedText = bitmapFontXMLStringParser.parse(rawFontString);
  //     expect(parsedText.chars['!']).toEqual({
  //       id: 33,
  //       page: 0,
  //       x: 10,
  //       y: 0,
  //       width: 10,
  //       height: 12,
  //       xOffset: 0,
  //       yOffset: 0,
  //       xAdvance: 9,
  //       kerning: {},
  //     });
  //   });
});
