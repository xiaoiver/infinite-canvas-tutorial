import { isNil } from '@antv/util';
import type { Format } from '../format';
import type {
  AttachmentState,
  BindingsDescriptor,
  BufferBinding,
  ChannelBlendState,
  InputLayoutBufferDescriptor,
  InputLayoutDescriptor,
  MegaStateDescriptor,
  Program,
  RenderPipelineDescriptor,
  SamplerBinding,
  SamplerDescriptor,
  StencilFaceState,
  TextureBinding,
  VertexAttributeDescriptor,
} from '../interfaces';
import { colorEqual } from './color';
import { copyMegaState } from './states';

type EqualFunc<K> = (a: K, b: K) => boolean;
export function arrayEqual<T>(a: T[], b: T[], e: EqualFunc<T>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!e(a[i], b[i])) return false;
  return true;
}

type CopyFunc<T> = (a: T) => T;
export function arrayCopy<T>(a: T[], copyFunc: CopyFunc<T>): T[] {
  const b = Array(a.length);
  for (let i = 0; i < a.length; i++) b[i] = copyFunc(a[i]);
  return b;
}

function textureBindingEquals(
  a: Readonly<TextureBinding>,
  b: Readonly<TextureBinding>,
): boolean {
  return a.texture === b.texture && a.binding === b.binding;
}

function bufferBindingEquals(
  a: Readonly<BufferBinding>,
  b: Readonly<BufferBinding>,
): boolean {
  return (
    a.buffer === b.buffer &&
    a.size === b.size &&
    a.binding === b.binding &&
    a.offset === b.offset
  );
}

function samplerBindingEquals(
  a: Readonly<SamplerBinding | null>,
  b: Readonly<SamplerBinding | null>,
): boolean {
  if (a === null) return b === null;
  if (b === null) return false;
  return (
    a.sampler === b.sampler &&
    a.texture === b.texture &&
    a.dimension === b.dimension &&
    a.formatKind === b.formatKind &&
    a.comparison === b.comparison
  );
}

export function bindingsDescriptorEquals(
  a: BindingsDescriptor,
  b: BindingsDescriptor,
): boolean {
  a.samplerBindings = a.samplerBindings || [];
  a.uniformBufferBindings = a.uniformBufferBindings || [];
  a.storageBufferBindings = a.storageBufferBindings || [];
  a.storageTextureBindings = a.storageTextureBindings || [];
  b.samplerBindings = b.samplerBindings || [];
  b.uniformBufferBindings = b.uniformBufferBindings || [];
  b.storageBufferBindings = b.storageBufferBindings || [];
  b.storageTextureBindings = b.storageTextureBindings || [];

  if (a.pipeline !== b.pipeline) return false;
  if (a.samplerBindings.length !== b.samplerBindings.length) return false;
  if (!arrayEqual(a.samplerBindings, b.samplerBindings, samplerBindingEquals))
    return false;
  if (
    !arrayEqual(
      a.uniformBufferBindings,
      b.uniformBufferBindings,
      bufferBindingEquals,
    )
  )
    return false;
  if (
    !arrayEqual(
      a.storageBufferBindings,
      b.storageBufferBindings,
      bufferBindingEquals,
    )
  )
    return false;
  if (
    !arrayEqual(
      a.storageTextureBindings,
      b.storageTextureBindings,
      textureBindingEquals,
    )
  )
    return false;
  return true;
}

function channelBlendStateEquals(
  a: Readonly<ChannelBlendState>,
  b: Readonly<ChannelBlendState>,
): boolean {
  return (
    a.blendMode == b.blendMode &&
    a.blendSrcFactor === b.blendSrcFactor &&
    a.blendDstFactor === b.blendDstFactor
  );
}

function attachmentStateEquals(
  a: Readonly<AttachmentState>,
  b: Readonly<AttachmentState>,
): boolean {
  if (!channelBlendStateEquals(a.rgbBlendState, b.rgbBlendState)) return false;
  if (!channelBlendStateEquals(a.alphaBlendState, b.alphaBlendState))
    return false;
  if (a.channelWriteMask !== b.channelWriteMask) return false;
  return true;
}

export function stencilFaceStateEquals(
  a: Readonly<Partial<StencilFaceState>>,
  b: Readonly<Partial<StencilFaceState>>,
): boolean {
  return (
    a.compare == b.compare &&
    a.depthFailOp === b.depthFailOp &&
    a.failOp === b.failOp &&
    a.passOp === b.passOp &&
    a.mask === b.mask
  );
}

function megaStateDescriptorEquals(
  a: MegaStateDescriptor,
  b: MegaStateDescriptor,
): boolean {
  if (
    !arrayEqual(a.attachmentsState, b.attachmentsState, attachmentStateEquals)
  )
    return false;
  if (
    a.blendConstant &&
    b.blendConstant &&
    !colorEqual(a.blendConstant, b.blendConstant)
  )
    return false;

  if (
    a.stencilFront &&
    b.stencilFront &&
    !stencilFaceStateEquals(a.stencilFront, b.stencilFront)
  )
    return false;

  if (
    a.stencilBack &&
    b.stencilBack &&
    !stencilFaceStateEquals(a.stencilBack, b.stencilBack)
  )
    return false;

  return (
    a.depthCompare === b.depthCompare &&
    a.depthWrite === b.depthWrite &&
    a.stencilWrite === b.stencilWrite &&
    a.cullMode === b.cullMode &&
    a.frontFace === b.frontFace &&
    a.polygonOffset === b.polygonOffset &&
    a.polygonOffsetFactor === b.polygonOffsetFactor &&
    a.polygonOffsetUnits === b.polygonOffsetUnits
  );
}

function programEquals(a: Readonly<Program>, b: Readonly<Program>): boolean {
  return a.id === b.id;
}

function formatEquals(a: Format | null, b: Format | null): boolean {
  return a === b;
}

export function renderPipelineDescriptorEquals(
  a: Readonly<RenderPipelineDescriptor>,
  b: Readonly<RenderPipelineDescriptor>,
): boolean {
  if (a.topology !== b.topology) return false;
  if (a.inputLayout !== b.inputLayout) return false;
  if (a.sampleCount !== b.sampleCount) return false;
  if (
    a.megaStateDescriptor &&
    b.megaStateDescriptor &&
    !megaStateDescriptorEquals(a.megaStateDescriptor, b.megaStateDescriptor)
  )
    return false;
  if (!programEquals(a.program, b.program)) return false;
  if (
    !arrayEqual(
      a.colorAttachmentFormats,
      b.colorAttachmentFormats,
      formatEquals,
    )
  )
    return false;
  if (a.depthStencilAttachmentFormat !== b.depthStencilAttachmentFormat)
    return false;
  return true;
}

export function vertexAttributeDescriptorEquals(
  a: Readonly<VertexAttributeDescriptor>,
  b: Readonly<VertexAttributeDescriptor>,
): boolean {
  return (
    a.offset === b.offset &&
    a.shaderLocation === b.shaderLocation &&
    a.format === b.format &&
    a.divisor === b.divisor
  );
}

export function inputLayoutBufferDescriptorEquals(
  a: Readonly<InputLayoutBufferDescriptor | null>,
  b: Readonly<InputLayoutBufferDescriptor | null>,
): boolean {
  if (isNil(a)) return isNil(b);
  if (isNil(b)) return false;
  return (
    a.arrayStride === b.arrayStride &&
    a.stepMode === b.stepMode &&
    arrayEqual(a.attributes, b.attributes, vertexAttributeDescriptorEquals)
  );
}

export function inputLayoutDescriptorEquals(
  a: Readonly<InputLayoutDescriptor>,
  b: Readonly<InputLayoutDescriptor>,
): boolean {
  if (a.indexBufferFormat !== b.indexBufferFormat) return false;
  if (
    !arrayEqual(
      a.vertexBufferDescriptors,
      b.vertexBufferDescriptors,
      inputLayoutBufferDescriptorEquals,
    )
  )
    return false;
  if (!programEquals(a.program, b.program)) return false;
  return true;
}

export function samplerDescriptorEquals(
  a: Readonly<SamplerDescriptor>,
  b: Readonly<SamplerDescriptor>,
): boolean {
  return (
    a.addressModeU === b.addressModeU &&
    a.addressModeV === b.addressModeV &&
    a.minFilter === b.minFilter &&
    a.magFilter === b.magFilter &&
    a.mipmapFilter === b.mipmapFilter &&
    a.lodMinClamp === b.lodMinClamp &&
    a.lodMaxClamp === b.lodMaxClamp &&
    a.maxAnisotropy === b.maxAnisotropy &&
    a.compareFunction === b.compareFunction
  );
}

export function samplerBindingCopy(
  a: Readonly<SamplerBinding>,
): SamplerBinding {
  const sampler = a.sampler;
  const texture = a.texture;
  const dimension = a.dimension;
  const formatKind = a.formatKind;
  const comparison = a.comparison;
  return { sampler, texture, dimension, formatKind, comparison };
}

export function bufferBindingCopy(a: Readonly<BufferBinding>): BufferBinding {
  const buffer = a.buffer;
  const size = a.size;
  const binding = a.binding;
  const offset = a.offset;
  return { binding, buffer, offset, size };
}

export function textureBindingCopy(
  a: Readonly<TextureBinding>,
): TextureBinding {
  const binding = a.binding;
  const texture = a.texture;
  return { binding, texture };
}

export function bindingsDescriptorCopy(
  a: Readonly<BindingsDescriptor>,
): BindingsDescriptor {
  const samplerBindings =
    a.samplerBindings && arrayCopy(a.samplerBindings, samplerBindingCopy);
  const uniformBufferBindings =
    a.uniformBufferBindings &&
    arrayCopy(a.uniformBufferBindings, bufferBindingCopy);
  const storageBufferBindings =
    a.storageBufferBindings &&
    arrayCopy(a.storageBufferBindings, bufferBindingCopy);
  const storageTextureBindings =
    a.storageTextureBindings &&
    arrayCopy(a.storageTextureBindings, textureBindingCopy);
  return {
    samplerBindings,
    uniformBufferBindings,
    storageBufferBindings,
    storageTextureBindings,
    pipeline: a.pipeline,
  };
}

export function renderPipelineDescriptorCopy(
  a: Readonly<RenderPipelineDescriptor>,
): RenderPipelineDescriptor {
  const inputLayout = a.inputLayout;
  const program = a.program;
  const topology = a.topology;
  const megaStateDescriptor =
    a.megaStateDescriptor && copyMegaState(a.megaStateDescriptor);
  const colorAttachmentFormats = a.colorAttachmentFormats.slice();
  const depthStencilAttachmentFormat = a.depthStencilAttachmentFormat;
  const sampleCount = a.sampleCount;
  return {
    inputLayout,
    megaStateDescriptor,
    program,
    topology,
    colorAttachmentFormats,
    depthStencilAttachmentFormat,
    sampleCount,
  };
}

export function vertexAttributeDescriptorCopy(
  a: Readonly<VertexAttributeDescriptor>,
): VertexAttributeDescriptor {
  const shaderLocation = a.shaderLocation;
  const format = a.format;
  const offset = a.offset;
  const divisor = a.divisor;
  return {
    shaderLocation,
    format,
    offset,
    divisor,
  };
}

export function inputLayoutBufferDescriptorCopy(
  a: Readonly<InputLayoutBufferDescriptor | null>,
): InputLayoutBufferDescriptor | null {
  if (!isNil(a)) {
    const arrayStride = a.arrayStride;
    const stepMode = a.stepMode;
    const attributes = arrayCopy(a.attributes, vertexAttributeDescriptorCopy);
    return { arrayStride, stepMode, attributes };
  } else {
    return a;
  }
}

export function inputLayoutDescriptorCopy(
  a: Readonly<InputLayoutDescriptor>,
): InputLayoutDescriptor {
  const vertexBufferDescriptors = arrayCopy(
    a.vertexBufferDescriptors,
    inputLayoutBufferDescriptorCopy,
  );
  const indexBufferFormat = a.indexBufferFormat;
  const program = a.program;
  return {
    vertexBufferDescriptors,
    indexBufferFormat,
    program,
  };
}
