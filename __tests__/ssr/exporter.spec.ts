import _gl from 'gl';
import { NodeJSAdapter } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, ImageExporter, DOMAdapter } from '../../packages/core/src';
import { CheckboardStyle } from '../../packages/core/src/plugins';

DOMAdapter.set(NodeJSAdapter);

describe('Image Exporter', () => {
  it('should export empty canvas correctly.', async () => {
    const canvas = await new Canvas({
      canvas: DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement,
    }).initialized;

    const exporter = new ImageExporter({
      canvas,
      defaultFilename: 'test',
    });

    canvas.render();
    let dataURL = exporter.toSVGDataURL({ grid: false });
    expect(dataURL).toBe(
      'data:image/svg+xml;charset=utf8,%3C!DOCTYPE%20svg%20PUBLIC%20-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%20http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%3E%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20style%3D%22background-color%3A%20%23fbfbfb%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%3E%3Cg%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E',
    );
    exporter.downloadImage({ dataURL });

    // Lines grid
    dataURL = exporter.toSVGDataURL({ grid: true });
    expect(dataURL).toBe(
      'data:image/svg+xml;charset=utf8,%3C!DOCTYPE%20svg%20PUBLIC%20-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%20http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%3E%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20style%3D%22background-color%3A%20%23fbfbfb%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22small-grid%22%20width%3D%2210%22%20height%3D%2210%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cpath%20d%3D%22M%2010%200%20L%200%200%200%2010%22%20fill%3D%22none%22%20stroke%3D%22%23dedede%22%20stroke-width%3D%221%22%2F%3E%3C%2Fpattern%3E%3Cpattern%20id%3D%22grid%22%20width%3D%22100%22%20height%3D%22100%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22url(%23small-grid)%22%2F%3E%3Cpath%20d%3D%22M%20100%200%20L%200%200%200%20100%22%20fill%3D%22none%22%20stroke%3D%22%23dedede%22%20stroke-width%3D%222%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23grid)%22%2F%3E%3Cg%3E%3Cg%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E',
    );

    // Dots grid
    canvas.checkboardStyle = CheckboardStyle.DOTS;
    dataURL = exporter.toSVGDataURL({ grid: true });
    expect(dataURL).toBe(
      'data:image/svg+xml;charset=utf8,%3C!DOCTYPE%20svg%20PUBLIC%20-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%20http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%3E%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20style%3D%22background-color%3A%20%23fbfbfb%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Ccircle%20id%3D%22dot-tl%22%20cx%3D%220%22%20cy%3D%220%22%20r%3D%222%22%20fill%3D%22%23dedede%22%2F%3E%3Ccircle%20id%3D%22dot-tr%22%20cx%3D%2220%22%20cy%3D%220%22%20r%3D%222%22%20fill%3D%22%23dedede%22%2F%3E%3Ccircle%20id%3D%22dot-bl%22%20cx%3D%220%22%20cy%3D%2220%22%20r%3D%222%22%20fill%3D%22%23dedede%22%2F%3E%3Ccircle%20id%3D%22dot-br%22%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%222%22%20fill%3D%22%23dedede%22%2F%3E%3Cpattern%20id%3D%22dots-grid%22%20width%3D%2220%22%20height%3D%2220%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cuse%20xlink%3Ahref%3D%22%23dot-bl%22%2F%3E%3Cuse%20xlink%3Ahref%3D%22%23dot-br%22%2F%3E%3Cuse%20xlink%3Ahref%3D%22%23dot-tl%22%2F%3E%3Cuse%20xlink%3Ahref%3D%22%23dot-tr%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23dots-grid)%22%2F%3E%3Cg%3E%3Cg%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E',
    );

    // None grid
    canvas.checkboardStyle = CheckboardStyle.NONE;
    dataURL = exporter.toSVGDataURL({ grid: true });
    expect(dataURL).toBe(
      'data:image/svg+xml;charset=utf8,%3C!DOCTYPE%20svg%20PUBLIC%20-%2F%2FW3C%2F%2FDTD%20SVG%201.1%2F%2FEN%20http%3A%2F%2Fwww.w3.org%2FGraphics%2FSVG%2F1.1%2FDTD%2Fsvg11.dtd%3E%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20style%3D%22background-color%3A%20%23fbfbfb%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%3E%3Cg%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E',
    );

    canvas.destroy();
  });
});
