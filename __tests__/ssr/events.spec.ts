import _gl from 'gl';
import { createMouseEvent, getCanvas, sleep } from '../utils';
import '../useSnapshotMatchers';
import { Canvas, Circle } from '../../packages/core/src';

const dir = `${__dirname}/snapshots`;
let $canvas: HTMLCanvasElement;
let canvas: Canvas;

describe('Events', () => {
  beforeEach(async () => {
    $canvas = getCanvas(200, 200);
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
      setCursor: () => {},
    }).initialized;
  });

  afterEach(() => {
    canvas.destroy();
  });

  ['pointerDown', 'pointerUp', 'pointerMove'].forEach((type) => {
    it(`should listen to ${type} correctly.`, async () => {
      const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
      });
      canvas.appendChild(circle);
      canvas.render();

      // @ts-ignore
      circle.addEventListener(type.toLowerCase(), (e: MouseEvent) => {
        circle.fill = 'green';
        canvas.render();

        expect(e.type).toBe(type.toLowerCase());
        expect(e.bubbles).toBe(true);
        expect(e.cancelBubble).toBe(true);
        expect(e.cancelable).toBe(false);
        expect(e.composed).toBe(false);
        expect(e.layerX).toBe(0);
        expect(e.layerY).toBe(0);
        expect(e.pageX).toBe(0);
        expect(e.pageY).toBe(0);
        expect(e.clientX).toBe(100);
        expect(e.clientY).toBe(100);
        expect(e.x).toBe(100);
        expect(e.y).toBe(100);
        expect(e.movementX).toBe(0);
        expect(e.movementY).toBe(0);
        expect(e.offsetX).toBe(0);
        expect(e.offsetY).toBe(0);
        expect(e.screenX).toBe(100);
        expect(e.screenY).toBe(100);
        // @ts-ignore
        expect(e.globalX).toBe(100);
        // @ts-ignore
        expect(e.globalY).toBe(100);
        expect(e.composedPath()).toEqual([canvas.root, circle]);

        expect(e.initMouseEvent).toThrow();
        expect(e.getModifierState('test')).toBeFalsy();
        if (type === 'pointerMove') {
          expect((e as PointerEvent).getCoalescedEvents().length).toBe(1);
        } else {
          expect((e as PointerEvent).getCoalescedEvents().length).toBe(0);
        }
        expect((e as PointerEvent).getPredictedEvents).toThrow();
      });

      canvas.pluginContext.hooks[type].call(
        createMouseEvent(type.toLowerCase(), { clientX: 100, clientY: 100 }),
      );

      await sleep(1000);

      expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        `events-${type.toLowerCase()}`,
      );
    });
  });

  it('should register event listeners correctly.', async () => {
    canvas.destroy();
    globalThis.addEventListener = jest.fn();
    globalThis.removeEventListener = jest.fn();

    canvas = await new Canvas({
      canvas: $canvas,
      setCursor: () => {},
    }).initialized;
    canvas.destroy();

    globalThis.PointerEvent = jest.fn();
    canvas = await new Canvas({
      canvas: $canvas,
      setCursor: () => {},
    }).initialized;
    canvas.destroy();

    // @ts-ignore
    globalThis.PointerEvent = undefined;
    globalThis.ontouchstart = jest.fn();
    canvas = await new Canvas({
      canvas: $canvas,
      setCursor: () => {},
    }).initialized;
    delete globalThis.ontouchstart;
  });

  it('should register event listeners with options correctly.', async () => {
    const target = new Circle({ cx: 100, cy: 100, r: 50, fill: 'red' });
    canvas.appendChild(target);
    canvas.render();

    const handler = jest.fn();
    target.addEventListener('pointerdown', handler, { once: true });
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    expect(handler).toBeCalledTimes(1);
  });

  it('should stopPropagation correctly.', async () => {
    const parent = new Circle({ cx: 100, cy: 100, r: 50, fill: 'red' });
    const child = new Circle({ cx: 100, cy: 100, r: 25, fill: 'green' });
    parent.appendChild(child);
    canvas.appendChild(parent);
    canvas.render();

    const parentHandler = jest.fn();
    const childHandler = jest.fn();

    parent.addEventListener('pointerdown', parentHandler);
    child.addEventListener('pointerdown', childHandler);
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    expect(parentHandler).toBeCalled();
    expect(childHandler).toBeCalled();

    const parentHandler2 = jest.fn();
    const childHandler2 = jest.fn();
    parent.removeEventListener('pointerdown', parentHandler);
    child.removeEventListener('pointerdown', childHandler);
    parent.addEventListener('pointerdown', parentHandler2);
    child.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      childHandler2();
    });
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    expect(parentHandler2).not.toBeCalled();
    expect(childHandler2).toBeCalled();
  });

  it('should trigger dragstart / drag / dragend correctly.', async () => {
    const dragstartHandler = jest.fn();
    const dragHandler = jest.fn();
    const dragendHandler = jest.fn();

    canvas.root.addEventListener('dragstart', dragstartHandler);
    canvas.root.addEventListener('drag', dragHandler);
    canvas.root.addEventListener('dragend', dragendHandler);

    // dragstartTimeThreshold || dragstartDistanceThreshold
    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 105, clientY: 105 }),
    );
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 105, clientY: 105 }),
    );
    expect(dragstartHandler).not.toBeCalled();
    expect(dragHandler).not.toBeCalled();
    expect(dragendHandler).not.toBeCalled();

    canvas.pluginContext.hooks.pointerDown.call(
      createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
    );
    await sleep(100);
    canvas.pluginContext.hooks.pointerMove.call(
      createMouseEvent('pointermove', { clientX: 110, clientY: 105 }),
    );
    await sleep(100);
    canvas.pluginContext.hooks.pointerUp.call(
      createMouseEvent('pointerup', { clientX: 110, clientY: 110 }),
    );
    expect(dragstartHandler).toBeCalled();
    expect(dragHandler).toBeCalled();
    expect(dragendHandler).toBeCalled();
  });
});
