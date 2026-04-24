import { Entity, field, Type } from '@lastolivegames/becsy';
import type { SerializedNode } from '../types/serialized-node';

export type DataURLType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/bmp';

export class RasterScreenshotRequest {
  /**
   * The default type is image/png.
   */
  @field({
    type: Type.staticString([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/bmp',
    ]),
    default: 'image/png',
  })
  declare type: DataURLType;

  /**
   * The image quality between 0 and 1 for image/jpeg and image/webp.
   */
  @field({
    type: Type.float32,
    default: 0.92,
  })
  declare encoderOptions: number;

  /**
   * Whether to draw grid on the image.
   */
  @field.boolean declare grid: boolean;

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;

  /**
   * Whether to download the image.
   */
  @field.boolean declare download: boolean;

  /**
   * Nodes to export.
   */
  @field.object declare nodes: SerializedNode[];

  /**
   * 局部栅格导出倍率（相对逻辑选区尺寸），如 2 表示约 2× 像素边长。
   */
  @field({ type: Type.float32, default: 1 })
  declare scale: number;
}

export class VectorScreenshotRequest {
  /**
   * Whether to draw grid on the image.
   */
  @field.boolean declare grid: boolean;

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;

  /**
   * Whether to download the image.
   */
  @field.boolean declare download: boolean;

  /**
   * Nodes to export.
   */
  @field.object declare nodes: SerializedNode[];
}

export class Screenshot {
  @field.object declare dataURL: string;

  @field.object declare svg: string;

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;

  /**
   * Whether to download the image.
   */
  @field.boolean declare download: boolean;
}
