/**
 * Code IR → React + Tailwind 代码字符串。
 *
 * - 布局/间距/排版 → Tailwind 工具类（必要时用 arbitrary value 语法，如 `gap-[10px]`）；
 * - 颜色/圆角等设计变量：`css-var` 模式输出 `bg-[var(--token)]`；`preserve-token` 模式回退为
 *   inline style 中保留 `$token`；`resolved` 模式输出字面量；
 * - `iconfont` → `lucide-react`（lucide 族）或 `@iconify/react`（其他族）；
 * - `reusable` → 函数组件定义，`ref` 实例 → 组件调用并以 props 传入覆盖项。
 */
import { formatNumber } from '../serialize/points';
import { pascalCase } from './string-utils';
import { styleValueToCss } from './emit-style';
import type {
  CodeBindingTarget,
  CodeComponentDef,
  CodeIR,
  CodeNode,
  CodeVariablesMode,
  StyleIR,
  StyleValue,
} from './types';

const TARGET_TO_CSS_KEY: Record<CodeBindingTarget, string> = {
  text: 'content',
  backgroundColor: 'backgroundColor',
  color: 'color',
  fontSize: 'fontSize',
  borderRadius: 'borderRadius',
};

interface TwResult {
  classes: string[];
  /** preserve-token 模式无法进类名的 token → inline style（值已是 JS 字面量表达式）。 */
  inline: Array<[string, string]>;
}

/** token 在 preserve-token 模式下不能进 arbitrary 类名，需回退 inline。 */
function needsInline(
  sv: StyleValue | undefined,
  mode: CodeVariablesMode,
): boolean {
  return !!sv?.token && mode === 'preserve-token';
}

/** arbitrary value 内不能有空格，用下划线代替（Tailwind 约定）。 */
function tw(raw: string): string {
  return raw.replace(/ /g, '_');
}

function genTailwind(
  style: StyleIR,
  mode: CodeVariablesMode,
  skip: Set<CodeBindingTarget>,
): TwResult {
  const classes: string[] = [];
  const inline: Array<[string, string]> = [];
  const addInline = (key: string, sv: StyleValue) =>
    inline.push([key, JSON.stringify(styleValueToCss(sv, mode))]);

  if (style.display === 'flex') {
    classes.push('flex');
    switch (style.flexDirection) {
      case 'row-reverse':
        classes.push('flex-row-reverse');
        break;
      case 'column':
        classes.push('flex-col');
        break;
      case 'column-reverse':
        classes.push('flex-col-reverse');
        break;
      case 'row':
        classes.push('flex-row');
        break;
      default:
        break;
    }
    const align: Record<string, string> = {
      center: 'items-center',
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    };
    if (style.alignItems && align[style.alignItems])
      classes.push(align[style.alignItems]);
    const justify: Record<string, string> = {
      center: 'justify-center',
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };
    if (style.justifyContent && justify[style.justifyContent])
      classes.push(justify[style.justifyContent]);
    if (style.flexWrap === 'wrap') classes.push('flex-wrap');
    else if (style.flexWrap === 'wrap-reverse')
      classes.push('flex-wrap-reverse');
    if (style.gap !== undefined)
      classes.push(`gap-[${formatNumber(style.gap)}px]`);
    if (style.rowGap !== undefined)
      classes.push(`gap-y-[${formatNumber(style.rowGap)}px]`);
    if (style.columnGap !== undefined)
      classes.push(`gap-x-[${formatNumber(style.columnGap)}px]`);
  }
  if (style.flexGrow !== undefined)
    classes.push(style.flexGrow === 1 ? 'grow' : `grow-[${style.flexGrow}]`);
  if (style.flexShrink === 0) classes.push('shrink-0');

  pushBox(classes, 'p', style.padding);
  pushBox(classes, 'm', style.margin);

  if (style.width !== undefined)
    classes.push(`w-[${formatNumber(style.width)}px]`);
  if (style.height !== undefined)
    classes.push(`h-[${formatNumber(style.height)}px]`);
  if (style.minWidth !== undefined)
    classes.push(`min-w-[${formatNumber(style.minWidth)}px]`);
  if (style.maxWidth !== undefined)
    classes.push(`max-w-[${formatNumber(style.maxWidth)}px]`);
  if (style.minHeight !== undefined)
    classes.push(`min-h-[${formatNumber(style.minHeight)}px]`);
  if (style.maxHeight !== undefined)
    classes.push(`max-h-[${formatNumber(style.maxHeight)}px]`);

  if (style.backgroundColor && !skip.has('backgroundColor')) {
    if (needsInline(style.backgroundColor, mode))
      addInline('backgroundColor', style.backgroundColor);
    else
      classes.push(`bg-[${tw(styleValueToCss(style.backgroundColor, mode))}]`);
  }
  if (style.borderRadius && !skip.has('borderRadius')) {
    if (needsInline(style.borderRadius, mode))
      addInline('borderRadius', style.borderRadius);
    else
      classes.push(
        `rounded-[${tw(styleValueToCss(style.borderRadius, mode, true))}]`,
      );
  }
  if (style.borderWidth) {
    classes.push(
      `border-[${tw(styleValueToCss(style.borderWidth, mode, true))}]`,
    );
    if (style.borderColor) {
      if (needsInline(style.borderColor, mode))
        addInline('borderColor', style.borderColor);
      else
        classes.push(
          `border-[${tw(styleValueToCss(style.borderColor, mode))}]`,
        );
    }
  }
  if (style.boxShadow) {
    const s = style.boxShadow;
    if (needsInline(s.color, mode)) {
      inline.push([
        'boxShadow',
        JSON.stringify(
          `${formatNumber(s.offsetX)}px ${formatNumber(
            s.offsetY,
          )}px ${formatNumber(s.blur)}px ${styleValueToCss(s.color, mode)}`,
        ),
      ]);
    } else {
      classes.push(
        `shadow-[${formatNumber(s.offsetX)}px_${formatNumber(
          s.offsetY,
        )}px_${formatNumber(s.blur)}px_${tw(styleValueToCss(s.color, mode))}]`,
      );
    }
  }
  if (style.opacity !== undefined)
    classes.push(`opacity-[${formatNumber(style.opacity)}]`);

  if (style.color && !skip.has('color')) {
    if (needsInline(style.color, mode)) addInline('color', style.color);
    else classes.push(`text-[${tw(styleValueToCss(style.color, mode))}]`);
  }
  if (style.fontSize && !skip.has('fontSize')) {
    if (needsInline(style.fontSize, mode))
      addInline('fontSize', style.fontSize);
    else
      classes.push(`text-[${tw(styleValueToCss(style.fontSize, mode, true))}]`);
  }
  if (style.fontWeight !== undefined)
    classes.push(`font-[${style.fontWeight}]`);
  if (style.fontStyle === 'italic') classes.push('italic');
  if (style.fontFamily) classes.push(`font-[${tw(style.fontFamily)}]`);
  if (style.textAlign) classes.push(`text-${style.textAlign}`);
  if (style.letterSpacing)
    classes.push(
      `tracking-[${tw(styleValueToCss(style.letterSpacing, mode, true))}]`,
    );
  if (style.lineHeight)
    classes.push(
      `leading-[${tw(styleValueToCss(style.lineHeight, mode, true))}]`,
    );

  return { classes, inline };
}

function pushBox(
  classes: string[],
  prefix: 'p' | 'm',
  v: [number, number, number, number] | undefined,
): void {
  if (!v) return;
  const [t, r, b, l] = v;
  if (t === r && r === b && b === l) {
    classes.push(`${prefix}-[${formatNumber(t)}px]`);
    return;
  }
  if (t === b && r === l) {
    classes.push(`${prefix}y-[${formatNumber(t)}px]`);
    classes.push(`${prefix}x-[${formatNumber(r)}px]`);
    return;
  }
  classes.push(`${prefix}t-[${formatNumber(t)}px]`);
  classes.push(`${prefix}r-[${formatNumber(r)}px]`);
  classes.push(`${prefix}b-[${formatNumber(b)}px]`);
  classes.push(`${prefix}l-[${formatNumber(l)}px]`);
}

interface EmitState {
  mode: CodeVariablesMode;
  indent: string;
  lucideIcons: Set<string>;
  usesIconify: boolean;
}

function renderAttributes(
  node: CodeNode,
  state: EmitState,
): { className: string; styleExpr: string } {
  const skip = new Set<CodeBindingTarget>();
  for (const b of node.bindings ?? []) {
    if (b.target !== 'text') skip.add(b.target);
  }
  const { classes, inline } = genTailwind(node.style, state.mode, skip);

  // 样式绑定 → inline style 引用 prop 标识符
  for (const b of node.bindings ?? []) {
    if (b.target === 'text') continue;
    inline.push([TARGET_TO_CSS_KEY[b.target], b.prop]);
  }

  const className = classes.length ? ` className="${classes.join(' ')}"` : '';
  let styleExpr = '';
  if (inline.length) {
    const entries = inline.map(([k, v]) => `${k}: ${v}`).join(', ');
    styleExpr = ` style={{ ${entries} }}`;
  }
  return { className, styleExpr };
}

function textExpr(node: CodeNode, state: EmitState): string {
  const textBinding = (node.bindings ?? []).find((b) => b.target === 'text');
  if (textBinding) {
    return `{${textBinding.prop}}`;
  }
  const t = node.text;
  if (!t) return '';
  if (t.token) {
    // resolved 模式不会到这里；preserve/css-var 保留可读字符串
    return escapeJsxText(styleValueToCss(t, state.mode));
  }
  return escapeJsxText(String(t.literal ?? ''));
}

function escapeJsxText(s: string): string {
  return s.replace(/[{}<>]/g, (c) => `{'${c}'}`);
}

function renderNode(node: CodeNode, state: EmitState, depth: number): string {
  const pad = state.indent.repeat(depth);

  if (node.instanceOf) {
    const props = Object.entries(node.props ?? {})
      .map(([k, v]) => {
        const val = styleValueToCss(v, state.mode);
        return typeof v.literal === 'number'
          ? `${k}={${val}}`
          : `${k}=${JSON.stringify(val)}`;
      })
      .join(' ');
    return `${pad}<${node.instanceOf}${props ? ' ' + props : ''} />`;
  }

  const { className, styleExpr } = renderAttributes(node, state);

  if (node.role === 'icon' && node.icon) {
    return renderIcon(node, state, pad, className, styleExpr);
  }

  if (node.role === 'image') {
    const src = node.image ? styleValueToCss(node.image, state.mode) : '';
    return `${pad}<img src=${JSON.stringify(src)} alt=${JSON.stringify(
      node.name ?? '',
    )}${className}${styleExpr} />`;
  }

  if (node.role === 'text' && node.children.length === 0) {
    return `${pad}<span${className}${styleExpr}>${textExpr(
      node,
      state,
    )}</span>`;
  }

  const tag = 'div';
  const inner = textExpr(node, state);
  if (node.children.length === 0) {
    return `${pad}<${tag}${className}${styleExpr}>${inner}</${tag}>`;
  }
  const childrenStr = node.children
    .map((c) => renderNode(c, state, depth + 1))
    .join('\n');
  const leading = inner ? `${state.indent.repeat(depth + 1)}${inner}\n` : '';
  return `${pad}<${tag}${className}${styleExpr}>\n${leading}${childrenStr}\n${pad}</${tag}>`;
}

function renderIcon(
  node: CodeNode,
  state: EmitState,
  pad: string,
  className: string,
  styleExpr: string,
): string {
  const icon = node.icon!;
  const name = icon.name.literal ? String(icon.name.literal) : '';
  const size = node.style.width ?? node.style.height;
  const sizeAttr =
    typeof size === 'number' ? ` size={${formatNumber(size)}}` : '';
  if (icon.family === 'lucide') {
    const comp = pascalCase(name) || 'HelpCircle';
    state.lucideIcons.add(comp);
    return `${pad}<${comp}${sizeAttr}${className}${styleExpr} />`;
  }
  state.usesIconify = true;
  return `${pad}<Icon icon=${JSON.stringify(
    `${icon.family}:${name}`,
  )}${className}${styleExpr} />`;
}

function renderComponent(def: CodeComponentDef, state: EmitState): string {
  const propsType = def.props
    .map((p) => {
      const tsType = p.target === 'fontSize' ? 'number' : 'string';
      return `${state.indent}${p.name}?: ${tsType};`;
    })
    .join('\n');
  const defaults = def.props
    .map((p) => {
      const v = styleValueToCss(p.defaultValue, state.mode);
      return typeof p.defaultValue.literal === 'number'
        ? `${p.name} = ${v}`
        : `${p.name} = ${JSON.stringify(v)}`;
    })
    .join(', ');

  const header = def.props.length
    ? `interface ${def.name}Props {\n${propsType}\n}\n\nexport function ${def.name}({ ${defaults} }: ${def.name}Props) {`
    : `export function ${def.name}() {`;

  const body = renderNode(def.root, state, 2);
  return `${header}\n${state.indent}return (\n${body}\n${state.indent});\n}`;
}

/** 把 Code IR 输出为 React + Tailwind 源码字符串。 */
export function emitReactTailwind(
  ir: CodeIR,
  indent = '  ',
  topName = 'Design',
): string {
  const state: EmitState = {
    mode: ir.variablesMode,
    indent,
    lucideIcons: new Set(),
    usesIconify: false,
  };

  const componentBlocks = ir.components.map((c) => renderComponent(c, state));

  const rootBody = ir.roots.map((n) => renderNode(n, state, 2)).join('\n');
  const rootWrapped =
    ir.roots.length === 1
      ? rootBody
      : `${indent.repeat(2)}<>\n${ir.roots
          .map((n) => renderNode(n, state, 3))
          .join('\n')}\n${indent.repeat(2)}</>`;

  const topComponent = `export function ${
    pascalCase(topName) || 'Design'
  }() {\n${indent}return (\n${rootWrapped}\n${indent});\n}`;

  // imports（在确定用到哪些图标后再生成）
  const imports: string[] = [];
  if (state.lucideIcons.size) {
    imports.push(
      `import { ${[...state.lucideIcons]
        .sort()
        .join(', ')} } from 'lucide-react';`,
    );
  }
  if (state.usesIconify) {
    imports.push(`import { Icon } from '@iconify/react';`);
  }

  const parts: string[] = [];
  if (imports.length) parts.push(imports.join('\n'));
  if (componentBlocks.length) parts.push(componentBlocks.join('\n\n'));
  parts.push(topComponent);
  return parts.join('\n\n') + '\n';
}
