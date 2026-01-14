/**
 * CSS Filter / Effect
 */
export interface FilterObject {
  name: string;
  params: string;
}

export type Effect =
  | BrightnessEffect
  | DropShadowEffect
  | BlurEffect
  | NoiseEffect
  | FXAA;

export interface BrightnessEffect {
  type: 'brightness';
  value: number;
}

export interface DropShadowEffect {
  type: 'drop-shadow';
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export interface BlurEffect {
  type: 'blur';
  value: number;
}

export interface NoiseEffect {
  type: 'noise';
  value: number;
}

export interface FXAA {
  type: 'fxaa';
}

/**
 * 从 CSS filter 字符串中解析出一个或多个 filter 对象
 *
 * @example
 * parseEffect('blur(5px)')
 * // => [{ name: 'blur', value: 5 }]
 *
 * @example
 * parseEffect('drop-shadow(3px 3px red) sepia(100%)')
 * // => [{ name: 'drop-shadow', x: 3, y: 3, blur: 0, spread: 0, color: 'red' }, { name: 'sepia', value: 100 }]
 *
 * @example
 * parseEffect('blur(5px) brightness(0.4) drop-shadow(16px 16px 20px blue)')
 * // => [
 * //   { name: 'blur', value: 5 },
 * //   { name: 'brightness', value: 0.4 },
 * //   { name: 'drop-shadow', x: 16, y: 16, blur: 20, spread: 0, color: 'blue' }
 * // ]
 */
export function parseEffect(filter: string): Effect[] {
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
    const nameStart = i;
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
    const paramsStart = i;
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

  // Convert filters to effects
  const effects: Effect[] = [];
  for (const filter of filters) {
    if (filter.name === 'blur') {
      effects.push({ type: 'blur', value: parseFloat(filter.params) });
    } else if (filter.name === 'brightness') {
      effects.push({ type: 'brightness', value: parseFloat(filter.params) });
    } else if (filter.name === 'drop-shadow') {
      const [x, y, blur, spread, color] = filter.params.split(' ');
      effects.push({
        type: 'drop-shadow',
        x: parseFloat(x),
        y: parseFloat(y),
        blur: parseFloat(blur),
        spread: parseFloat(spread),
        color,
      });
    } else if (filter.name === 'noise') {
      effects.push({ type: 'noise', value: parseFloat(filter.params) });
    } else if (filter.name === 'fxaa') {
      effects.push({ type: 'fxaa' });
    }
  }

  return effects;
}
