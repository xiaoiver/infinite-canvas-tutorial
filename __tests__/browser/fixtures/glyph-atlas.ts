import fontURL from '../../../packages/webcomponents/examples/NotoSans-Regular.ttf?url';
import { GlyphAtlasPool as CorePool } from '../../../packages/core/src/utils/glyph/glyph-atlas-pool';
import { GlyphAtlasPool as ECSPool } from '../../../packages/ecs/src/utils/glyph/glyph-atlas-pool';
import { GlyphManager as CoreGlyphs } from '../../../packages/core/src/utils/glyph';
import { GlyphManager as ECSGlyphs } from '../../../packages/ecs/src/utils/glyph/glyph-manager';
import { TinySDF as CoreSDF } from '../../../packages/core/src/utils/glyph/tiny-sdf';
import { TinySDF as ECSSDF } from '../../../packages/ecs/src/utils/glyph/tiny-sdf';
import './mixed-renderer';
// Bootstrap the TLA renderer fixture before entering the drawcall import graph.
import { SDFText as CoreText } from '../../../packages/core/src/drawcalls/SDFText';
import { SDFText as ECSText } from '../../../packages/ecs/src/drawcalls/SDFText';
import { TextBatch as CoreTextBatch } from '../../../packages/core/src/drawcalls/TextBatch';
import { TextBatch as ECSTextBatch } from '../../../packages/ecs/src/drawcalls/TextBatch';

// Test/benchmark instrumentation only. ASCII is an explicit comparison control.
const ascii = new URLSearchParams(location.search).get('ascii') === '1';
let glyphDraws = 0,
  atlasUploads = 0,
  uploadedBytes = 0,
  atlasCpuMs = 0,
  textGeometryBuilds = 0,
  textBatchKeyChecks = 0,
  textLayoutChecks = 0;
const restore: (() => void)[] = [];
// Private-atlas control keeps the real rendering/resource path but isolates keys.
const privateAtlas =
  new URLSearchParams(location.search).get('private') === '1';
for (const ctor of [CorePool, ECSPool]) {
  const prototype = ctor.prototype as { acquire: (...args: any[]) => any };
  const acquire = prototype.acquire;
  prototype.acquire = function (device, key, create, share = true) {
    return acquire.call(this, device, key, create, share && !privateAtlas);
  };
  restore.push(() => {
    prototype.acquire = acquire;
  });
}
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
// Observe compatibility and snapshot work, preserving the real planner and methods.
for (const ctor of [CoreTextBatch, ECSTextBatch]) {
  const target = ctor as unknown as {
    batchKey: (...args: any[]) => string | null;
    prototype: { layoutValues: (...args: any[]) => unknown };
  };
  const key = target.batchKey,
    layout = target.prototype.layoutValues;
  target.batchKey = function (...args) {
    textBatchKeyChecks++;
    return key.apply(this, args);
  };
  target.prototype.layoutValues = function (...args) {
    textLayoutChecks++;
    return layout.apply(this, args);
  };
  restore.push(() => {
    target.batchKey = key;
    target.prototype.layoutValues = layout;
  });
}
// Count real SDF geometry construction without replacing its GPU path.
for (const ctor of [CoreText, ECSText]) {
  const create = ctor.prototype.createGeometry;
  ctor.prototype.createGeometry = function () {
    textGeometryBuilds++;
    return create.call(this);
  };
  restore.push(() => {
    ctor.prototype.createGeometry = create;
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
window.glyphAtlasFontURL = fontURL;
window.glyphAtlasProbe = () => ({
  ascii,
  privateAtlas,
  glyphDraws,
  atlasUploads,
  uploadedBytes,
  atlasCpuMs,
  textGeometryBuilds,
  textBatchKeyChecks,
  textLayoutChecks,
});
declare global {
  interface Window {
    glyphAtlasFontURL: string;
    glyphAtlasProbe: () => {
      ascii: boolean;
      privateAtlas: boolean;
      glyphDraws: number;
      atlasUploads: number;
      uploadedBytes: number;
      atlasCpuMs: number;
      textGeometryBuilds: number;
      textBatchKeyChecks: number;
      textLayoutChecks: number;
    };
  }
}
