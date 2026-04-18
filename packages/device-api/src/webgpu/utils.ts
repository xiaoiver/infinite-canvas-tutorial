import { GPUTextureUsage } from './constants';
import {
  Buffer,
  Sampler,
  MegaStateDescriptor,
  AttachmentState,
  ChannelBlendState,
  QueryPool,
  SamplerBinding,
  StencilOp,
} from '../api';
import {
  BufferUsage,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TextureDimension,
  PrimitiveTopology,
  CullMode,
  FrontFace,
  BlendFactor,
  BlendMode,
  CompareFunction,
  VertexStepMode,
  TextureUsage,
  QueryPoolType,
  SamplerFormatKind,
  align,
  Format,
  FormatTypeFlags,
  getFormatByteSize,
  getFormatTypeFlags,
} from '../api';
import type { Buffer_WebGPU } from './Buffer';
import type { Sampler_WebGPU } from './Sampler';
import type { QueryPool_WebGPU } from './QueryPool';
import { isNil } from '@antv/util';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/GPUTexture/usage#value
 */
export function translateTextureUsage(
  usage: TextureUsage,
): GPUTextureUsageFlags {
  let gpuUsage: GPUTextureUsageFlags = 0;

  if (usage & TextureUsage.SAMPLED)
    gpuUsage |=
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC;
  if (usage & TextureUsage.STORAGE)
    gpuUsage |=
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST;
  if (usage & TextureUsage.RENDER_TARGET)
    gpuUsage |=
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST;

  return gpuUsage;
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gputextureformat
 */
export function translateTextureFormat(format: Format): GPUTextureFormat {
  // 8-bit formats
  if (format === Format.U8_R_NORM) return 'r8unorm';
  else if (format === Format.S8_R_NORM) return 'r8snorm';
  // 16-bit formats
  else if (format === Format.U8_RG_NORM) return 'rg8unorm';
  else if (format === Format.S8_RG_NORM) return 'rg8snorm';
  // 32-bit formats
  else if (format === Format.U32_R) return 'r32uint';
  else if (format === Format.S32_R) return 'r32sint';
  else if (format === Format.F32_R) return 'r32float';
  else if (format === Format.U16_RG) return 'rg16uint';
  else if (format === Format.S16_RG) return 'rg16sint';
  else if (format === Format.F16_RG) return 'rg16float';
  else if (format === Format.U8_RGBA_RT) return 'bgra8unorm';
  else if (format === Format.U8_RGBA_RT_SRGB) return 'bgra8unorm-srgb';
  else if (format === Format.U8_RGBA_NORM) return 'rgba8unorm';
  else if (format === Format.U8_RGBA_SRGB) return 'rgba8unorm-srgb';
  else if (format === Format.S8_RGBA_NORM) return 'rgba8snorm';
  // 64-bit formats
  else if (format === Format.U32_RG) return 'rg32uint';
  else if (format === Format.S32_RG) return 'rg32sint';
  else if (format === Format.F32_RG) return 'rg32float';
  else if (format === Format.U16_RGBA) return 'rgba16uint';
  else if (format === Format.S16_RGBA) return 'rgba16sint';
  else if (format === Format.F16_RGBA) return 'rgba16float';
  // 128-bit formats
  else if (format === Format.F32_RGBA) return 'rgba32float';
  else if (format === Format.U32_RGBA) return 'rgba32uint';
  else if (format === Format.S32_RGBA) return 'rgba32sint';
  // depth stencil formats
  else if (format === Format.D24) return 'depth24plus';
  else if (format === Format.D24_S8) return 'depth24plus-stencil8';
  else if (format === Format.D32F) return 'depth32float';
  else if (format === Format.D32F_S8) return 'depth32float-stencil8';
  // bc
  else if (format === Format.BC1) return 'bc1-rgba-unorm';
  else if (format === Format.BC1_SRGB) return 'bc1-rgba-unorm-srgb';
  else if (format === Format.BC2) return 'bc2-rgba-unorm';
  else if (format === Format.BC2_SRGB) return 'bc2-rgba-unorm-srgb';
  else if (format === Format.BC3) return 'bc3-rgba-unorm';
  else if (format === Format.BC3_SRGB) return 'bc3-rgba-unorm-srgb';
  else if (format === Format.BC4_SNORM) return 'bc4-r-snorm';
  else if (format === Format.BC4_UNORM) return 'bc4-r-unorm';
  else if (format === Format.BC5_SNORM) return 'bc5-rg-snorm';
  else if (format === Format.BC5_UNORM) return 'bc5-rg-unorm';
  else throw 'whoops';
}

export function translateTextureDimension(
  dimension: TextureDimension,
): GPUTextureDimension {
  if (dimension === TextureDimension.TEXTURE_2D) return '2d';
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP) return '2d';
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY) return '2d';
  else if (dimension === TextureDimension.TEXTURE_3D) return '3d';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gputextureviewdimension
 */
export function translateTextureViewDimension(
  dimension: TextureDimension,
): GPUTextureViewDimension {
  if (dimension === TextureDimension.TEXTURE_2D) return '2d';
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP) return 'cube';
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY) return '2d-array';
  else if (dimension === TextureDimension.TEXTURE_3D) return '3d';
  else throw new Error('whoops');
}

export function translateBufferUsage(usage_: BufferUsage): GPUBufferUsageFlags {
  let usage = 0;
  if (usage_ & BufferUsage.INDEX) usage |= GPUBufferUsage.INDEX;
  if (usage_ & BufferUsage.VERTEX) usage |= GPUBufferUsage.VERTEX;
  if (usage_ & BufferUsage.UNIFORM) usage |= GPUBufferUsage.UNIFORM;
  if (usage_ & BufferUsage.STORAGE) usage |= GPUBufferUsage.STORAGE;
  if (usage_ & BufferUsage.COPY_SRC) usage |= GPUBufferUsage.COPY_SRC;
  if (usage_ & BufferUsage.INDIRECT) usage |= GPUBufferUsage.INDIRECT;
  usage |= GPUBufferUsage.COPY_DST;
  return usage;
}

export function translateAddressMode(wrapMode: AddressMode): GPUAddressMode {
  if (wrapMode === AddressMode.CLAMP_TO_EDGE) return 'clamp-to-edge';
  else if (wrapMode === AddressMode.REPEAT) return 'repeat';
  else if (wrapMode === AddressMode.MIRRORED_REPEAT) return 'mirror-repeat';
  else throw new Error('whoops');
}

export function translateMinMagFilter(texFilter: FilterMode): GPUFilterMode {
  if (texFilter === FilterMode.BILINEAR) return 'linear';
  else if (texFilter === FilterMode.POINT) return 'nearest';
  else throw new Error('whoops');
}

// @see https://www.w3.org/TR/webgpu/#enumdef-gpumipmapfiltermode
export function translateMipFilter(
  mipmapFilter: MipmapFilterMode,
): GPUFilterMode {
  if (mipmapFilter === MipmapFilterMode.LINEAR) return 'linear';
  else if (mipmapFilter === MipmapFilterMode.NEAREST) return 'nearest';
  else if (mipmapFilter === MipmapFilterMode.NO_MIP) return 'nearest';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gputexturesampletype
 */
function translateSampleType(type: SamplerFormatKind): GPUTextureSampleType {
  if (type === SamplerFormatKind.Float) return 'float';
  else if (type === SamplerFormatKind.UnfilterableFloat)
    return 'unfilterable-float';
  else if (type === SamplerFormatKind.Depth) return 'depth';
  else if (type === SamplerFormatKind.Sint) return 'sint';
  else if (type === SamplerFormatKind.Uint) return 'uint';
  else throw new Error('whoops');
}

export function translateBindGroupSamplerBinding(
  sampler: SamplerBinding,
): GPUSamplerBindingLayout {
  if (sampler.formatKind === SamplerFormatKind.Depth && sampler.comparison) {
    return { type: 'comparison' };
  } else if (sampler.formatKind === SamplerFormatKind.Float) {
    return { type: 'filtering' };
  } else {
    return { type: 'non-filtering' };
  }
}

function translateViewDimension(
  dimension: TextureDimension,
): GPUTextureViewDimension {
  if (dimension === TextureDimension.TEXTURE_2D) return '2d';
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY) return '2d-array';
  else if (dimension === TextureDimension.TEXTURE_3D) return '3d';
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP) return 'cube';
  else throw new Error('whoops');
}

export function translateBindGroupTextureBinding(
  sampler: SamplerBinding,
): GPUTextureBindingLayout {
  return {
    sampleType: translateSampleType(sampler.formatKind),
    viewDimension: translateViewDimension(sampler.dimension),
  };
}

export function getPlatformBuffer(buffer_: Buffer): GPUBuffer {
  const buffer = buffer_ as Buffer_WebGPU;
  return buffer.gpuBuffer;
}

export function getPlatformSampler(sampler_: Sampler): GPUSampler {
  const sampler = sampler_ as Sampler_WebGPU;
  return sampler.gpuSampler;
}

export function getPlatformQuerySet(queryPool_: QueryPool): GPUQuerySet {
  const queryPool = queryPool_ as QueryPool_WebGPU;
  return queryPool.querySet;
}

export function translateQueryPoolType(type: QueryPoolType): GPUQueryType {
  if (type === QueryPoolType.OcclusionConservative) return 'occlusion';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#primitive-state
 */
export function translateTopology(
  topology: PrimitiveTopology,
): GPUPrimitiveTopology {
  switch (topology) {
    case PrimitiveTopology.TRIANGLES:
      return 'triangle-list';
    case PrimitiveTopology.POINTS:
      return 'point-list';
    case PrimitiveTopology.TRIANGLE_STRIP:
      return 'triangle-strip';
    case PrimitiveTopology.LINES:
      return 'line-list';
    case PrimitiveTopology.LINE_STRIP:
      return 'line-strip';
    default:
      throw new Error('Unknown primitive topology mode');
  }
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpucullmode
 */
export function translateCullMode(cullMode: CullMode): GPUCullMode {
  if (cullMode === CullMode.NONE) return 'none';
  else if (cullMode === CullMode.FRONT) return 'front';
  else if (cullMode === CullMode.BACK) return 'back';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpufrontface
 */
export function translateFrontFace(frontFaceMode: FrontFace): GPUFrontFace {
  if (frontFaceMode === FrontFace.CCW) return 'ccw';
  else if (frontFaceMode === FrontFace.CW) return 'cw';
  else throw new Error('whoops');
}

export function translatePrimitiveState(
  topology: PrimitiveTopology,
  megaStateDescriptor: MegaStateDescriptor,
): GPUPrimitiveState {
  return {
    topology: translateTopology(topology),
    cullMode: translateCullMode(megaStateDescriptor.cullMode),
    frontFace: translateFrontFace(megaStateDescriptor.frontFace),
  };
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpublendfactor
 */
export function translateBlendFactor(factor: BlendFactor): GPUBlendFactor {
  if (factor === BlendFactor.ZERO) return 'zero';
  else if (factor === BlendFactor.ONE) return 'one';
  else if (factor === BlendFactor.SRC) return 'src';
  else if (factor === BlendFactor.ONE_MINUS_SRC) return 'one-minus-src';
  else if (factor === BlendFactor.DST) return 'dst';
  else if (factor === BlendFactor.ONE_MINUS_DST) return 'one-minus-dst';
  else if (factor === BlendFactor.SRC_ALPHA) return 'src-alpha';
  else if (factor === BlendFactor.ONE_MINUS_SRC_ALPHA)
    return 'one-minus-src-alpha';
  else if (factor === BlendFactor.DST_ALPHA) return 'dst-alpha';
  else if (factor === BlendFactor.ONE_MINUS_DST_ALPHA)
    return 'one-minus-dst-alpha';
  else if (factor === BlendFactor.CONST) return 'constant';
  else if (factor === BlendFactor.ONE_MINUS_CONSTANT)
    return 'one-minus-constant';
  else if (factor === BlendFactor.SRC_ALPHA_SATURATE)
    return 'src-alpha-saturated';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpublendoperation
 */
export function translateBlendMode(mode: BlendMode): GPUBlendOperation {
  if (mode === BlendMode.ADD) return 'add';
  else if (mode === BlendMode.SUBSTRACT) return 'subtract';
  else if (mode === BlendMode.REVERSE_SUBSTRACT) return 'reverse-subtract';
  else if (mode === BlendMode.MIN) return 'min';
  else if (mode === BlendMode.MAX) return 'max';
  else throw new Error('whoops');
}

function translateBlendComponent(ch: ChannelBlendState): GPUBlendComponent {
  return {
    operation: translateBlendMode(ch.blendMode),
    srcFactor: translateBlendFactor(ch.blendSrcFactor),
    dstFactor: translateBlendFactor(ch.blendDstFactor),
  };
}

function blendComponentIsNil(ch: ChannelBlendState): boolean {
  return (
    ch.blendMode === BlendMode.ADD &&
    ch.blendSrcFactor === BlendFactor.ONE &&
    ch.blendDstFactor === BlendFactor.ZERO
  );
}

function translateBlendState(
  attachmentState: AttachmentState,
): GPUBlendState | undefined {
  if (
    blendComponentIsNil(attachmentState.rgbBlendState) &&
    blendComponentIsNil(attachmentState.alphaBlendState)
  ) {
    return undefined;
  } else {
    return {
      color: translateBlendComponent(attachmentState.rgbBlendState),
      alpha: translateBlendComponent(attachmentState.alphaBlendState),
    };
  }
}

export function translateColorState(
  attachmentState: AttachmentState,
  format: Format,
): GPUColorTargetState {
  return {
    format: translateTextureFormat(format),
    blend: translateBlendState(attachmentState),
    writeMask: attachmentState.channelWriteMask,
  };
}

export function translateTargets(
  colorAttachmentFormats: (Format | null)[],
  megaStateDescriptor: MegaStateDescriptor,
): GPUColorTargetState[] {
  return megaStateDescriptor.attachmentsState!.map((attachmentState, i) => {
    return translateColorState(attachmentState, colorAttachmentFormats[i]!);
  });
}

// @see https://www.w3.org/TR/webgpu/#enumdef-gpucomparefunction
export function translateCompareFunction(
  compareFunction: CompareFunction,
): GPUCompareFunction {
  if (compareFunction === CompareFunction.NEVER) return 'never';
  else if (compareFunction === CompareFunction.LESS) return 'less';
  else if (compareFunction === CompareFunction.EQUAL) return 'equal';
  else if (compareFunction === CompareFunction.LEQUAL) return 'less-equal';
  else if (compareFunction === CompareFunction.GREATER) return 'greater';
  else if (compareFunction === CompareFunction.NOTEQUAL) return 'not-equal';
  else if (compareFunction === CompareFunction.GEQUAL) return 'greater-equal';
  else if (compareFunction === CompareFunction.ALWAYS) return 'always';
  else throw new Error('whoops');
}

export function translateStencilOperation(
  stencilOp: StencilOp,
): GPUStencilOperation {
  if (stencilOp === StencilOp.KEEP) return 'keep';
  else if (stencilOp === StencilOp.REPLACE) return 'replace';
  else if (stencilOp === StencilOp.ZERO) return 'zero';
  else if (stencilOp === StencilOp.DECREMENT_CLAMP) return 'decrement-clamp';
  else if (stencilOp === StencilOp.DECREMENT_WRAP) return 'decrement-wrap';
  else if (stencilOp === StencilOp.INCREMENT_CLAMP) return 'increment-clamp';
  else if (stencilOp === StencilOp.INCREMENT_WRAP) return 'increment-wrap';
  else if (stencilOp === StencilOp.INVERT) return 'invert';
  else throw new Error('whoops');
}

/**
 * @see https://www.w3.org/TR/webgpu/#dictdef-gpudepthstencilstate
 */
export function translateDepthStencilState(
  format: Format | null,
  megaStateDescriptor: MegaStateDescriptor,
): GPUDepthStencilState | undefined {
  if (isNil(format)) return undefined;

  return {
    /**
     * @see https://www.w3.org/TR/webgpu/#dom-gpudepthstencilstate-format
     */
    format: translateTextureFormat(format),
    depthWriteEnabled: !!megaStateDescriptor.depthWrite,
    depthCompare: translateCompareFunction(megaStateDescriptor.depthCompare),
    depthBias: megaStateDescriptor.polygonOffset
      ? megaStateDescriptor.polygonOffsetUnits
      : 0,
    depthBiasSlopeScale: megaStateDescriptor.polygonOffset
      ? megaStateDescriptor.polygonOffsetFactor
      : 0,
    stencilFront: {
      compare: translateCompareFunction(
        megaStateDescriptor.stencilFront.compare,
      ),
      passOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.passOp,
      ),
      failOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.failOp,
      ),
      depthFailOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.depthFailOp,
      ),
    },
    stencilBack: {
      compare: translateCompareFunction(
        megaStateDescriptor.stencilBack.compare,
      ),
      passOp: translateStencilOperation(megaStateDescriptor.stencilBack.passOp),
      failOp: translateStencilOperation(megaStateDescriptor.stencilBack.failOp),
      depthFailOp: translateStencilOperation(
        megaStateDescriptor.stencilBack.depthFailOp,
      ),
    },
    stencilReadMask: 0xffffffff,
    stencilWriteMask: 0xffffffff,
    // stencilReadMask: 0xffffffff,
    // stencilWriteMask: megaStateDescriptor.stencilWrite ? 0xff : 0x00,
  };
}

export function translateIndexFormat(
  format: Format | null,
): GPUIndexFormat | undefined {
  if (format === null) return undefined;
  else if (format === Format.U16_R) return 'uint16';
  else if (format === Format.U32_R) return 'uint32';
  else throw new Error('whoops');
}

export function translateVertexStepMode(
  stepMode: VertexStepMode,
): GPUVertexStepMode {
  if (stepMode === VertexStepMode.VERTEX) return 'vertex';
  else if (stepMode === VertexStepMode.INSTANCE) return 'instance';
  else throw new Error('whoops');
}

export function translateVertexFormat(format: Format): GPUVertexFormat {
  if (format === Format.U8_R) return 'uint8x2';
  else if (format === Format.U8_RG) return 'uint8x2';
  else if (format === Format.U8_RGB) return 'uint8x4';
  else if (format === Format.U8_RGBA) return 'uint8x4';
  else if (format === Format.U8_RG_NORM) return 'unorm8x2';
  else if (format === Format.U8_RGBA_NORM) return 'unorm8x4';
  else if (format === Format.S8_RGB_NORM) return 'snorm8x4';
  else if (format === Format.S8_RGBA_NORM) return 'snorm8x4';
  else if (format === Format.U16_RG_NORM) return 'unorm16x2';
  else if (format === Format.U16_RGBA_NORM) return 'unorm16x4';
  else if (format === Format.S16_RG_NORM) return 'snorm16x2';
  else if (format === Format.S16_RGBA_NORM) return 'snorm16x4';
  else if (format === Format.S16_RG) return 'uint16x2';
  else if (format === Format.F16_RG) return 'float16x2';
  else if (format === Format.F16_RGBA) return 'float16x4';
  else if (format === Format.F32_R) return 'float32';
  else if (format === Format.F32_RG) return 'float32x2';
  else if (format === Format.F32_RGB) return 'float32x3';
  else if (format === Format.F32_RGBA) return 'float32x4';
  else throw 'whoops';
}

export function isFormatTextureCompressionBC(format: Format): boolean {
  const formatTypeFlags = getFormatTypeFlags(format);

  switch (formatTypeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC4_UNORM:
    case FormatTypeFlags.BC5_SNORM:
    case FormatTypeFlags.BC5_UNORM:
      return true;
    default:
      return false;
  }
}

export function getFormatByteSizePerBlock(format: Format): number {
  const formatTypeFlags = getFormatTypeFlags(format);

  switch (formatTypeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC4_UNORM:
      return 8;
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC5_SNORM:
    case FormatTypeFlags.BC5_UNORM:
      return 16;
    default:
      return getFormatByteSize(format);
  }
}

export function getFormatBlockSize(format: Format): number {
  const formatTypeFlags = getFormatTypeFlags(format);

  switch (formatTypeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC4_UNORM:
    case FormatTypeFlags.BC5_SNORM:
    case FormatTypeFlags.BC5_UNORM:
      return 4;
    default:
      return 1;
  }
}

export function translateImageLayout(
  layout: GPUImageDataLayout,
  format: Format,
  mipWidth: number,
  mipHeight: number,
): void {
  const blockSize = getFormatBlockSize(format);

  const numBlocksX = align(mipWidth, blockSize);
  const numBlocksY = align(mipHeight, blockSize);

  layout.bytesPerRow = numBlocksX * getFormatByteSizePerBlock(format);
  layout.rowsPerImage = numBlocksY;
}

export function allocateAndCopyTypedBuffer(
  type: Format,
  sizeOrDstBuffer: number | ArrayBuffer,
  sizeInBytes = false,
  copyBuffer?: ArrayBuffer,
): ArrayBufferView {
  switch (type) {
    case Format.S8_R:
    case Format.S8_R_NORM:
    case Format.S8_RG_NORM:
    case Format.S8_RGB_NORM:
    case Format.S8_RGBA_NORM: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int8Array(sizeOrDstBuffer)
          : new Int8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer.set(new Int8Array(copyBuffer));
      }
      return buffer;
    }
    case Format.U8_R:
    case Format.U8_R_NORM:
    case Format.U8_RG:
    case Format.U8_RG_NORM:
    case Format.U8_RGB:
    case Format.U8_RGB_NORM:
    case Format.U8_RGB_SRGB:
    case Format.U8_RGBA:
    case Format.U8_RGBA_NORM:
    case Format.U8_RGBA_SRGB: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint8Array(sizeOrDstBuffer)
          : new Uint8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer.set(new Uint8Array(copyBuffer));
      }
      return buffer;
    }
    case Format.S16_R:
    case Format.S16_RG:
    case Format.S16_RG_NORM:
    case Format.S16_RGB_NORM:
    case Format.S16_RGBA:
    case Format.S16_RGBA_NORM: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int16Array(sizeOrDstBuffer)
          : new Int16Array(sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer.set(new Int16Array(copyBuffer));
      }
      return buffer;
    }
    case Format.U16_R:
    case Format.U16_RGB:
    case Format.U16_RGBA_5551:
    case Format.U16_RGBA_NORM:
    case Format.U16_RG_NORM:
    case Format.U16_R_NORM: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint16Array(sizeOrDstBuffer)
          : new Uint16Array(
              sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer.set(new Uint16Array(copyBuffer));
      }
      return buffer;
    }
    case Format.S32_R: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int32Array(sizeOrDstBuffer)
          : new Int32Array(sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer.set(new Int32Array(copyBuffer));
      }
      return buffer;
    }
    case Format.U32_R:
    case Format.U32_RG: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint32Array(sizeOrDstBuffer)
          : new Uint32Array(
              sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer.set(new Uint32Array(copyBuffer));
      }
      return buffer;
    }
    case Format.F32_R:
    case Format.F32_RG:
    case Format.F32_RGB:
    case Format.F32_RGBA: {
      const buffer =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Float32Array(sizeOrDstBuffer)
          : new Float32Array(
              sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer.set(new Float32Array(copyBuffer));
      }
      return buffer;
    }
  }

  const buffer =
    sizeOrDstBuffer instanceof ArrayBuffer
      ? new Uint8Array(sizeOrDstBuffer)
      : new Uint8Array(sizeOrDstBuffer);
  if (copyBuffer) {
    buffer.set(new Uint8Array(copyBuffer));
  }
  return buffer;
}

/**
 * Converts a half float to a number
 * @param value half float to convert
 * @returns converted half float
 */
export function halfFloat2Number(value: number): number {
  const s = (value & 0x8000) >> 15;
  const e = (value & 0x7c00) >> 10;
  const f = value & 0x03ff;

  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  } else if (e == 0x1f) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }

  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

export function getBlockInformationFromFormat(format: GPUTextureFormat): {
  width: number;
  height: number;
  length: number;
} {
  switch (format) {
    // 8 bits formats
    case 'r8unorm':
    case 'r8snorm':
    case 'r8uint':
    case 'r8sint':
      return { width: 1, height: 1, length: 1 };

    // 16 bits formats
    case 'r16uint':
    case 'r16sint':
    case 'r16float':
    case 'rg8unorm':
    case 'rg8snorm':
    case 'rg8uint':
    case 'rg8sint':
      return { width: 1, height: 1, length: 2 };

    // 32 bits formats
    case 'r32uint':
    case 'r32sint':
    case 'r32float':
    case 'rg16uint':
    case 'rg16sint':
    case 'rg16float':
    case 'rgba8unorm':
    case 'rgba8unorm-srgb':
    case 'rgba8snorm':
    case 'rgba8uint':
    case 'rgba8sint':
    case 'bgra8unorm':
    case 'bgra8unorm-srgb':
    case 'rgb9e5ufloat':
    case 'rgb10a2unorm':
    case 'rg11b10ufloat':
      return { width: 1, height: 1, length: 4 };
    // 64 bits formats
    case 'rg32uint':
    case 'rg32sint':
    case 'rg32float':
    case 'rgba16uint':
    case 'rgba16sint':
    case 'rgba16float':
      return { width: 1, height: 1, length: 8 };

    // 128 bits formats
    case 'rgba32uint':
    case 'rgba32sint':
    case 'rgba32float':
      return { width: 1, height: 1, length: 16 };
    // Depth and stencil formats
    case 'stencil8':
      throw new Error('No fixed size for Stencil8 format!');
    case 'depth16unorm':
      return { width: 1, height: 1, length: 2 };
    case 'depth24plus':
      throw new Error('No fixed size for Depth24Plus format!');
    case 'depth24plus-stencil8':
      throw new Error('No fixed size for Depth24PlusStencil8 format!');
    case 'depth32float':
      return { width: 1, height: 1, length: 4 };
    // case 'depth24unorm-stencil8':
    //   return { width: 1, height: 1, length: 4 };
    case 'depth32float-stencil8':
      return { width: 1, height: 1, length: 5 };
    // BC compressed formats usable if "texture-compression-bc" is both
    // supported by the device/user agent and enabled in requestDevice.
    case 'bc7-rgba-unorm':
    case 'bc7-rgba-unorm-srgb':
    case 'bc6h-rgb-ufloat':
    case 'bc6h-rgb-float':
    case 'bc2-rgba-unorm':
    case 'bc2-rgba-unorm-srgb':
    case 'bc3-rgba-unorm':
    case 'bc3-rgba-unorm-srgb':
    case 'bc5-rg-unorm':
    case 'bc5-rg-snorm':
      return { width: 4, height: 4, length: 16 };

    case 'bc4-r-unorm':
    case 'bc4-r-snorm':
    case 'bc1-rgba-unorm':
    case 'bc1-rgba-unorm-srgb':
      return { width: 4, height: 4, length: 8 };
    default:
      return { width: 1, height: 1, length: 4 };
  }
}
