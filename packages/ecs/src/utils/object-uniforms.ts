import type { Buffer } from '@infinite-canvas-tutorial/device-api';
import type { Mat3 } from '../components/math/Mat3';

/** One physical object UBO per drawcall. Every writer, including bake/layer passes,
 * must use this object so A -> B -> A transitions cannot reuse stale contents.
 * Legacy WebGL1 uniforms must still be applied on every draw (programs are shared).
 */
export class ObjectUniforms {
  private target: Buffer | undefined;
  private data = new Float32Array(0);
  private bytes = new Uint8Array(0);
  private dirty = true;
  readonly model = new Float32Array(9);

  update(target: Buffer, matrix: Readonly<Mat3>, values: ArrayLike<number>) {
    if (this.data.length !== 12 + values.length) {
      this.data = new Float32Array(12 + values.length);
      this.bytes = new Uint8Array(this.data.buffer);
      this.dirty = true;
    }
    this.set(0, matrix.m00);
    this.set(1, matrix.m01);
    this.set(2, matrix.m02);
    this.set(4, matrix.m10);
    this.set(5, matrix.m11);
    this.set(6, matrix.m12);
    this.set(8, matrix.m20);
    this.set(9, matrix.m21);
    this.set(10, matrix.m22);
    for (let i = 0; i < 9; i++)
      this.model[i] = this.data[i + Math.floor(i / 3)];
    for (let i = 0; i < values.length; i++) this.set(12 + i, values[i]);
    if (target !== this.target) this.dirty = true;
    if (this.dirty) {
      // Do not mark clean on failure: an equal retry must still write the buffer.
      target.setSubData(0, this.bytes);
      this.target = target;
      this.dirty = false;
    }
    return this.model;
  }

  private set(index: number, value: number) {
    const next = Math.fround(value);
    if (!Object.is(this.data[index], next)) {
      this.data[index] = next;
      this.dirty = true;
    }
  }

  clear() {
    this.target = undefined;
    this.data = new Float32Array(0);
    this.bytes = new Uint8Array(0);
    this.dirty = true;
  }
}
