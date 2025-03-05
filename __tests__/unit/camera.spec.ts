import { Camera, DOMAdapter } from '../../packages/core/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Camera', () => {
  it('should init and reprojection correctly.', () => {
    const camera = new Camera(100, 100);
    expect(camera.width).toBe(100);
    expect(camera.height).toBe(100);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.rotation).toBe(0);

    let projectionMatrix = [
      0.019999999552965164, 0, 0, 0, -0.019999999552965164, 0, -1, 1, 1,
    ];
    camera.projectionMatrix.forEach((item: number, i: number) => {
      expect(item).toBeCloseTo(projectionMatrix[i]);
    });

    camera.projection(200, 200);
    expect(camera.width).toBe(200);
    expect(camera.height).toBe(200);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.rotation).toBe(0);

    camera.x = 200;
    camera.y = 200;
    camera.zoom = 2;
    camera.rotation = 90;
    projectionMatrix = [
      0.009999999776482582, 0, 0, 0, -0.009999999776482582, 0, -1, 1, 1,
    ];
    camera.projectionMatrix.forEach((item: number, i: number) => {
      expect(item).toBeCloseTo(projectionMatrix[i]);
    });
  });

  it('should clone itself correctly.', () => {
    const camera = new Camera(100, 100);
    const cloned = camera.clone();
    expect(cloned.x).toBe(0);
    expect(cloned.y).toBe(0);
    expect(cloned.zoom).toBe(1);
    expect(cloned.rotation).toBe(0);
  });

  it('should create and goto Landmark correctly.', async () => {
    const camera = new Camera(100, 100);
    const landmark = camera.createLandmark({
      x: 0,
      y: 0,
      zoom: 2,
      rotation: 0,
    });
    expect(landmark).toEqual({
      x: 0,
      y: 0,
      zoom: 2,
      rotation: 0,
    });

    camera.gotoLandmark(landmark, {
      onfinish: () => {
        expect(landmark).toEqual({
          x: 0,
          y: 0,
          zoom: 2,
          rotation: 0,
        });
      },
    });

    await sleep(1000);

    // Ends immediately when duration === 0.
    camera.gotoLandmark({ zoom: 1 }, { duration: 0 });
    expect(camera.zoom).toBe(1);

    // Cancel animation.
    camera.gotoLandmark(
      {
        zoom: 2,
      },
      {
        onfinish: () => {
          expect(camera.zoom).toBe(2);
        },
      },
    );
    camera.cancelLandmarkAnimation();

    // Use viewportX and viewportY.
    camera.gotoLandmark({ viewportX: 50, viewportY: 50 }, { duration: 0 });
    expect(camera.zoom).toBe(1);

    // Easing
    camera.gotoLandmark(
      { zoom: 2 },
      {
        duration: 100,
        easing: 'ease',
        onframe: () => {
          expect(camera.zoom).toBeGreaterThan(1);
        },
      },
    );
    await sleep(1000);
  });

  it('should convert coordinates between canvas and viewport correctly.', () => {
    const camera = new Camera(100, 100);
    expect(camera.viewport2Canvas({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(camera.viewport2Canvas({ x: 0, y: 0 }, camera)).toEqual({
      x: 0,
      y: 0,
    });
    expect(camera.canvas2Viewport({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(camera.canvas2Viewport({ x: 0, y: 0 }, camera)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
