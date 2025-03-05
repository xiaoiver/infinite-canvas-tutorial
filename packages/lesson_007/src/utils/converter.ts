// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Converter {
  export const _bytes4 = new Uint8Array(4);
  export const _float = new Float32Array(Converter._bytes4.buffer);
  export const _int = new Int32Array(Converter._bytes4.buffer);
  export const _bytes2 = new Uint8Array(2);
  export const _short = new Int16Array(Converter._bytes2.buffer);

  export function floatToInt(value: number) {
    _float[0] = value;
    return _int[0];
  }

  export function intToFloat(value: number) {
    _int[0] = value;
    return _float[0];
  }

  export function floatToBytes(value: number) {
    _float[0] = value;
    return _bytes4;
  }

  export function bytesToFloat(a: number, b: number, c: number, d: number) {
    _bytes4[0] = a;
    _bytes4[1] = b;
    _bytes4[2] = c;
    _bytes4[3] = d;
    return _float[0];
  }

  export function intToBytes(value: number) {
    _int[0] = value;
    return _bytes4;
  }

  export function bytesToInt(a: number, b: number, c: number, d: number) {
    _bytes4[0] = a;
    _bytes4[1] = b;
    _bytes4[2] = c;
    _bytes4[3] = d;
    return _int[0];
  }

  export function shortToBytes(value: number) {
    _short[0] = value;
    return _bytes2;
  }

  export function bytesToShort(a: number, b: number) {
    _bytes2[0] = a;
    _bytes2[1] = b;
    return _short[0];
  }
}

const INITIAL_CAPACITY = 256;

export class DataArray {
  private count = 0;
  private readOffset = 0;
  private capacity = INITIAL_CAPACITY;

  constructor(private _bytes = new Uint8Array(INITIAL_CAPACITY)) {
    this.count = this.capacity = _bytes.length;
  }

  clear() {
    this.count = 0;
    this.readOffset = 0;
  }

  byteCount() {
    return this.count;
  }

  bytes() {
    return this._bytes.subarray(0, this.count);
  }

  private grow() {
    this.capacity *= 2;
    const bytes = new Uint8Array(this.capacity);
    bytes.set(this._bytes);
    this._bytes = bytes;
  }

  hasMoreToRead() {
    return this.readOffset < this.count;
  }

  seekTo(count: number) {
    this.readOffset = count;
  }

  skipBytes(count: number) {
    this.readOffset += count;
  }

  appendBytes(bytes: Uint8Array): DataArray {
    const count = bytes.length;
    if (this.count + count > this.capacity) {
      this.grow();
    }

    this._bytes.set(bytes, this.count);
    this.count += count;
    return this;
  }

  byteAt(index: number) {
    return this._bytes[index];
  }

  appendByte(value: number): DataArray {
    if (this.count + 1 > this.capacity) {
      this.grow();
    }

    this._bytes[this.count] = value;
    this.count++;
    return this;
  }

  readByte() {
    const value = this.byteAt(this.readOffset);
    this.readOffset++;
    return value;
  }

  shortAt(index: number) {
    return Converter.bytesToShort(this._bytes[index], this._bytes[index + 1]);
  }

  appendShort(value: number) {
    this.appendBytes(Converter.shortToBytes(value));
    return this;
  }

  appendShorts(values: number[]) {
    for (const value of values) {
      this.appendShort(value);
    }
    return this;
  }

  readShort() {
    const value = this.shortAt(this.readOffset);
    this.readOffset += 2;
    return value;
  }

  intAt(index: number) {
    return Converter.bytesToInt(
      this._bytes[index],
      this._bytes[index + 1],
      this._bytes[index + 2],
      this._bytes[index + 3],
    );
  }

  appendInt(value: number) {
    this.appendBytes(Converter.intToBytes(value));
    return this;
  }

  appendInts(values: number[]) {
    for (const value of values) {
      this.appendInt(value);
    }
    return this;
  }

  readInt() {
    const value = this.intAt(this.readOffset);
    this.readOffset += 4;
    return value;
  }

  floatAt(index: number) {
    return Converter.bytesToFloat(
      this._bytes[index],
      this._bytes[index + 1],
      this._bytes[index + 2],
      this._bytes[index + 3],
    );
  }

  appendFloat(value: number) {
    this.appendBytes(Converter.floatToBytes(value));
    return this;
  }

  appendFloats(values: number[]) {
    for (const value of values) {
      this.appendFloat(value);
    }
    return this;
  }

  readFloat() {
    const value = this.floatAt(this.readOffset);
    this.readOffset += 4;
    return value;
  }

  isEmpty() {
    return this.count == 0;
  }
}
