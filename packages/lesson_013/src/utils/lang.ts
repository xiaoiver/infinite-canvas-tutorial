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
