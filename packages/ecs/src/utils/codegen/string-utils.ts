/**
 * 代码生成用的命名工具：把节点 `name`/`id` 等转换为各框架惯用的标识符大小写。
 * 与 design-to-code 转译器配套（见 {@link ./index}）。
 */

/** 把任意字符串切分为语义单词（按非字母数字、驼峰边界、数字边界）。 */
function splitWords(input: string): string[] {
  return (
    input
      // camelCase / PascalCase 边界
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      // 字母与数字边界
      .replace(/([A-Za-z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2')
      // 分隔符
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
  );
}

/** `my node-1` → `myNode1` */
export function camelCase(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) {
    return '';
  }
  return words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
}

/** `my node-1` → `MyNode1` */
export function pascalCase(input: string): string {
  const camel = camelCase(input);
  if (!camel) {
    return '';
  }
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** `myNode1` → `my-node-1` */
export function kebabCase(input: string): string {
  return splitWords(input)
    .map((w) => w.toLowerCase())
    .join('-');
}

/**
 * 由 `name`/`id` 生成合法的组件名（PascalCase）。空或以数字开头时回退到带前缀的安全名。
 */
export function toComponentName(
  raw: string | undefined,
  fallback: string,
): string {
  const pascal = pascalCase(raw ?? '');
  if (pascal && /^[A-Za-z]/.test(pascal)) {
    return pascal;
  }
  const fb = pascalCase(fallback) || 'Component';
  return /^[A-Za-z]/.test(fb) ? fb : `C${fb}`;
}

/**
 * 由 `name`/`id` 生成合法的 prop 名（camelCase）。空或以数字开头时回退。
 */
export function toPropName(raw: string | undefined, fallback: string): string {
  const camel = camelCase(raw ?? '');
  if (camel && /^[A-Za-z]/.test(camel)) {
    return camel;
  }
  const fb = camelCase(fallback) || 'prop';
  return /^[A-Za-z]/.test(fb) ? fb : `p${pascalCase(fb)}`;
}
