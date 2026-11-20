import { glyphFontState } from '../utils/glyph/glyph-atlas-pool';
import { SDFText } from './SDFText';
import { Shape, Text } from '../shapes';
import { DOMAdapter, BrowserAdapter, WebWorkerAdapter } from '../environment';
import {
  TEXT_BATCH_GLYPHS,
  ordinaryTextCount,
  textBatchMatrixKey,
  bakeTextVertices,
} from '../utils/text-batching';

/** Ordered, concatenated glyph geometry; shaders and ordinary typography stay in SDFText. */
export class TextBatch extends SDFText {
  protected maxInstances = TEXT_BATCH_GLYPHS;
  #layout: { shape: Shape; key: string }[] = [];
  #ready = false;
  protected override get glyphRasterFill() {
    return '';
  }
  private layoutKey(shape: Text, fontState: string | undefined) {
    const metrics = shape.metrics; // Resolves lazy bidi/layout data before taking a snapshot.
    return JSON.stringify([
      shape.content,
      shape.bidiChars,
      metrics,
      shape.letterSpacing,
      shape.textAlign,
      shape.textBaseline,
      shape.x,
      shape.y,
      shape.worldTransform.a,
      shape.worldTransform.b,
      shape.worldTransform.c,
      shape.worldTransform.d,
      shape.worldTransform.tx,
      shape.worldTransform.ty,
      shape.globalRenderOrder,
      fontState,
    ]);
  }
  constructor(...args: ConstructorParameters<typeof SDFText>) {
    super(...args);
    this.instanced = false;
  }
  static glyphCount(shape: Shape) {
    return (shape as Text).content.length;
  }
  static batchKey(shape: Shape): string | null {
    if (Object.getPrototypeOf(shape) !== Text.prototype || !shape.batchable)
      return null;
    const text = shape as Text,
      adapter = DOMAdapter.get();
    if (
      (adapter !== BrowserAdapter && adapter !== WebWorkerAdapter) ||
      text.bitmapFont ||
      text.physical ||
      text.path ||
      text.decorationLine !== 'none' ||
      text.wireframe ||
      text.sizeAttenuation ||
      text.useFillImage ||
      text.dropShadowBlurRadius > 0 ||
      text.innerShadowBlurRadius > 0 ||
      (text.stroke !== 'none' && text.strokeWidth > 0) ||
      text.fontVariant !== 'normal' ||
      ![text.x, text.y].every(Number.isFinite) ||
      Math.abs(text.x) > 8192 ||
      Math.abs(text.y) > 8192
    )
      return null;
    const { width, height, font } = text.metrics;
    if (
      !ordinaryTextCount(
        text.content,
        text.fontFamily,
        Number(text.fontSize),
        width,
        height,
      )
    )
      return null;
    const matrix = textBatchMatrixKey(text.worldTransform),
      color = text.fillRGB;
    if (
      !matrix ||
      !color ||
      ![
        color.r,
        color.g,
        color.b,
        color.opacity,
        text.opacity,
        text.fillOpacity,
      ].every(Number.isFinite)
    )
      return null;
    for (let p = text.parent; p; p = p.parent)
      if (
        p.opacity !== 1 ||
        p.fillOpacity !== 1 ||
        p.dropShadowBlurRadius > 0 ||
        p.innerShadowBlurRadius > 0 ||
        p.useFillImage
      )
        return null;
    return JSON.stringify([
      font,
      text.fontFamily,
      text.fontWeight,
      text.fontStyle,
      text.esdt,
      Number(text.fontSize),
      color.r,
      color.g,
      color.b,
      color.opacity,
      text.opacity,
      text.fillOpacity,
      matrix,
    ]);
  }
  protected override prepareGeometry() {
    if (!this.#ready) {
      this.geometryDirty = true;
      return;
    }
    if (
      !this.geometryDirty &&
      !this.materialDirty &&
      !this.shapes.some(
        (s, i) =>
          s.renderDirtyFlag ||
          s.geometryDirtyFlag ||
          s.materialDirtyFlag ||
          this.#layout[i]?.shape !== s ||
          this.#orders[i] !== s.globalRenderOrder,
      )
    )
      return;
    const fontState = glyphFontState();
    this.geometryDirty =
      this.#layout.length !== this.shapes.length ||
      this.shapes.some(
        (s, i) =>
          this.#layout[i]?.shape !== s ||
          this.#layout[i].key !== this.layoutKey(s as Text, fontState),
      );
  }
  #orders: number[] = [];
  override createGeometry() {
    this.#ready = false;
    super.createGeometry();
    const fontState = glyphFontState();
    this.#layout = this.shapes.map((shape) => ({
      shape,
      key: this.layoutKey(shape as Text, fontState),
    }));
    this.#orders = this.shapes.map((s) => s.globalRenderOrder);
    this.#ready = true;
  }
  protected override bakeGlyphVertices(shape: Text, positions: number[]) {
    bakeTextVertices(
      positions,
      this.shapes[0].worldTransform,
      shape.worldTransform,
    );
  }
}
