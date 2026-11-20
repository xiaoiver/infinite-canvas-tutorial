import { GlyphManager as CoreGlyphs } from '../../../packages/core/src/utils/glyph';
import { GlyphManager as ECSGlyphs } from '../../../packages/ecs/src/utils/glyph/glyph-manager';
import { TinySDF as CoreSDF } from '../../../packages/core/src/utils/glyph/tiny-sdf';
import { TinySDF as ECSSDF } from '../../../packages/ecs/src/utils/glyph/tiny-sdf';
import './mixed-renderer';

// Test/benchmark instrumentation only. ASCII is an explicit comparison control.
const ascii = new URLSearchParams(location.search).get('ascii') === '1';
let glyphDraws = 0,
  atlasUploads = 0,
  uploadedBytes = 0,
  atlasCpuMs = 0;
const restore: (() => void)[] = [];
for (const ctor of [CoreSDF, ECSSDF]) {
  const draw = ctor.prototype.draw;
  ctor.prototype.draw = function (...args) {
    glyphDraws++;
    return draw.apply(this, args);
  };
  restore.push(() => {
    ctor.prototype.draw = draw;
  });
}
for (const ctor of [CoreGlyphs, ECSGlyphs]) {
  const generate = ctor.prototype.generateAtlas;
  // Both implementations expose the same atlas contract, backed by their own device API.
  (ctor.prototype as any).generateAtlas = function (...args: any[]) {
    if (ascii) args[8] = true;
    const previous = this.getAtlasTexture();
    const start = performance.now();
    try {
      return generate.apply(this, args as any);
    } finally {
      atlasCpuMs += performance.now() - start;
      if (this.getAtlasTexture() !== previous) {
        atlasUploads++;
        uploadedBytes += this.getAtlas().image.data.byteLength;
      }
    }
  };
  restore.push(() => {
    ctor.prototype.generateAtlas = generate;
  });
}
const destroy = window.mixedRenderer.destroy;
window.mixedRenderer.destroy = async () => {
  try {
    return await destroy();
  } finally {
    restore.forEach((undo) => undo());
  }
};
window.glyphAtlasProbe = () => ({
  ascii,
  glyphDraws,
  atlasUploads,
  uploadedBytes,
  atlasCpuMs,
});
declare global {
  interface Window {
    glyphAtlasProbe: () => {
      ascii: boolean;
      glyphDraws: number;
      atlasUploads: number;
      uploadedBytes: number;
      atlasCpuMs: number;
    };
  }
}
