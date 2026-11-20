import type { Device } from '@antv/g-device-api';
import type { GlyphManager } from './glyph-manager';

export interface GlyphAtlasLease {
  readonly key: string;
  readonly manager: Pick<
    GlyphManager,
    'layout' | 'getMap' | 'getAtlas' | 'getAtlasTexture'
  >;
  release(): void;
}

/** Immutable atlas snapshots live only while a drawcall holds a lease. */
export class GlyphAtlasPool {
  private devices = new WeakMap<
    Device,
    Map<string, { manager: GlyphManager; refs: number }>
  >();

  acquire(
    device: Device,
    key: string,
    create: () => GlyphManager,
    share = true,
  ): GlyphAtlasLease {
    let entries = share ? this.devices.get(device) : undefined;
    if (!entries) {
      entries = new Map();
      if (share) this.devices.set(device, entries);
    }
    let entry = entries.get(key);
    if (!entry) {
      // A failed factory publishes nothing and may be retried with the same key.
      entry = { manager: create(), refs: 0 };
      entries.set(key, entry);
    }
    entry.refs++;
    const held = entry;
    let released = false;
    return {
      key,
      manager: held.manager,
      release: () => {
        if (released) return;
        released = true;
        if (--held.refs === 0) {
          entries!.delete(key);
          held.manager.destroy();
        }
      },
    };
  }
}

const fontIds = new WeakMap<object, number>();
let nextFontId = 1;
/** A loaded FontFace may be added without a loading event: inspect the set. */
export function glyphFontState(
  fonts?: Pick<FontFaceSet, 'forEach'>,
): string | undefined {
  const observed =
    fonts ??
    (typeof document !== 'undefined'
      ? document.fonts
      : (globalThis as { fonts?: FontFaceSet }).fonts);
  if (!observed) return undefined;
  const faces: unknown[][] = [];
  observed.forEach((face) => {
    if (!fontIds.has(face)) fontIds.set(face, nextFontId++);
    const overrides = face as FontFace & {
      variationSettings?: string;
      ascentOverride?: string;
      descentOverride?: string;
      lineGapOverride?: string;
    };
    faces.push([
      fontIds.get(face),
      face.family,
      face.style,
      face.weight,
      face.stretch,
      face.unicodeRange,
      face.featureSettings,
      overrides.variationSettings,
      overrides.ascentOverride,
      overrides.descentOverride,
      overrides.lineGapOverride,
      face.display,
      face.status,
    ]);
  });
  return JSON.stringify(faces);
}
