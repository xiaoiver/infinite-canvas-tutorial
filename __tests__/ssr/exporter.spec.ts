import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter } from '../../packages/core/src';

describe('Image Exporter', () => {
  it('should export empty canvas correctly.', async () => {
    const canvas = await new Canvas({
      canvas: getCanvas(200, 200),
    }).initialized;

    const exporter = new ImageExporter({ canvas, defaultFilename: 'test' });

    canvas.render();
    const url = exporter.toSVGDataURL();
    expect(url).toBe(
      'data:image/svg+xml;charset=utf8,%3C!DOCTYPE%20svg%20PUBLIC%20%22-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%22%20%22http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%22200%22%3E%3Cg%20visibility%3D%22hidden%22%20transform%3D%22matrix(1%2C0%2C0%2C1%2C0%2C0)%22%20transform-origin%3D%220%200%22%2F%3E%3C%2Fsvg%3E',
    );

    canvas.destroy();
  });
});
