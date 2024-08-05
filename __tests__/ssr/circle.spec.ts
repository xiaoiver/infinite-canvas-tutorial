import _gl from 'gl';
import getPixels from 'get-pixels';
import { getCanvas } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

describe('Circle', () => {
  it('should render a simple circle correctly.', async () => {
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
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(dir, 'circle');

    canvas.destroy();
  });

  it('should render a circle with stroke correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      fill: 'black',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
    });
    canvas.appendChild(circle);
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-stroke',
    );

    canvas.destroy();
  });

  it('should render a circle with stroke alignment correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle1 = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'inner',
    });
    canvas.appendChild(circle1);

    const circle2 = new Circle({
      cx: 150,
      cy: 50,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'outer',
    });
    canvas.appendChild(circle2);

    const circle3 = new Circle({
      cx: 50,
      cy: 150,
      r: 50,
      fill: 'red',
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeAlignment: 'center',
    });
    canvas.appendChild(circle3);

    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-stroke-alignment',
    );

    canvas.destroy();
  });

  it('should render a circle with image correctly.', async () => {
    const $canvas = getCanvas(200, 200);

    // Load local image instead of fetching remote URL.
    // @see https://github.com/stackgl/headless-gl/pull/53/files#diff-55563b6c0b90b80aed19c83df1c51e80fd45d2fbdad6cc047ee86e98f65da3e9R83
    const src = await new Promise((resolve, reject) => {
      getPixels(__dirname + '/canvas.png', function (err, image) {
        if (err) {
          reject('Bad image path');
        } else {
          image.width = image.shape[0];
          image.height = image.shape[1];
          resolve(image);
        }
      });
    });

    const canvas = await new Canvas({
      canvas: $canvas,
    }).initialized;
    const circle = new Circle({
      cx: 100,
      cy: 100,
      r: 50,
      // @ts-expect-error
      fill: src,
      stroke: 'black',
      strokeOpacity: 0.5,
      strokeWidth: 20,
    });
    canvas.appendChild(circle);
    canvas.render();

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'circle-image',
    );

    canvas.destroy();
  });
});
