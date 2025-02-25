// @see https://youmightnotneed.com/lodash

export const isNumber = (a): a is number => typeof a === 'number';
export const isObject = (a): a is object => a instanceof Object;
export const isBoolean = (arg): arg is boolean => arg === !!arg;
export const isFunction = (val): val is Function => typeof val === 'function';
export const isUndefined = (val): val is undefined => val === undefined;
export const isNil = (val): val is null | undefined => val == null;
export const isString = (a): a is string => typeof a === 'string';

// @see https://github.com/observablehq/plot/blob/main/src/options.js#L537
const namedColors = new Set("none,currentcolor,transparent,aliceblue,antiquewhite,aqua,aquamarine,azure,beige,bisque,black,blanchedalmond,blue,blueviolet,brown,burlywood,cadetblue,chartreuse,chocolate,coral,cornflowerblue,cornsilk,crimson,cyan,darkblue,darkcyan,darkgoldenrod,darkgray,darkgreen,darkgrey,darkkhaki,darkmagenta,darkolivegreen,darkorange,darkorchid,darkred,darksalmon,darkseagreen,darkslateblue,darkslategray,darkslategrey,darkturquoise,darkviolet,deeppink,deepskyblue,dimgray,dimgrey,dodgerblue,firebrick,floralwhite,forestgreen,fuchsia,gainsboro,ghostwhite,gold,goldenrod,gray,green,greenyellow,grey,honeydew,hotpink,indianred,indigo,ivory,khaki,lavender,lavenderblush,lawngreen,lemonchiffon,lightblue,lightcoral,lightcyan,lightgoldenrodyellow,lightgray,lightgreen,lightgrey,lightpink,lightsalmon,lightseagreen,lightskyblue,lightslategray,lightslategrey,lightsteelblue,lightyellow,lime,limegreen,linen,magenta,maroon,mediumaquamarine,mediumblue,mediumorchid,mediumpurple,mediumseagreen,mediumslateblue,mediumspringgreen,mediumturquoise,mediumvioletred,midnightblue,mintcream,mistyrose,moccasin,navajowhite,navy,oldlace,olive,olivedrab,orange,orangered,orchid,palegoldenrod,palegreen,paleturquoise,palevioletred,papayawhip,peachpuff,peru,pink,plum,powderblue,purple,rebeccapurple,red,rosybrown,royalblue,saddlebrown,salmon,sandybrown,seagreen,seashell,sienna,silver,skyblue,slateblue,slategray,slategrey,snow,springgreen,steelblue,tan,teal,thistle,tomato,turquoise,violet,wheat,white,whitesmoke,yellow".split(",")); // prettier-ignore
// Returns true if value is a valid CSS color string. This is intentionally lax
// because the CSS color spec keeps growing, and we don’t need to parse these
// colors—we just need to disambiguate them from column names.
// https://www.w3.org/TR/SVG11/painting.html#SpecifyingPaint
// https://www.w3.org/TR/css-color-5/
export const isColor = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  value = value.toLowerCase().trim();
  return (
    /^#[0-9a-f]{3,8}$/.test(value) || // hex rgb, rgba, rrggbb, rrggbbaa
    /^(?:url|var|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)$/.test(
      value,
    ) || // <funciri>, CSS variable, color, etc.
    namedColors.has(value) // currentColor, red, etc.
  );
};

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
