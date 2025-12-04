/**
 * @see https://github.com/magcius/noclip.website/blob/main/src/gfx/render/GfxRenderGraph.ts
 */

import type { Color, Format } from '@antv/g-device-api';

export class GfxrRenderTargetDescription {
  public width: number = 0;
  public height: number = 0;
  public numLevels: number = 1;
  public sampleCount: number = 0;

  public clearColor: Readonly<Color> | 'load' = 'load';
  public clearDepth: number | 'load' = 'load';
  public clearStencil: number | 'load' = 'load';

  constructor(public pixelFormat: Format) {}

  /**
   * Set the dimensions of a render target description.
   */
  public setDimensions(
    width: number,
    height: number,
    sampleCount: number,
  ): void {
    this.width = width;
    this.height = height;
    this.sampleCount = sampleCount;
  }

  public copyDimensions(desc: Readonly<GfxrRenderTargetDescription>): void {
    this.width = desc.width;
    this.height = desc.height;
    this.sampleCount = desc.sampleCount;
  }
}
