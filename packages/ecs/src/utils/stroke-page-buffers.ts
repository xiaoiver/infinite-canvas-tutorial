import {
  type Device,
  type Buffer,
  BufferUsage,
  BufferFrequencyHint,
} from '@antv/g-device-api';

interface Entry {
  index: Buffer;
  vertices: Buffer;
  references: number;
}
const pages = new WeakMap<Device, Entry>();

/** Immutable constants only; never share writable geometry or retain an idle pool. */
export function acquireStrokePageConstants(device: Device) {
  let entry = pages.get(device);
  if (!entry) {
    const vertices = device.createBuffer({
      viewOrSize: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    try {
      const index = device.createBuffer({
        viewOrSize: new Uint32Array([
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 4, 7, 8,
        ]),
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      entry = { index, vertices, references: 0 };
      pages.set(device, entry);
    } catch (error) {
      vertices.destroy();
      throw error;
    }
  }
  const owned = entry;
  owned.references++;
  let released = false;
  return {
    index: owned.index,
    vertices: owned.vertices,
    release() {
      if (released) return;
      released = true;
      if (--owned.references === 0) {
        pages.delete(device);
        owned.index.destroy();
        owned.vertices.destroy();
      }
    },
  };
}
