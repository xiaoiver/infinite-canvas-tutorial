import type {
  Color,
  ComputePass,
  QueryPool,
  RenderPass,
  RenderTarget,
  Texture,
} from '@antv/g-device-api';

export interface GfxRenderAttachmentView {
  level: number;
  z: number;
}

export enum GfxrAttachmentSlot {
  Color0 = 0,
  Color1 = 1,
  Color2 = 2,
  Color3 = 3,
  ColorMax = Color3,
  DepthStencil,
}

export interface GfxrAttachmentClearDescriptor {
  clearColor: Readonly<Color> | 'load';
  clearDepth: number | 'load';
  clearStencil: number | 'load';
}

export const noopClearDescriptor: GfxrAttachmentClearDescriptor = {
  clearColor: 'load',
  clearDepth: 'load',
  clearStencil: 'load',
};

export interface GfxrPassScope {
  /**
   * Retrieve the resolve texture resource for a given resolve texture ID. This is guaranteed to be
   * a single-sampled texture which can be bound to a shader's texture binding.
   *
   * @param id A resolve texture ID, as returned by {@see GfxrGraphBuilder::resolveRenderTarget},
   * {@see GfxrGraphBuilder::resolveRenderTargetPassAttachmentSlot}, or
   * {@see GfxrGraphBuilder::resolveRenderTargetToExternalTexture}.
   */
  getResolveTextureForID(id: number): Texture;

  /**
   * Retrieve the underlying texture resource for a given attachment slot {@param slot}. This is not
   * guaranteed to be a single-sampled texture; to resolve the resource, see {@see getResolveTextureForID}.
   */
  getRenderTargetTexture(slot: GfxrAttachmentSlot): Texture | null;
}

export type PassExecFunc = (
  passRenderer: RenderPass,
  scope: GfxrPassScope,
) => void;
export type ComputePassExecFunc = (
  pass: ComputePass,
  scope: GfxrPassScope,
) => void;
export type PassPostFunc = (scope: GfxrPassScope) => void;

declare const isRenderTargetID: unique symbol;
export type GfxrRenderTargetID = number & { [isRenderTargetID]: true };

declare const isResolveTextureID: unique symbol;
export type GfxrResolveTextureID = number & { [isResolveTextureID]: true };

interface GfxrPassBase {
  /**
   * Set the debug name of a given pass. Strongly encouraged.
   */
  setDebugName(debugName: string): void;

  /**
   * Attach the resolve texture ID to the given pass. All resolve textures used within the pass
   * must be attached before-hand in order for the scheduler to properly allocate our resolve texture.
   */
  attachResolveTexture(resolveTextureID: GfxrResolveTextureID): void;

  /**
   * Set the pass's post callback. This will be immediately right after the pass is submitted,
   * allowing you to do additional custom work once the pass has been done. This is expected to be
   * seldomly used.
   */
  post(func: PassPostFunc): void;

  addExtraRef(renderTargetID: GfxrAttachmentSlot): void;
}

export interface GfxrPass extends GfxrPassBase {
  /**
   * Set the viewport for the given render pass in *normalized* coordinates (0..1).
   * Not required; defaults to full viewport.
   */
  setViewport(x: number, y: number, w: number, h: number): void;

  /**
   * Attach the given render target with ID {@param renderTargetID} to the given attachment slot.
   *
   * This determines which render targets this pass will render to.
   */
  attachRenderTargetID(
    attachmentSlot: GfxrAttachmentSlot,
    renderTargetID: GfxrRenderTargetID,
    view?: GfxRenderAttachmentView,
  ): void;

  /**
   * Attach the given texture {@param texture} to the given attachment slot, with the given view.
   *
   * This will write directly to the given texture. Note that this completely bypasses the render target system;
   * and as such, resolve textures and other features will not exist here.
   */
  attachTexture(
    attachmentSlot: GfxrAttachmentSlot,
    texture: Texture,
    view?: GfxRenderAttachmentView,
    clearDescriptor?: GfxrAttachmentClearDescriptor,
  ): void;

  /**
   * Attach the occlusion query pool used by this rendering pass.
   */
  attachOcclusionQueryPool(queryPool: QueryPool): void;

  /**
   * Set the pass's execution callback. This will be called with the {@see GfxRenderPass} for the
   * pass, along with the {@see GfxrPassScope} to access any resources that the system has allocated.
   */
  exec(func: PassExecFunc): void;
}

export interface GfxrComputePass extends GfxrPassBase {
  /**
   * Set the pass's execution callback. This will be called with the {@see GfxRenderPass} for the
   * pass, along with the {@see GfxrPassScope} to access any resources that the system has allocated.
   */
  exec(func: ComputePassExecFunc): void;
}

export interface GfxRenderPassAttachment {
  renderTarget: RenderTarget;
  view: GfxRenderAttachmentView;
  resolveTo: Texture | null;
  resolveView: GfxRenderAttachmentView | null;
  store: boolean;
}

export interface GfxRenderPassAttachmentColor extends GfxRenderPassAttachment {
  clearColor: Color | 'load';
}

export interface GfxRenderPassAttachmentDepthStencil
  extends GfxRenderPassAttachment {
  clearDepth: number | 'load';
  clearStencil: number | 'load';
}
