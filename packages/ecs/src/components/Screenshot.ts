import { Entity, field, Type } from '@lastolivegames/becsy';

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
}

export class Screenshot {
  @field.object declare dataURL: string;

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;

  /**
   * Whether to download the image.
   */
  @field.boolean declare download: boolean;
}
