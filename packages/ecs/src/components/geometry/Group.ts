import { field, Type } from '@lastolivegames/becsy';

/**
 * 与 SVG [\<g\>](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/g) 的**展示属性**语义类似：
 * 无几何，仅可携带在组上声明、供子代在解析/渲染时参考的**继承链**值（子实体仍可用自身 `Fill`/`Stroke` 覆盖）。
 *
 * - 字符串属性：`''` 表示本 `Group` 上**未设置**该属性，相当于 SVG 中不写，子级按自身与更上层链解析，而非强制继承空串。
 * - `strokeWidth`：`-1` 表示**未设置**；非负为组级线宽（与 `stroke` 的继承语义一起使用，由具体管线解析）。
 * - 反序列化 / 变更时由 `buildGroupWirePresentation`（`utils/group-presentation`）从节点 wire 写回，与 `iconfont` 根与 `g` 类型一致。
 */
export class Group {
  /**
   * 与 `fill` 相当；`''` 为未设置、不覆盖子代。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill
   */
  @field({ type: Type.object, default: '' })
  declare fill: string;

  /**
   * 与 `stroke` 相当；`''` 为未设置。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke
   */
  @field({ type: Type.object, default: '' })
  declare stroke: string;

  /**
   * 与 `stroke-width` 相当；`-1` 为未设置。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width
   */
  @field({ type: Type.float32, default: -1 })
  declare strokeWidth: number;

  /**
   * 与 `fill-rule` 相当；`''` 为未设置。常用值如 `nonzero` | `evenodd`。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
   */
  @field({ type: Type.object, default: '' })
  declare fillRule: string;

  /**
   * 与 `opacity` 相当，标量 0–1。`-1` 表示**未设置**；否则为组上透明度的上界/提示（子级可再与自身 opacity 合成，依管线而定）。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/opacity
   */
  @field({ type: Type.float32, default: -1 })
  declare opacity: number;

  /**
   * 与 `fill-opacity` 相当；`-1` 为未设置。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-opacity
   */
  @field({ type: Type.float32, default: -1 })
  declare fillOpacity: number;

  /**
   * 与 `stroke-opacity` 相当；`-1` 为未设置。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-opacity
   */
  @field({ type: Type.float32, default: -1 })
  declare strokeOpacity: number;

  /**
   * 与 `stroke-linecap` 相当；`''` 为未设置。常用值如 `butt` | `round` | `square`。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
   */
  @field({ type: Type.object, default: '' })
  declare strokeLinecap: string;

  /**
   * 与 `stroke-linejoin` 相当；`''` 为未设置。常用值如 `miter` | `round` | `bevel`。
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
   */
  @field({ type: Type.object, default: '' })
  declare strokeLinejoin: string;

  /** 若某时刻希望在构造时成组写入选项，可传入与字段同名的部分对象。 */
  constructor(props?: Partial<Group>) {
    if (props) {
      Object.assign(this, props);
    }
  }
}
