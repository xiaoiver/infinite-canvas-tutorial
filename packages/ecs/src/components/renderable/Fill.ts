import { field, Type } from '@lastolivegames/becsy';
import { Texture } from '@infinite-canvas-tutorial/device-api';
import type { FillLayerBlendMode } from '../../types/fill-layer-blend';

export type { FillLayerBlendMode };

/**
 * 单层填充描述；在 {@link FillLayers.layers} 中按顺序从底到顶叠加（线框 `fills` 可 0～n 条）。
 *
 * `opacity` 为 0–1，缺省 1；与实体 {@link Opacity.fillOpacity} 相乘。
 * `enabled` 为 false 时跳过该层（缺省为启用）。
 */
export type FillLayerItem =
  | {
      type: 'solid';
      value: string;
      /** 0–1；线框上可为设计变量引用字符串 */
      opacity?: number | string;
      enabled?: boolean;
      /**
       * 与同层下方已绘制内容的混合模式；缺省为 `normal`（source-over 栈上的下一层）。
       * 非 `normal` 时在 GPU 上预合成到单层纹理再参与形状渲染。
       */
      blendMode?: FillLayerBlendMode;
    }
  | {
      type: 'gradient';
      value: string;
      opacity?: number | string;
      enabled?: boolean;
      blendMode?: FillLayerBlendMode;
    }
  | {
      type: 'image';
      value: string;
      /** CSS `object-fit`；缺省 `fill` */
      objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
      /** CSS `object-position`；缺省 `50% 50%` */
      objectPosition?: string;
      opacity?: number | string;
      enabled?: boolean;
      blendMode?: FillLayerBlendMode;
    }
  | {
      /** 图案图源 URL / data URL；上传 GPU 时映射为 {@link Pattern}.image */
      type: 'pattern';
      value: string | CanvasImageSource;
      repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
      transform?: string;
      opacity?: number | string;
      enabled?: boolean;
      blendMode?: FillLayerBlendMode;
    };

export class FillLayers {
  @field({ type: Type.object, default: () => [] })
  declare layers: FillLayerItem[];

  constructor(layers?: FillLayerItem[]) {
    if (layers) {
      this.layers = layers;
    }
  }
}

/**
 * 描边栈（线框 `strokes`），条目结构与 {@link FillLayerItem} 一致。
 */
export class StrokeLayers {
  @field({ type: Type.object, default: () => [] })
  declare layers: FillLayerItem[];

  constructor(layers?: FillLayerItem[]) {
    if (layers) {
      this.layers = layers;
    }
  }
}

export class FillTexture {
  @field.object declare value: Texture;

  constructor(value?: Texture) {
    this.value = value;
  }
}

/**
 * GPU 上的 {@link FillTexture} 每帧由外部（如 compute pass）更新内容时挂上此标记，
 * 否则 {@link MeshPipeline} 在场景无其它变更时会跳过 `renderCamera`，画布看不到动画。
 */
export class FillTextureLive {}
