import { glyphFontState } from '../utils/glyph/glyph-atlas-pool';
import type { Entity } from '@lastolivegames/becsy';
import { SDFText } from './SDFText';
import {
  Text,
  TextDecoration,
  ComputedTextMetrics,
  GlobalTransform,
  GlobalRenderOrder,
  Opacity,
  Stroke,
  Wireframe,
  SizeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  FillTexture,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
  Children,
} from '../components';
import { getEnabledFillLayers } from '../utils/fillLayers';
import { DOMAdapter, BrowserAdapter, WebWorkerAdapter } from '../environment';
import {
  TEXT_BATCH_GLYPHS,
  ordinaryTextCount,
  textBatchMatrixKey,
  bakeTextVertices,
} from '../utils/text-batching';

const matrix = (shape: Entity) => {
  const { matrix: m } = shape.read(GlobalTransform);
  return { a: m.m00, b: m.m01, c: m.m10, d: m.m11, tx: m.m20, ty: m.m21 };
};
export class TextBatch extends SDFText {
  static override retainEmptyPage = false;
  #layout: { shape: Entity; key: string }[] = [];
  #ready = false;
  private rasterFill(shape: Entity) {
    // RGB is a uniform for eligible ASCII. Preserve the original raster alpha
    // and colored-SDF mode, including CSS colors whose own alpha is fractional.
    const layer = getEnabledFillLayers(shape)[0];
    const fill = layer?.type === 'solid' ? layer.value : 'black';
    return `rgba(0,0,0,${this.getUniformColor(fill).opacity})`;
  }
  protected override get glyphRasterFill() {
    return this.rasterFill(this.shapes[0]);
  }
  private layoutKey(shape: Entity, fontState: string | undefined) {
    const text = shape.read(Text),
      metrics = shape.read(ComputedTextMetrics);
    return JSON.stringify([
      text.content,
      text.fontFamily,
      text.fontWeight,
      text.fontStyle,
      text.esdt,
      Number(text.fontSize),
      text.letterSpacing,
      text.textAlign,
      metrics.font,
      metrics.bidiChars,
      metrics.lines,
      metrics.lineHeight,
      metrics.fontMetrics,
      metrics.width,
      metrics.height,
      matrix(shape),
      shape.has(GlobalRenderOrder) ? shape.read(GlobalRenderOrder).value : 0,
      fontState,
      this.rasterFill(shape),
    ]);
  }
  protected maxInstances = TEXT_BATCH_GLYPHS;
  constructor(...args: ConstructorParameters<typeof SDFText>) {
    super(...args);
    this.instanced = false;
  }
  static override instanceCount(shape: Entity) {
    return shape.read(Text).content.length;
  }
  static override batchKey(shape: Entity): string | null {
    if (
      !shape.hasAllOf(Text, ComputedTextMetrics, GlobalTransform) ||
      shape.hasSomeOf(
        Wireframe,
        SizeAttenuation,
        Filter,
        DropShadow,
        InnerShadow,
        FillTexture,
        ClipMode,
        NodeLayerBlendMode,
        Extrude3D,
      )
    )
      return null;
    const {
      content,
      fontFamily,
      fontWeight,
      fontStyle,
      fontSize,
      fontVariant,
      esdt,
      physical,
      bitmapFont,
      path,
    } = shape.read(Text);
    const adapter = DOMAdapter.get();
    if (
      (adapter !== BrowserAdapter && adapter !== WebWorkerAdapter) ||
      physical ||
      bitmapFont ||
      path ||
      (shape.has(TextDecoration) &&
        shape.read(TextDecoration).line !== 'none') ||
      fontVariant !== 'normal' ||
      (shape.has(Stroke) && shape.read(Stroke).width > 0)
    )
      return null;
    const { width, height } = shape.read(ComputedTextMetrics);
    if (
      !ordinaryTextCount(content, fontFamily, Number(fontSize), width, height)
    )
      return null;
    const m = shape.read(GlobalTransform).matrix;
    if (m.m02 !== 0 || m.m12 !== 0 || m.m22 !== 1) return null;
    const transform = textBatchMatrixKey(matrix(shape)),
      fills = getEnabledFillLayers(shape);
    const opacity = shape.has(Opacity) ? shape.read(Opacity).opacity : 1;
    if (
      !transform ||
      !Number.isFinite(opacity) ||
      fills.length !== 1 ||
      fills[0].type !== 'solid' ||
      (fills[0].blendMode && fills[0].blendMode !== 'normal')
    )
      return null;
    let parent = shape.has(Children) ? shape.read(Children).parent : null;
    while (parent) {
      if (parent.has(Opacity) && parent.read(Opacity).opacity !== 1)
        return null;
      parent = parent.has(Children) ? parent.read(Children).parent : null;
    }
    return JSON.stringify([
      fontFamily,
      fontWeight,
      fontStyle,
      Number(fontSize),
      esdt,
      fills,
      opacity,
      transform,
    ]);
  }
  protected override get geometryDefines() {
    return '#define USE_TEXT_BATCH\n';
  }
  protected override prepareGeometry() {
    if (!this.#ready) {
      this.geometryDirty = true;
      return;
    }
    if (this.geometryDirty || this.materialDirty || this.dirtyInstances.size) {
      const fontState = glyphFontState();
      this.geometryDirty =
        this.#layout.length !== this.shapes.length ||
        this.shapes.some(
          (s, i) =>
            this.#layout[i]?.shape !== s ||
            this.#layout[i].key !== this.layoutKey(s, fontState),
        );
    }
    this.dirtyInstances.clear();
  }
  override createGeometry() {
    this.#ready = false;
    super.createGeometry();
    const fontState = glyphFontState();
    this.#layout = this.shapes.map((shape) => ({
      shape,
      key: this.layoutKey(shape, fontState),
    }));
    this.#ready = true;
  }
  protected override bakeGlyphVertices(shape: Entity, positions: number[]) {
    bakeTextVertices(positions, matrix(this.shapes[0]), matrix(shape));
  }
}
