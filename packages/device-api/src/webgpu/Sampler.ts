import type { Sampler, SamplerDescriptor } from '../api';
import { MipmapFilterMode, ResourceType, FilterMode, assert } from '../api';
import {
  translateMinMagFilter,
  translateMipFilter,
  translateAddressMode,
  translateCompareFunction,
} from './utils';
import type { IDevice_WebGPU } from './interfaces';
import { ResourceBase_WebGPU } from './ResourceBase';

export class Sampler_WebGPU extends ResourceBase_WebGPU implements Sampler {
  type: ResourceType.Sampler = ResourceType.Sampler;

  // @see https://www.w3.org/TR/webgpu/#gpusampler
  gpuSampler: GPUSampler;

  constructor({
    id,
    device,
    descriptor,
  }: {
    id: number;
    device: IDevice_WebGPU;
    descriptor: SamplerDescriptor;
  }) {
    super({ id, device });

    const lodMinClamp = descriptor.lodMinClamp;
    const lodMaxClamp =
      descriptor.mipmapFilter === MipmapFilterMode.NO_MIP
        ? descriptor.lodMinClamp
        : descriptor.lodMaxClamp;

    const maxAnisotropy = descriptor.maxAnisotropy ?? 1;
    if (maxAnisotropy > 1)
      assert(
        descriptor.minFilter === FilterMode.BILINEAR &&
          descriptor.magFilter === FilterMode.BILINEAR &&
          descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
      );

    this.gpuSampler = this.device.device.createSampler({
      addressModeU: translateAddressMode(descriptor.addressModeU),
      addressModeV: translateAddressMode(descriptor.addressModeV),
      addressModeW: translateAddressMode(
        descriptor.addressModeW ?? descriptor.addressModeU,
      ),
      lodMinClamp,
      lodMaxClamp,
      minFilter: translateMinMagFilter(descriptor.minFilter),
      magFilter: translateMinMagFilter(descriptor.magFilter),
      mipmapFilter: translateMipFilter(descriptor.mipmapFilter),
      compare:
        descriptor.compareFunction !== undefined
          ? translateCompareFunction(descriptor.compareFunction)
          : undefined,
      maxAnisotropy,
    });
  }
}
