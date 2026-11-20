/** A CPU mirror of an already-initialized GPU instance buffer. */
export class InstanceBuffer {
  private pending = new Set<number>();
  constructor(
    private data: Float32Array | undefined,
    private target:
      | { setSubData(offset: number, data: Uint8Array): void }
      | undefined,
    private readonly stride: number,
  ) {}
  matches(data: Float32Array, target: unknown) {
    return this.data === data && this.target === target;
  }
  write(row: number, values: ArrayLike<number>) {
    if (!this.data) return;
    if (values.length !== this.stride)
      throw new RangeError('Invalid instance stride.');
    const start = row * this.stride;
    if (row < 0 || start + this.stride > this.data.length)
      throw new RangeError('Invalid instance row.');
    let changed = false;
    for (let i = 0; i < this.stride; i++) {
      const next = Math.fround(values[i]);
      if (!Object.is(this.data[start + i], next)) {
        this.data[start + i] = next;
        if (!changed) {
          this.pending.add(row);
          changed = true;
        }
      }
    }
  }
  set(row: number, column: number, value: number) {
    if (!this.data) return;
    const index = row * this.stride + column;
    if (
      row < 0 ||
      column < 0 ||
      column >= this.stride ||
      index >= this.data.length
    )
      throw new RangeError('Invalid instance element.');
    const next = Math.fround(value);
    if (!Object.is(this.data[index], next)) {
      this.data[index] = next;
      this.pending.add(row);
    }
  }
  flush(activeRows: number) {
    if (!this.data || !this.target || !this.pending.size) return;
    const rows = [...this.pending]
      .filter((row) => row < activeRows)
      .sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    for (let i = 0; i < rows.length; ) {
      const start = rows[i++];
      let end = start + 1;
      while (i < rows.length && rows[i] === end) {
        end++;
        i++;
      }
      ranges.push([start, end]);
      // Bound native calls for highly fragmented edits; the spanning upload
      // also contains clean rows whose CPU/GPU values already agree.
      if (ranges.length > 8) {
        ranges.splice(0, ranges.length, [rows[0], rows[rows.length - 1] + 1]);
        break;
      }
    }
    for (const [start, end] of ranges) {
      this.target.setSubData(
        start * this.stride * 4,
        new Uint8Array(
          this.data.buffer,
          this.data.byteOffset + start * this.stride * 4,
          (end - start) * this.stride * 4,
        ),
      );
      // Failed and inactive rows remain pending until a successful active upload.
      for (let row = start; row < end; row++) this.pending.delete(row);
    }
  }

  dispose() {
    this.pending.clear();
    this.data = undefined;
    this.target = undefined;
  }
}
