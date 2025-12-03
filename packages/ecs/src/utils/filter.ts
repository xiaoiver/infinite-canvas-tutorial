/**
 * CSS Filter 对象接口
 */
export interface FilterObject {
  name: string;
  params: string;
}

/**
 * 从 CSS filter 字符串中解析出一个或多个 filter 对象
 *
 * @example
 * extractFilters('blur(5px)')
 * // => [{ name: 'blur', params: '5px' }]
 *
 * @example
 * extractFilters('drop-shadow(3px 3px red) sepia(100%)')
 * // => [{ name: 'drop-shadow', params: '3px 3px red' }, { name: 'sepia', params: '100%' }]
 *
 * @example
 * extractFilters('blur(5px) brightness(0.4) drop-shadow(16px 16px 20px blue)')
 * // => [
 * //   { name: 'blur', params: '5px' },
 * //   { name: 'brightness', params: '0.4' },
 * //   { name: 'drop-shadow', params: '16px 16px 20px blue' }
 * // ]
 */
export function extractFilters(filter: string): FilterObject[] {
  if (!filter || typeof filter !== 'string') {
    return [];
  }

  const filters: FilterObject[] = [];
  let i = 0;
  const len = filter.length;

  // 跳过前导空白
  while (i < len && /\s/.test(filter[i])) {
    i++;
  }

  while (i < len) {
    // 提取 filter 名称（直到遇到 '('）
    let nameStart = i;
    while (i < len && filter[i] !== '(' && !/\s/.test(filter[i])) {
      i++;
    }

    if (i === nameStart) {
      // 没有找到有效的 filter 名称，跳过
      i++;
      continue;
    }

    const name = filter.slice(nameStart, i).trim();

    // 跳过空白
    while (i < len && /\s/.test(filter[i])) {
      i++;
    }

    // 如果下一个字符不是 '('，说明这个名称不完整，跳过
    if (i >= len || filter[i] !== '(') {
      // 可能是 url(#filter-id) 这种情况，尝试继续解析
      i++;
      continue;
    }

    // 跳过 '('
    i++;

    // 提取参数（需要处理嵌套括号，比如 url() 中的内容）
    let paramsStart = i;
    let depth = 1;
    let inString = false;
    let stringChar = '';

    while (i < len && depth > 0) {
      const char = filter[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
      } else {
        if (char === stringChar) {
          // 检查是否是转义的引号（前一个字符不是反斜杠，或者是转义的反斜杠）
          if (
            i === 0 ||
            filter[i - 1] !== '\\' ||
            (i > 1 && filter[i - 2] === '\\')
          ) {
            inString = false;
          }
        }
      }

      if (depth > 0) {
        i++;
      }
    }

    const params = filter.slice(paramsStart, i).trim();

    // 跳过 ')'
    if (i < len && filter[i] === ')') {
      i++;
    }

    filters.push({ name, params });

    // 跳过后续空白
    while (i < len && /\s/.test(filter[i])) {
      i++;
    }
  }

  return filters;
}
