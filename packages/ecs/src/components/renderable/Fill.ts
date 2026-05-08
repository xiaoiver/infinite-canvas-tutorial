import { field, Type } from '@lastolivegames/becsy';
import { Texture } from '@infinite-canvas-tutorial/device-api';
import { type Pattern } from '../../utils';
import type { FillLayerBlendMode } from '../../types/fill-layer-blend';

export type { FillLayerBlendMode };

/**
 * 单层填充描述，多条按顺序从底到顶以 Normal（source-over）叠加。
 * 仅当 {@link FillLayers.layers} 长度 ≥ 2 时参与渲染；单条请继续使用 {@link FillSolid} 等。
 */
/**
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

export class FillSolid {
  /**
   * 实体上的填色。空串表示「本组件上未设具体颜色」，与线框/父 `g` 上未写 `fill` 的继承语义一致；`utils/color` 的 `parseColor` 对空串按透明处理。
   * 有实际颜色时一般是字面量或已解析设计变量，不应长期保持默认空串（反序列化会写入有效值或移除 `FillSolid`）。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill
   */
  @field({ type: Type.object, default: '' })
  declare value: string;

  /**
   * 设计变量绑定：变量表键名（与 `$` 后一致，如 `color.background`）。
   * 空串表示字面量填充，渲染使用 {@link value}（已解析）。
   */
  @field({ type: Type.dynamicString(200), default: '' })
  declare fillVariableRef: string;

  constructor(value?: string, fillVariableRef?: string) {
    if (value !== undefined) {
      this.value = value;
    }
    if (fillVariableRef) {
      this.fillVariableRef = fillVariableRef;
    }
  }
}

export class FillGradient {
  @field.dynamicString(300) declare value: string;
  constructor(value?: string) {
    this.value = value;
  }
}

/**
 * A pattern using the specified image and repetition.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createPattern
 */
export class FillPattern {
  /**
   * An image to be used as the pattern's image.
   *
   */
  @field.object declare image: string | CanvasImageSource;

  /**
   * A string indicating how to repeat the pattern's image.
   */
  @field.object declare repetition:
    | 'repeat'
    | 'repeat-x'
    | 'repeat-y'
    | 'no-repeat';

  /**
   * Uses a DOMMatrix object as the pattern's transformation matrix and invokes it on the pattern.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform
   */
  @field.object declare transform: string;

  constructor(value?: Pattern) {
    this.image = value?.image;
    this.repetition = value?.repetition;
    this.transform = value?.transform;
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

export class FillImage {
  @field.object declare src: TexImageSource;

  @field.object declare url: string;

  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/object-fit
   * @see https://tympanus.net/codrops/2025/03/11/replicating-css-object-fit-in-webgl/
   */
  @field({
    type: Type.staticString(['contain', 'cover', 'fill', 'none', 'scale-down']),
    default: 'contain',
  })
  declare objectFit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

  constructor(value?: Partial<FillImage>) {
    Object.assign(this, value);
  }
}
