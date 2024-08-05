import _gl from 'gl';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

describe('Camera', () => {
  it('should translate camera correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.camera.x += 50;
    canvas.camera.y += 50;
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'camera-translate',
    );

    canvas.destroy();
  });

  it('should zoom camera correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);
    canvas.camera.zoom = 2;
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'camera-zoom',
    );

    canvas.destroy();
  });

  it('should zoom camera with viewportX/Y correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
    });
    canvas.appendChild(circle);

    canvas.camera.gotoLandmark(
      {
        viewportX: 100,
        viewportY: 100,
        zoom: 0.5,
      },
      { duration: 0 },
    );
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'camera-zoom-viewport',
    );

    canvas.destroy();
  });
});
