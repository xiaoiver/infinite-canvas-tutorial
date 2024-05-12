// @see https://youmightnotneed.com/lodash

export const isNumber = (a): a is number => typeof a === 'number';
export const isObject = (a): a is object => a instanceof Object;
export const isBoolean = (arg): arg is boolean => arg === !!arg;
export const isFunction = (val): val is Function => typeof val === 'function';
export const isUndefined = (val): val is undefined => val === undefined;
export const isNil = (val): val is null | undefined => val == null;
