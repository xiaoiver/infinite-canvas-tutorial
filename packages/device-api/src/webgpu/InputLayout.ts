import type { InputLayout, InputLayoutDescriptor } from '../api';
import { ResourceType } from '../api';
import type { IDevice_WebGPU } from './interfaces';
import { ResourceBase_WebGPU } from './ResourceBase';
import {
  translateIndexFormat,
  translateVertexStepMode,
  translateVertexFormat,
} from './utils';

export class InputLayout_WebGPU
  extends ResourceBase_WebGPU
  implements InputLayout
{
  type: ResourceType.InputLayout = ResourceType.InputLayout;

  buffers: GPUVertexBufferLayout[];
  indexFormat: GPUIndexFormat | undefined;

  constructor({
    id,
    device,
    descriptor,
  }: {
    id: number;
    device: IDevice_WebGPU;
    descriptor: InputLayoutDescriptor;
  }) {
    super({ id, device });

    const buffers: GPUVertexBufferLayout[] = [];
    for (const vertexBufferDescriptor of descriptor.vertexBufferDescriptors) {
      const { arrayStride, stepMode, attributes } = vertexBufferDescriptor;
      buffers.push({
        arrayStride,
        stepMode: translateVertexStepMode(stepMode),
        attributes: [],
      });

      for (const attribute of attributes) {
        // TODO: divisor
        const { shaderLocation, format, offset } = attribute;
        (buffers[buffers.length - 1].attributes as GPUVertexAttribute[]).push({
          shaderLocation,
          format: translateVertexFormat(format),
          offset,
        });
      }
    }

    this.indexFormat = translateIndexFormat(descriptor.indexBufferFormat);
    this.buffers = buffers;
  }
}
