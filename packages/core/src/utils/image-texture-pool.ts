import type { Texture } from '@antv/g-device-api';

export interface ImageTextureLease<T> {
  readonly texture: T;
  release(): void;
}

/** Immutable image snapshots live only while their device's drawcalls hold leases. */
export class ImageTexturePool<T extends { destroy(): void }> {
  private devices = new WeakMap<
    object,
    Map<object, Map<string, { texture: T; refs: number }>>
  >();

  acquire(
    device: object,
    source: object,
    key: string,
    create: () => T,
    share = true,
  ): ImageTextureLease<T> {
    if (!share) source = {};
    let sources = this.devices.get(device);
    let variants = sources?.get(source);
    let entry = variants?.get(key);
    if (!entry) {
      // Publish nothing until upload succeeds: failures must be retryable.
      const texture = create();
      if (!sources) this.devices.set(device, (sources = new Map()));
      if (!variants) sources.set(source, (variants = new Map()));
      variants.set(key, (entry = { texture, refs: 0 }));
    }
    entry.refs++;
    const held = entry;
    let released = false;
    return {
      texture: held.texture,
      release: () => {
        if (released) return;
        released = true;
        if (--held.refs === 0) {
          variants!.delete(key);
          if (variants!.size === 0) sources!.delete(source);
          if (sources!.size === 0) this.devices.delete(device);
          held.texture.destroy();
        }
      },
    };
  }
}

/** Canvas/video/ImageData and mutable HTML images retain their private upload path. */
export function isImmutableImage(source: unknown): source is ImageBitmap {
  return (
    typeof ImageBitmap !== 'undefined' &&
    source instanceof ImageBitmap &&
    source.width > 0 &&
    source.height > 0
  );
}

export const imageTextures = new ImageTexturePool<Texture>();
