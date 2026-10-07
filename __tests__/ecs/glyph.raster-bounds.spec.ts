import { createCanvas, registerFont } from 'canvas';
import path from 'path';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import { TinySDF } from '../../packages/ecs/src/utils/glyph/tiny-sdf';

registerFont(
  path.resolve(
    __dirname,
    '../../packages/webcomponents/examples/Gaegu-Regular.ttf',
  ),
  { family: 'RasterGaegu' },
);
registerFont(
  path.resolve(
    __dirname,
    '../../packages/webcomponents/examples/NotoSans-Italic.ttf',
  ),
  { family: 'RasterItalic' },
);
const previousAdapter = DOMAdapter.get();
beforeAll(() =>
  DOMAdapter.set({
    ...previousAdapter,
    createCanvas: (w, h) => {
      const canvas = createCanvas(w!, h!);
      const ctx = canvas.getContext('2d');
      const measure = ctx.measureText.bind(ctx);
      // node-canvas 3.1 reports the signed x-bearing here. Browsers report a
      // distance to the left of the origin. Normalize this test adapter to
      // the Canvas contract; retain native pixels as the independent oracle.
      ctx.measureText = (text) => {
        const metrics = measure(text);
        return {
          ...metrics,
          actualBoundingBoxLeft: -metrics.actualBoundingBoxLeft,
        };
      };
      return canvas as unknown as HTMLCanvasElement;
    },
  }),
);
afterAll(() => DOMAdapter.set(previousAdapter));

function alphaSum(data: Uint8ClampedArray) {
  let sum = 0;
  for (let i = 3; i < data.length; i += 4) sum += data[i];
  return sum;
}

it.each(['RasterGaegu', 'RasterItalic'])(
  'captures all ink and keeps pen advance independent of bearing in %s',
  (fontFamily) => {
    const sdf = new TinySDF({ fontFamily, fontSize: 96, buffer: 12 });
    const reference = createCanvas(1000, 400).getContext('2d');
    reference.font = sdf.ctx.font;
    // Include a wide string to force scratch-canvas growth, then a small glyph
    // again to detect lost Canvas state or stale pixels after the resize.
    for (const char of ['j', 'f', 'WWWWWW', 'j']) {
      reference.clearRect(0, 0, 1000, 400);
      reference.fillText(char, 200, 200);
      const expected = alphaSum(reference.getImageData(0, 0, 1000, 400).data);
      const capture = jest.spyOn(sdf.ctx, 'getImageData');
      const result = sdf.draw(char);
      const sampled = capture.mock.results[0].value as ImageData;
      capture.mockRestore();
      // Cairo can round a few edge alpha values differently after translation.
      expect(
        Math.abs(alphaSum(sampled.data) - expected) / expected,
      ).toBeLessThan(0.001);
      expect(result.glyphAdvance).toBe(reference.measureText(char).width);
      if (char === 'j') expect(result.glyphLeft).toBeLessThan(0);
      expect(result.data.length).toBe(result.width * result.height * 4);
    }
  },
);

it('keeps whitespace advance without painted pixels', () => {
  const sdf = new TinySDF({ fontFamily: 'RasterGaegu', fontSize: 96 });
  const glyph = sdf.draw(' ');
  expect(glyph.glyphAdvance).toBeGreaterThan(0);
  expect(alphaSum(glyph.data as Uint8ClampedArray)).toBe(0);
});
