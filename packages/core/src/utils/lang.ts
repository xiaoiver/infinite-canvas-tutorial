// @see https://youmightnotneed.com/lodash

export const isNumber = (a): a is number => typeof a === 'number';
export const isObject = (a): a is object => a instanceof Object;
export const isBoolean = (arg): arg is boolean => arg === !!arg;
export const isFunction = (val): val is Function => typeof val === 'function';
export const isUndefined = (val): val is undefined => val === undefined;
export const isNil = (val): val is null | undefined => val == null;
export const isString = (a): a is string => typeof a === 'string';
export function camelToKebabCase(str: string) {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
export function kebabToCamelCase(str: string) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}
const dataUrlRegex =
  /^data:([a-z]+\/[a-z0-9\-\+]+)?(;charset=[a-z0-9\-]+)?(;base64)?,[a-z0-9\!\$&',\(\)\*\+,;=\-\._\~:@\/\?%\s]*$/i;
export function isDataUrl(url: string) {
  return dataUrlRegex.test(url);
}
export function filterUndefined(obj: object) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => value !== undefined),
  );
}

/**
 * Transform array into an object, use only when array order is irrelevant.
 */
export const arrayToObject = <T>(
  array: readonly T[],
  groupBy?: (value: T) => string | number,
) =>
  array.reduce((acc, value) => {
    acc[groupBy ? groupBy(value) : String(value)] = value;
    return acc;
  }, {} as { [key: string]: T });

/** use as a fallback after identity check (for perf reasons) */
const _defaultIsShallowComparatorFallback = (a: any, b: any): boolean => {
  // consider two empty arrays equal
  if (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === 0 &&
    b.length === 0
  ) {
    return true;
  }
  return a === b;
};
/**
 * Returns whether object/array is shallow equal.
 * Considers empty object/arrays as equal (whether top-level or second-level).
 */
export const isShallowEqual = <
  T extends Record<string, any>,
  K extends readonly unknown[],
>(
  objA: T,
  objB: T,
  comparators?:
    | { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    | (keyof T extends K[number]
        ? K extends readonly (keyof T)[]
          ? K
          : {
              _error: 'keys are either missing or include keys not in compared obj';
            }
        : {
            _error: 'keys are either missing or include keys not in compared obj';
          }),
) => {
  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  if (comparators && Array.isArray(comparators)) {
    for (const key of comparators) {
      const ret =
        objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);
      if (!ret) {
        return false;
      }
    }
    return true;
  }

  return aKeys.every((key) => {
    const comparator = (
      comparators as { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    )?.[key as keyof T];
    const ret = comparator
      ? comparator(objA[key], objB[key])
      : objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);
    return ret;
  });
};

/**
 * supply `null` as message if non-never value is valid, you just need to
 * typecheck against it
 */
export const assertNever = (
  value: never,
  message: string | null,
  softAssert?: boolean,
): never => {
  if (!message) {
    return value;
  }
  if (softAssert) {
    console.error(message);
    return value;
  }

  throw new Error(message);
};
