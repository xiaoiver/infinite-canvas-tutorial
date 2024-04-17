// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Color {
  export const TRANSPARENT = 0 | (0 << 8) | (0 << 16) | (0 << 24);
  export const BLACK = 0 | (0 << 8) | (0 << 16) | (255 << 24);
  export const WHITE = 255 | (255 << 8) | (255 << 16) | (255 << 24);
  export const RED = 255 | (0 << 8) | (0 << 16) | (255 << 24);

  export function opaque(self: number) {
    return (
      (self & 255) |
      (((self >> 8) & 255) << 8) |
      (((self >> 16) & 255) << 16) |
      (255 << 24)
    );
  }

  export function premultiplied(self: number) {
    const a = (self >>> 24) / 255;
    return (
      clamp(((self & 255) / 255) * a) |
      (clamp((((self >> 8) & 255) / 255) * a) << 8) |
      (clamp((((self >> 16) & 255) / 255) * a) << 16) |
      (clamp(a) << 24)
    );
  }
}

function clamp(v: number) {
  return v < 0 ? 0 : v >= 1 ? 255 : (v * 256) | 0;
}
