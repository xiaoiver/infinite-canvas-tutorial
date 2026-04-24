/**
 * @chenglou/pretext resolves a canvas via OffscreenCanvas or document.createElement.
 * In Node neither exists; provide OffscreenCanvas backed by node-canvas.
 * measureText matches __tests__/utils.ts (getCanvas) so text metrics tests stay stable.
 */
const { webcrypto } = require('node:crypto');
// uuid (v9+) and other ESM shims expect global Web Crypto; ensure before any test imports.
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}

const { createCanvas } = require('canvas');

function patchMeasureText(ctx) {
  ctx.measureText = (text) => {
    const t = String(text);
    return {
      actualBoundingBoxAscent: 18,
      actualBoundingBoxDescent: 18,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: t.length * 18,
      alphabeticBaseline: 18,
      fontBoundingBoxAscent: 18,
      fontBoundingBoxDescent: 18,
      hangingBaseline: 18,
      ideographicBaseline: 18,
      width: t.length * 18,
      emHeightAscent: 18,
      emHeightDescent: 18,
    };
  };
  return ctx;
}

class NodeOffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._canvas = createCanvas(width, height);
  }

  getContext(type) {
    if (type !== '2d') {
      return null;
    }
    return patchMeasureText(this._canvas.getContext('2d'));
  }
}

const g = typeof globalThis !== 'undefined' ? globalThis : global;
if (typeof g.OffscreenCanvas === 'undefined') {
  g.OffscreenCanvas = NodeOffscreenCanvas;
}
