/**
 * design-to-code 入口：把 `.ic` SerializedNode[] 确定性地转译为框架代码。
 *
 * 设计理念（对齐 Pencil）：格式本身即为代码而设计的 IR，转译是**确定性**的（可复现、可测试、
 * 无幻觉）；AI 仅在命名/结构清理层锦上添花。管线见 {@link ./types}。
 *
 * @example
 * ```ts
 * const code = serializedNodesToCode(api.getNodes(), {
 *   framework: 'react-tailwind',
 *   variablesMode: 'css-var',
 *   variables: api.getAppState().variables,
 * });
 * ```
 */
import type { SerializedNode } from '../../types/serialized-node';
import { buildCodeIR } from './build-ir';
import { emitReactTailwind } from './emit-react-tailwind';
import { emitHtmlCss } from './emit-html-css';
import type { CodegenOptions } from './types';

export * from './types';
export * from './string-utils';
export { buildCodeIR } from './build-ir';
export { emitReactTailwind } from './emit-react-tailwind';
export { emitHtmlCss } from './emit-html-css';

/**
 * 主转译函数：`.ic` 节点 → 目标框架源码字符串。
 *
 * @param nodes `.ic` 节点（如 `api.getNodes()`）。
 * @param options 见 {@link CodegenOptions}；默认 `react-tailwind` + `resolved` + `preserve`。
 */
export function serializedNodesToCode(
  nodes: SerializedNode[],
  options: CodegenOptions = {},
): string {
  const framework = options.framework ?? 'react-tailwind';
  const indent = options.indent ?? '  ';

  // HTML 无组件概念：未显式指定时强制扁平化，避免输出悬空的组件调用。
  const componentStructure =
    options.componentStructure ??
    (framework === 'html-css' ? 'flatten' : 'preserve');

  const ir = buildCodeIR(nodes, { ...options, componentStructure });

  if (framework === 'html-css') {
    return emitHtmlCss(ir, indent);
  }
  return emitReactTailwind(ir, indent, options.componentName ?? 'Design');
}
