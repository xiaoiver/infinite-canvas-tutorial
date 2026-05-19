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

  /**
   * raindrop-fx only: simulate rain physics for this many seconds before capture
   * (resets sim, primes, then fixed-dt steps). `0` = current preview state.
   */
  @field({ type: Type.float32, default: 0 })
  declare rainWarmupSec: number;

  /**
   * raindrop-fx only: engine time for the capture frame (seconds). Defaults to `rainWarmupSec`.
   */
  @field({ type: Type.float32, default: 0 })
  declare rainCaptureTimeSec: number;
}

/**
 * 按时间轴（引擎时间）连帧栅格化后编码为 WebM 或 GIF，供带 `useEngineTime` 的滤镜动效导出。
 * 由 {@link MeshPipeline} 消费，完成后会写入 {@link AnimationExportOutput}。
 */
export class RasterAnimationExportRequest {
  @field.ref declare canvas: Entity;

  @field.boolean declare download: boolean;

  @field({
    type: Type.staticString(['webm', 'gif']),
    default: 'webm',
  })
  declare format: 'webm' | 'gif';

  @field({ type: Type.float32, default: 3 })
  declare durationSec: number;

  @field({ type: Type.float32, default: 24 })
  declare fps: number;

  @field.boolean declare grid: boolean;

  @field.object declare nodes: SerializedNode[];

  @field({ type: Type.float32, default: 1 })
  declare scale: number;

  /** 第一帧对应的 `setPostEffectEngineTimeSeconds`（秒） */
  @field({ type: Type.float32, default: 0 })
  declare timeStart: number;

  /**
   * GIF 每帧调色板质量：高 256 色、中 128、低 64。仅 `format === 'gif'` 时有效。
   */
  @field({
    type: Type.staticString(['high', 'medium', 'low']),
    default: 'high',
  })
  declare gifQuality: 'high' | 'medium' | 'low';

  /**
   * raindrop-fx only: simulate rain for this many seconds before frame `timeStart`.
   * Engine time for frame i is `rainWarmupSec + timeStart + i / fps`.
   */
  @field({ type: Type.float32, default: 0 })
  declare rainWarmupSec: number;
}

/**
 * 动画导出结果；由应用侧 {@link DownloadAnimationExport} 等触发下载。
 */
export class AnimationExportOutput {
  @field.ref declare canvas: Entity;

  @field.boolean declare download: boolean;

  @field.object declare blob: Blob;

  @field.object declare fileName: string;
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
