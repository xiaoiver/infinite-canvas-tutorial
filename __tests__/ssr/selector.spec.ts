import _gl from 'gl';
import { createMouseEvent, NodeJSAdapter, sleep } from '../utils';
import '../useSnapshotMatchers';
import {
  Canvas,
  CanvasMode,
  Circle,
  DOMAdapter,
  ImageExporter,
  Theme,
} from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;
let exporter: ImageExporter;

DOMAdapter.set(NodeJSAdapter);

describe('Selector', () => {
  beforeEach(async () => {
    $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;
    $canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 200,
      height: 200,
      bottom: 200,
      right: 200,
      toJSON: () => {},
    });
    canvas = await new Canvas({
      canvas: $canvas,
      mode: CanvasMode.SELECT,
    }).initialized;
    exporter = new ImageExporter({
      canvas,
    });
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('should select a single shape with click correctly.', async () => {
    const target = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'red',
    });
    canvas.appendChild(target);
    canvas.render();

    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 100, clientY: 100 }),
    );

    canvas.render();

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'selector-single-selectable-ui',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'selector-single-selectable-ui',
    );
  });

  it('should display selection brush correctly.', async () => {
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 50, clientY: 50 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 150, clientY: 150 }),
    );
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 150, clientY: 150 }),
    );

    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'selector-selection-brush',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'selector-selection-brush',
    );
  });

  it('should display selection brush under dark theme correctly.', async () => {
    canvas.destroy();
    canvas = await new Canvas({
      canvas: $canvas,
      mode: CanvasMode.SELECT,
      theme: Theme.DARK,
    }).initialized;

    exporter = new ImageExporter({
      canvas,
    });

    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 50, clientY: 50 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 150, clientY: 150 }),
    );
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 150, clientY: 150 }),
    );

    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'selector-selection-brush-dark-theme',
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'selector-selection-brush-dark-theme',
    );
  });

  it('should display selection brush with custom style correctly.', async () => {
    canvas.destroy();
    canvas = await new Canvas({
      canvas: $canvas,
      mode: CanvasMode.SELECT,
      plugins: {
        selector: {
          selectionBrushStyle: {
            fill: 'grey',
            fillOpacity: 0.5,
            stroke: 'blue',
            strokeWidth: 10,
            strokeDasharray: [10, 10],
          },
        },
      },
    }).initialized;
    exporter = new ImageExporter({
      canvas,
    });

    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 50, clientY: 50 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 150, clientY: 150 }),
    );
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 150, clientY: 150 }),
    );

    canvas.render();
    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'selector-selection-brush-custom-style',
      {
        maxError: 1000,
      },
    );
    expect(exporter.toSVG({ grid: true })).toMatchSVGSnapshot(
      dir,
      'selector-selection-brush-custom-style',
    );
  });
});
