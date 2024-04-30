import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import { Drawcall, SDF } from '../drawcalls';
import { Circle, type Shape } from '../shapes';

const SHAPE_DRAWCALL_CTORS = new WeakMap<typeof Shape, (typeof Drawcall)[]>();
SHAPE_DRAWCALL_CTORS.set(Circle, [SDF]);

export class BatchManager {
  /**
   * Drawcalls to flush in the next frame.
   */
  #drawcallsToFlush: Drawcall[] = [];

  /**
   * Cache drawcalls for each shape.
   */
  #nonBatchableDrawcallsCache: Record<number, Drawcall[]> = Object.create(null);

  #batchableDrawcallsCache = Object.create(null);

  constructor(private device: Device) {}

  private getOrCreateNonBatchableDrawcalls(shape: Shape) {
    let existed = this.#nonBatchableDrawcallsCache[shape.uid];
    if (!existed) {
      existed =
        SHAPE_DRAWCALL_CTORS.get(shape.constructor as typeof Shape)?.map(
          (DrawcallCtor) => {
            const drawcall = new DrawcallCtor(this.device);
            drawcall.shapes.push(shape);
            return drawcall;
          },
        ) || [];
      this.#nonBatchableDrawcallsCache[shape.uid] = existed;
    }

    return existed;
  }

  add(shape: Shape) {
    let drawcalls: Drawcall[] = [];

    if (shape.batchable) {
    } else {
      drawcalls = this.getOrCreateNonBatchableDrawcalls(shape);
    }

    this.#drawcallsToFlush.push(...drawcalls);

    // shape.getDrawcallCtors().forEach((DrawcallCtor, i) => {
    //   let existedDrawcall = this.#drawcalls.find(
    //     (drawcall) =>
    //       DrawcallCtor === drawcall.constructor &&
    //       // drawcall.index === i &&
    //       shape.instanced &&
    //       drawcall.shapes.length < drawcall.maxInstances &&
    //       drawcall.shouldMerge(shape, i),
    //   );

    //   if (!existedDrawcall) {
    //     existedDrawcall = new DrawcallCtor(this.device);
    //     // existedDrawcall.index = i;
    //     existedDrawcall.instanced = !!shape.instanced;
    //     this.#drawcalls.push(existedDrawcall);

    //     console.log('create draw call', existedDrawcall, shape);
    //   }

    //   existedDrawcall.shapes.push(shape);
    //   existedDrawcall.geometryDirty = true;
    // });
  }

  destroy() {
    for (const key in this.#nonBatchableDrawcallsCache) {
      this.#nonBatchableDrawcallsCache[key].forEach((drawcall) => {
        drawcall.destroy();
      });
    }
  }

  clear() {
    this.#drawcallsToFlush = [];
    // console.log('clear...');
    // this.#drawcalls.forEach((drawcall) => {
    //   drawcall.shapes = [];
    // });
  }

  flush(renderPass: RenderPass, uniformBuffer: Buffer) {
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.submit(renderPass, uniformBuffer);
    });
  }
}
