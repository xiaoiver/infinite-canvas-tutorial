/**
 * design-to-code 的框架无关「代码 IR」。
 *
 * 管线（对照 SVG 导出）：
 * ```
 * .ic SceneGraph
 *   → expandRefSerializedNodes（保留/展开 ref+reusable）
 *   → CodeIR（本文件：元素树 + 结构化样式 + 变量引用 + 组件定义）
 *   → Emitter（react-tailwind | html-css | ...）
 * ```
 * 新增目标框架只需新增一个 emitter，无需改动 IR 构建逻辑。
 */
import type { ThemeMode } from '../../components/Theme';
import type { DesignVariablesMap } from '../design-variables';

/** 目标框架。 */
export type CodeFramework = 'react-tailwind' | 'html-css';

/**
 * 设计变量处理模式，与 SVG 导出的三模式保持一致心智：
 * - `resolved`：把 `$token` 解析为字面量；
 * - `preserve-token`：保留 `$token` 字符串（输出可能非标准，适合再加工）；
 * - `css-var`：输出 `var(--token)`，并生成 `:root` 变量块。
 */
export type CodeVariablesMode = 'resolved' | 'preserve-token' | 'css-var';

/**
 * 组件结构策略：
 * - `preserve`：`reusable` 根→组件定义，`ref` 实例→组件调用（Pencil 卖点，默认）；
 * - `flatten`：先 {@link expandRefSerializedNodes} 展开为扁平 DOM（回退方案）。
 */
export type CodeComponentStructure = 'preserve' | 'flatten';

/** Optional semantic HTML for a scene node. Actions remain unbound until the app wires them. */
export type CodeSemanticElement =
  | { tag: 'button' }
  | { tag: 'a'; href: string }
  | {
      tag:
        | 'main'
        | 'nav'
        | 'header'
        | 'footer'
        | 'section'
        | 'aside'
        | 'h1'
        | 'h2'
        | 'p';
    };

/** 一个样式取值：要么是字面量，要么是设计变量引用（`token` 为去掉 `$` 的键名）。 */
export interface StyleValue {
  literal?: string | number;
  /** 设计变量键名（不含 `$`）。 */
  token?: string;
}

/** 结构化、框架无关的样式。颜色/尺寸等可能携带设计变量引用。 */
export interface StyleIR {
  display?: 'flex' | 'inline-block';
  position?: 'relative' | 'absolute';
  left?: number;
  top?: number;
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch' | 'baseline';
  alignSelf?:
    | 'auto'
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'stretch'
    | 'baseline';
  justifyContent?:
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /** `[top, right, bottom, left]`，单位 px。 */
  padding?: [number, number, number, number];
  /** `[top, right, bottom, left]`，单位 px。 */
  margin?: [number, number, number, number];
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Local canvas transform; rotation is stored in radians. */
  transform?: string;
  /** Rectangular or elliptical `clipMode: clip` clips descendant content. */
  overflow?: 'hidden';
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
  objectPosition?: string;
  backgroundColor?: StyleValue;
  /** Opacity of the only enabled solid fill, applied to its paint rather than children. */
  solidFillOpacity?: StyleValue;
  backgroundImage?: StyleValue;
  borderRadius?: StyleValue;
  borderWidth?: StyleValue;
  borderColor?: StyleValue;
  boxShadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: StyleValue;
  };
  opacity?: number;
  visibility?: 'hidden' | 'visible';
  /** Opacity of the single image fill, multiplied with node opacity for `<img>`. */
  imageFillOpacity?: StyleValue;
  mixBlendMode?: string;
  color?: StyleValue;
  fontSize?: StyleValue;
  fontWeight?: string | number;
  fontStyle?: string;
  fontVariant?: string;
  fontKerning?: 'normal' | 'none';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  /** Canvas text preserves hard breaks; wrapped text also has a fixed line width. */
  whiteSpace?: 'pre' | 'pre-wrap';
  textWrapWidth?: number;
  /** Canvas applies this limit only to wrapped text with a positive wrap width. */
  maxLines?: number;
  textOverflow?: 'ellipsis' | 'clip';
  letterSpacing?: StyleValue;
  lineHeight?: StyleValue;
  textDecoration?: {
    line: 'underline' | 'overline' | 'line-through';
    style: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';
    color: StyleValue;
    thickness: number;
  };
}

export type CodeNodeRole = 'container' | 'text' | 'icon' | 'image' | 'shape';

/** 组件实例的某条属性覆盖会绑定到一个 prop；emitter 据此把 prop 注入对应位置。 */
export type CodeBindingTarget =
  | 'text'
  | 'imageSrc'
  | 'mixBlendMode'
  | 'backgroundColor'
  | 'backgroundImage'
  | 'color'
  | 'fontSize'
  | 'borderRadius'
  | 'width'
  | 'height'
  | 'borderWidth'
  | 'borderColor'
  | 'opacity'
  | 'visibility'
  | 'fontWeight'
  | 'fontStyle'
  | 'fontVariant'
  | 'fontKerning'
  | 'fontFamily'
  | 'textAlign'
  | 'textWrapWidth'
  | 'letterSpacing'
  | 'lineHeight'
  | 'textDecoration'
  | 'boxShadow'
  | 'padding'
  | 'margin'
  | 'gap'
  | 'rowGap'
  | 'columnGap'
  | 'flexDirection'
  | 'alignItems'
  | 'justifyContent'
  | 'flexWrap'
  | 'alignSelf'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexBasis'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight';

export interface CodeBinding {
  target: CodeBindingTarget;
  /** prop 名（camelCase）。 */
  prop: string;
}

/** 框架无关的元素节点。 */
export interface CodeNode {
  role: CodeNodeRole;
  /** 源 `.ic` 节点 id。 */
  id: string;
  name?: string;
  /** HTML element to emit instead of the default div/span. */
  element?: CodeSemanticElement;
  style: StyleIR;
  children: CodeNode[];
  /** `role === 'text'` 时的文本内容（字面量或变量引用）。 */
  text?: StyleValue;
  /** `role === 'icon'`。 */
  icon?: { name: StyleValue; family: string };
  /** `role === 'image'` 的资源 URL。 */
  image?: StyleValue;
  /** preserve 模式下：该节点是某 `reusable` 组件的实例。 */
  instanceOf?: string;
  /** 实例传入的 props（prop 名 → 取值）。 */
  props?: Record<string, StyleValue>;
  /** 组件 body 内：该节点的某些位置由 prop 驱动（见 {@link CodeBinding}）。 */
  bindings?: CodeBinding[];
}

export interface CodeComponentProp {
  name: string;
  target: CodeBindingTarget;
  defaultValue: StyleValue;
}

export interface CodeComponentDef {
  /** 组件名（PascalCase）。 */
  name: string;
  /** 源 `reusable` 模板根 id。 */
  templateId: string;
  root: CodeNode;
  props: CodeComponentProp[];
}

/** 完整的代码 IR：组件定义 + 顶层元素树 + 变量上下文。 */
export interface CodeIR {
  components: CodeComponentDef[];
  roots: CodeNode[];
  /** Bounding frame for multiple explicitly sized scene roots. */
  rootFrame?: { width: number; height: number };
  variables: DesignVariablesMap;
  themeMode?: ThemeMode;
  variablesMode: CodeVariablesMode;
}

export interface CodegenOptions {
  framework?: CodeFramework;
  variablesMode?: CodeVariablesMode;
  componentStructure?: CodeComponentStructure;
  variables?: DesignVariablesMap;
  themeMode?: ThemeMode;
  /** React emitter 顶层组件名，默认 `Design`。 */
  componentName?: string;
  /** Node-id keyed semantic elements for exported HTML/JSX. */
  semanticElements?: Record<string, CodeSemanticElement>;
  /** 缩进字符串，默认两个空格。 */
  indent?: string;
}
