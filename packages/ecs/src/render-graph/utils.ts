import type { Color } from '@infinite-canvas-tutorial/device-api';
import {
  Format,
  colorNewFromRGBA,
  OpaqueBlack,
  OpaqueWhite,
} from '@infinite-canvas-tutorial/device-api';
// import { reverseDepthForClearValue } from '../platform/utils';
import { RGAttachmentSlot } from './interface';
import { RGRenderTargetDescription } from './RenderTargetDescription';

export function makeAttachmentClearDescriptor(
  clearColor: Readonly<Color> | 'load',
): GfxrAttachmentClearDescriptor {
  return {
    colorClearColor: clearColor,
    // depthClearValue: reverseDepthForClearValue(1.0),
    depthClearValue: 1,
    stencilClearValue: 0.0,
  };
}

export const standardFullClearRenderPassDescriptor =
  makeAttachmentClearDescriptor(colorNewFromRGBA(0.88, 0.88, 0.88, 1.0));
export const opaqueBlackFullClearRenderPassDescriptor =
  makeAttachmentClearDescriptor(OpaqueBlack);
export const opaqueWhiteFullClearRenderPassDescriptor =
  makeAttachmentClearDescriptor(OpaqueWhite);

/**
 * Node layer-blend 离屏 src pass 专用：无 Grid 等 LEQUAL 预写，SDF/Mesh 首遍用
 * {@link CompareFunction.GREATER}，深度须清 0 而非主 pass 的 1，否则首遍深度测试全失败。
 */
export const layerBlendSrcDepthClearRenderPassDescriptor: GfxrAttachmentClearDescriptor =
  {
    colorClearColor: OpaqueWhite,
    depthClearValue: 0,
    stencilClearValue: 0,
  };

export enum AntialiasingMode {
  None,
  FXAA,
  MSAAx4,
}

export interface RenderInput {
  backbufferWidth: number;
  backbufferHeight: number;
  antialiasingMode: AntialiasingMode;
}

function selectFormatSimple(slot: RGAttachmentSlot): Format {
  if (slot === RGAttachmentSlot.Color0) {
    return Format.U8_RGBA_RT;
  }
  if (slot === RGAttachmentSlot.DepthStencil) {
    return Format.D24_S8;
  }
  throw new Error('whoops');
}

function selectSampleCount(renderInput: RenderInput): number {
  if (renderInput.antialiasingMode === AntialiasingMode.MSAAx4) {
    return 4;
  }
  return 1;
}

export function setBackbufferDescSimple(
  desc: RGRenderTargetDescription,
  renderInput: RenderInput,
): void {
  const sampleCount = selectSampleCount(renderInput);
  desc.setDimensions(
    renderInput.backbufferWidth,
    renderInput.backbufferHeight,
    sampleCount,
  );
}

export interface GfxrAttachmentClearDescriptor {
  colorClearColor: Readonly<Color> | 'load';
  depthClearValue: number;
  stencilClearValue: number;
}

export function makeBackbufferDescSimple(
  slot: RGAttachmentSlot,
  renderInput: RenderInput,
  clearDescriptor: GfxrAttachmentClearDescriptor,
): RGRenderTargetDescription {
  const pixelFormat = selectFormatSimple(slot);
  const desc = new RGRenderTargetDescription(pixelFormat);

  setBackbufferDescSimple(desc, renderInput);

  if (clearDescriptor !== null) {
    desc.colorClearColor = clearDescriptor.colorClearColor;
    desc.depthClearValue = clearDescriptor.depthClearValue;
    desc.stencilClearValue = clearDescriptor.stencilClearValue;
  }

  return desc;
}

/** Node layer blend 形状离屏 RT：须可在 composite pass 中采样。 */
export function makeLayerBlendSrcColorDesc(
  renderInput: RenderInput,
  clearDescriptor: GfxrAttachmentClearDescriptor,
): RGRenderTargetDescription {
  const desc = makeBackbufferDescSimple(
    RGAttachmentSlot.Color0,
    renderInput,
    clearDescriptor,
  );
  desc.sampledForShaderRead = true;
  return desc;
}
