import type { Buffer, Readback, Texture } from '../api';
import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  getFormatCompByteSize,
  ResourceType,
} from '../api';
import type { Buffer_WebGPU } from './Buffer';
import { GPUMapMode } from './constants';
import type { IDevice_WebGPU } from './interfaces';
import { ResourceBase_WebGPU } from './ResourceBase';
import type { Texture_WebGPU } from './Texture';
import {
  allocateAndCopyTypedBuffer,
  getBlockInformationFromFormat,
  halfFloat2Number,
} from './utils';

export class Readback_WebGPU extends ResourceBase_WebGPU implements Readback {
  type: ResourceType.Readback = ResourceType.Readback;

  constructor({ id, device }: { id: number; device: IDevice_WebGPU }) {
    super({ id, device });
  }

  async readTexture(
    t: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    dst: ArrayBufferView,
    dstOffset = 0,
    length = 0,
  ): Promise<ArrayBufferView> {
    const texture = t as Texture_WebGPU;

    // FIXME: default to 0 for now
    const faceIndex = 0;

    const blockInformation = getBlockInformationFromFormat(
      texture.gpuTextureformat,
    );

    const bytesPerRow =
      Math.ceil(width / blockInformation.width) * blockInformation.length;

    // bytesPerRow (4) is not a multiple of 256, so we need to align it to 256.
    const bytesPerRowAligned = Math.ceil(bytesPerRow / 256) * 256;

    const size = bytesPerRowAligned * height;

    const buffer = this.device.createBuffer({
      usage: BufferUsage.STORAGE | BufferUsage.MAP_READ | BufferUsage.COPY_DST,
      hint: BufferFrequencyHint.STATIC,
      viewOrSize: size,
    }) as Buffer_WebGPU;

    const commandEncoder = this.device.device.createCommandEncoder();

    // @see https://www.w3.org/TR/webgpu/#dom-gpucommandencoder-copytexturetobuffer
    commandEncoder.copyTextureToBuffer(
      {
        texture: texture.gpuTexture,
        mipLevel: 0,
        origin: {
          x,
          y,
          z: Math.max(faceIndex, 0),
        },
      },
      {
        buffer: buffer.gpuBuffer,
        offset: 0,
        bytesPerRow: bytesPerRowAligned,
      },
      {
        width,
        height,
        depthOrArrayLayers: 1,
      },
    );

    this.device.device.queue.submit([commandEncoder.finish()]);

    return this.readBuffer(
      buffer,
      0,
      dst.byteLength === size ? dst : null,
      dstOffset,
      size,
      texture.format,
      true,
      false,
      bytesPerRow,
      bytesPerRowAligned,
      height,
    );
  }

  readTextureSync(
    t: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    dst: ArrayBufferView,
    dstOffset = 0,
    length = 0,
  ): ArrayBufferView {
    throw new Error('ERROR_MSG_METHOD_NOT_IMPLEMENTED');
  }

  readBuffer(
    b: Buffer,
    srcByteOffset = 0,
    dstArrayBufferView: ArrayBufferView = null,
    dstOffset = 0,
    _size = 0,
    type: Format = Format.U8_RGB,
    noDataConversion = false,
    destroy = false,
    bytesPerRow = 0,
    bytesPerRowAligned = 0,
    height = 0,
  ): Promise<ArrayBufferView> {
    const buffer = b as Buffer_WebGPU;

    const size = _size || buffer.size;
    const dst = dstArrayBufferView || buffer.view;
    const floatFormat =
      // @ts-ignore
      (dst && dst.constructor && dst.constructor.BYTES_PER_ELEMENT) ||
      getFormatCompByteSize(type);

    let gpuReadBuffer: Buffer_WebGPU = buffer;

    // can read buffer directly?
    if (
      !(
        buffer.usage & BufferUsage.MAP_READ &&
        buffer.usage & BufferUsage.COPY_DST
      )
    ) {
      const commandEncoder = this.device.device.createCommandEncoder();

      gpuReadBuffer = this.device.createBuffer({
        usage:
          BufferUsage.STORAGE | BufferUsage.MAP_READ | BufferUsage.COPY_DST,
        hint: BufferFrequencyHint.STATIC,
        viewOrSize: size,
      }) as Buffer_WebGPU;

      // Encode commands for copying buffer to buffer.
      commandEncoder.copyBufferToBuffer(
        buffer.gpuBuffer /* source buffer */,
        srcByteOffset /* source offset */,
        gpuReadBuffer.gpuBuffer /* destination buffer */,
        0 /* destination offset */,
        size /* size */,
      );

      this.device.device.queue.submit([commandEncoder.finish()]);
    }

    return new Promise((resolve, reject) => {
      gpuReadBuffer.gpuBuffer
        .mapAsync(GPUMapMode.READ, srcByteOffset, size)
        .then(
          () => {
            const copyArrayBuffer = gpuReadBuffer.gpuBuffer.getMappedRange(
              srcByteOffset,
              size,
            );
            let data = dst;
            if (noDataConversion) {
              if (data === null) {
                data = allocateAndCopyTypedBuffer(
                  type,
                  size,
                  true,
                  copyArrayBuffer,
                );
              } else {
                data = allocateAndCopyTypedBuffer(
                  type,
                  data.buffer as ArrayBuffer,
                  undefined,
                  copyArrayBuffer,
                );
              }
            } else {
              if (data === null) {
                switch (floatFormat) {
                  case 1: // byte format
                    data = new Uint8Array(size);
                    (data as Uint8Array).set(new Uint8Array(copyArrayBuffer));
                    break;
                  case 2: // half float
                    // TODO WEBGPU use computer shaders (or render pass) to make the conversion?
                    data = this.getHalfFloatAsFloatRGBAArrayBuffer(
                      size / 2,
                      copyArrayBuffer,
                    );
                    break;
                  case 4: // float
                    data = new Float32Array(size / 4);
                    (data as Float32Array).set(
                      new Float32Array(copyArrayBuffer),
                    );
                    break;
                }
              } else {
                switch (floatFormat) {
                  case 1: // byte format
                    data = new Uint8Array(data.buffer);
                    (data as Uint8Array).set(new Uint8Array(copyArrayBuffer));
                    break;
                  case 2: // half float
                    // TODO WEBGPU use computer shaders (or render pass) to make the conversion?
                    data = this.getHalfFloatAsFloatRGBAArrayBuffer(
                      size / 2,
                      copyArrayBuffer,
                      dst as Float32Array,
                    );
                    break;
                  case 4: // float
                    const ctor = (dst && dst.constructor) || Float32Array;

                    // @ts-ignore
                    data = new ctor(data.buffer);
                    // @ts-ignore
                    (data as ctor).set(new ctor(copyArrayBuffer));
                    break;
                }
              }
            }
            if (bytesPerRow !== bytesPerRowAligned) {
              // TODO WEBGPU use computer shaders (or render pass) to build the final buffer data?
              if (floatFormat === 1 && !noDataConversion) {
                // half float have been converted to float above
                bytesPerRow *= 2;
                bytesPerRowAligned *= 2;
              }
              const data2 = new Uint8Array(data!.buffer);
              let offset = bytesPerRow,
                offset2 = 0;
              for (let y = 1; y < height; ++y) {
                offset2 = y * bytesPerRowAligned;
                for (let x = 0; x < bytesPerRow; ++x) {
                  data2[offset++] = data2[offset2++];
                }
              }
              if (floatFormat !== 0 && !noDataConversion) {
                data = new Float32Array(data2.buffer, 0, offset / 4);
              } else {
                data = new Uint8Array(data2.buffer, 0, offset);
              }
            }
            gpuReadBuffer.gpuBuffer.unmap();

            resolve(data!);
          },
          (reason) => reject(reason),
        );
    });
  }

  private getHalfFloatAsFloatRGBAArrayBuffer(
    dataLength: number,
    arrayBuffer: ArrayBuffer,
    destArray?: Float32Array,
  ): Float32Array {
    if (!destArray) {
      destArray = new Float32Array(dataLength);
    }
    const srcData = new Uint16Array(arrayBuffer);
    while (dataLength--) {
      destArray[dataLength] = halfFloat2Number(srcData[dataLength]);
    }

    return destArray;
  }
}
