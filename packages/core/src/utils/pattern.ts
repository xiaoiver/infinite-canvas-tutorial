/**
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
 */
export interface Pattern {
  image: string | CanvasImageSource;
  repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  transform?: string;
}

export function isPattern(object: any): object is Pattern {
  return object && !!(object as Pattern).image;
}
