import type {
  Format,
  TextureDimension,
  TextureUsage,
  RenderTarget,
  Device,
} from '../api';

export interface TextureSharedDescriptor {
  dimension: TextureDimension;
  format: Format;
  width: number;
  height: number;
  depthOrArrayLayers: number;
  mipLevelCount: number;
  sampleCount: number;
  usage: TextureUsage;
}

export interface TextureShared_WebGPU {
  gpuTextureformat: GPUTextureFormat;
  dimension: TextureDimension;
  format: Format;
  width: number;
  height: number;
  depthOrArrayLayers: number;
  mipLevelCount: number;
  sampleCount: number;
  usage: GPUTextureUsageFlags;
  gpuTexture: GPUTexture;
  gpuTextureView: GPUTextureView;
}

export interface Attachment_WebGPU extends TextureShared_WebGPU, RenderTarget {}

export interface BindGroupLayout {
  gpuBindGroupLayout: GPUBindGroupLayout[];
}

export interface IDevice_WebGPU extends Device {
  device: GPUDevice;
  createTextureShared: (
    descriptor: TextureSharedDescriptor,
    texture: TextureShared_WebGPU,
    skipCreate: boolean,
  ) => void;
}
