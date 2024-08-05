import _gl from 'gl';
import { createMouseEvent, getCanvas, sleep } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

describe('Events', () => {
  ['pointerDown', 'pointerUp', 'pointerMove'].forEach((type) => {
    it(`should listen to ${type} correctly.`, async () => {
      const $canvas = getCanvas(200, 200);
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

      const canvas = await new Canvas({
        canvas: $canvas,
        setCursor: () => {},
      }).initialized;
      const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
      });
      canvas.appendChild(circle);
      canvas.render();

      circle.addEventListener(type.toLowerCase(), () => {
        circle.fill = 'green';
        canvas.render();
      });

      canvas.pluginContext.hooks[type].call(
        createMouseEvent(type.toLowerCase(), { clientX: 100, clientY: 100 }),
      );

      await sleep(1000);

      const dir = `${__dirname}/snapshots`;

      expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        `events-${type.toLowerCase()}`,
      );

      canvas.destroy();
    });
  });
});
