import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  Parent,
  Text,
  ComputedTextMetrics,
  ComputedBounds,
  ComputedCamera,
  ComputedLOD,
  ComputedVisibility,
  GlobalTransform,
  Renderable,
  Culled,
  ToBeDeleted,
  Selected,
  Highlighted,
  Editable,
  UI,
  FillLayers,
  FillTexture,
  Stroke,
  StrokeLayers,
  TextDecoration,
  DropShadow,
  InnerShadow,
  Filter,
  NodeLayerBlendMode,
  ClipMode,
  SizeAttenuation,
  Wireframe,
} from '../components';
import {
  chooseTextLOD,
  projectedFontHeight,
  textProxyLines,
} from '../utils/text-lod';
import { containsEmoji } from '../utils';
import { needsBidiGlyphLayout } from '../utils/bidi';
import { getSceneRoot } from './Transform';

/** Evaluates runtime representation only. Original bounds and interaction remain intact. */
export class ComputeLOD extends System {
  private canvases = this.query((q) => q.current.with(Canvas).read);
  private states = this.query((q) => q.current.with(ComputedLOD).read);
  private texts = this.query((q) => q.current.with(Text, Renderable).read);
  // Separate queries observe optional component addition/removal even when Text stays present.
  private changes = [
    Text,
    ComputedTextMetrics,
    ComputedBounds,
    GlobalTransform,
    Children,
    Parent,
    ComputedVisibility,
    Culled,
    ToBeDeleted,
    Selected,
    Highlighted,
    Editable,
    FillLayers,
    FillTexture,
    Stroke,
    StrokeLayers,
    TextDecoration,
    DropShadow,
    InnerShadow,
    Filter,
    NodeLayerBlendMode,
    ClipMode,
    SizeAttenuation,
    Wireframe,
    Canvas,
    ComputedCamera,
  ].map((type) =>
    this.query((q) => q.addedChangedOrRemoved.with(type).trackWrites),
  );
  constructor() {
    super();
    this.query(
      (q) => q.using(Camera, Parent, UI).read.and.using(ComputedLOD).write,
    );
  }

  private supported(entity: Entity): boolean {
    const text = entity.read(Text);
    if (
      text.path ||
      text.bitmapFont ||
      text.physical ||
      containsEmoji(text.content) ||
      needsBidiGlyphLayout(text.content) ||
      entity.has(UI) ||
      !entity.has(ComputedTextMetrics) ||
      !entity.has(GlobalTransform) ||
      !entity.has(ComputedBounds)
    )
      return false;
    if (
      entity.hasSomeOf(
        FillTexture,
        TextDecoration,
        DropShadow,
        InnerShadow,
        SizeAttenuation,
        Wireframe,
      )
    )
      return false;
    if (entity.has(Stroke) && entity.read(Stroke).width > 0) return false;
    if (
      entity.has(StrokeLayers) &&
      entity.read(StrokeLayers).layers.some((l) => l.enabled !== false)
    )
      return false;
    // Clip writers, clipped descendants and effect/blend ancestors stay on the full path.
    let ancestor: Entity = entity;
    while (ancestor) {
      if (ancestor.hasSomeOf(ClipMode, Filter, NodeLayerBlendMode))
        return false;
      if (
        ancestor.hasSomeOf(Selected, Highlighted) ||
        (ancestor.has(Editable) && ancestor.read(Editable).isEditing)
      )
        return false;
      ancestor = ancestor.has(Children) ? ancestor.read(Children).parent : null;
    }
    const fills = entity.has(FillLayers)
      ? entity.read(FillLayers).layers.filter((l) => l.enabled !== false)
      : [];
    if (
      fills.length !== 1 ||
      fills[0].type !== 'solid' ||
      (fills[0].blendMode && fills[0].blendMode !== 'normal')
    )
      return false;
    const metrics = entity.read(ComputedTextMetrics);
    if (
      !metrics.fontMetrics ||
      !Number.isFinite(metrics.fontMetrics.fontBoundingBoxAscent) ||
      metrics.fontMetrics.fontBoundingBoxAscent <= 0 ||
      !Number.isFinite(metrics.fontMetrics.fontSize) ||
      metrics.fontMetrics.fontSize <= 0 ||
      !metrics.lineMetrics?.every(
        (line) => Number.isFinite(line.width) && line.width >= 0,
      ) ||
      !metrics.lineMetrics?.length ||
      metrics.lineMetrics.length !== metrics.lines?.length ||
      !Number.isFinite(metrics.lineHeight) ||
      metrics.lineHeight <= 0
    )
      return false;
    const bounds = entity.read(ComputedBounds).renderWorldBounds;
    if (
      ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(
        Number.isFinite,
      ) ||
      bounds.maxX <= bounds.minX ||
      bounds.maxY <= bounds.minY
    )
      return false;
    return textProxyLines(text, metrics).every(
      (l) =>
        [l.x, l.y, l.width, l.height].every(Number.isFinite) && l.height > 0,
    );
  }

  execute() {
    if (!this.changes.some((q) => q.addedChangedOrRemoved.length)) return;
    if (
      !this.states.current.length &&
      !this.canvases.current.some((c) => c.read(Canvas).textLOD)
    )
      return;
    for (const entity of this.texts.current) {
      if (entity.has(ToBeDeleted)) continue;
      const camera = getSceneRoot(entity);
      const old = entity.has(ComputedLOD) ? entity.read(ComputedLOD) : null;
      let level: 'full' | 'text-proxy' = 'full';
      if (camera.has(Camera) && camera.has(ComputedCamera)) {
        const canvas = camera.read(Camera).canvas;
        const settings = canvas.read(Canvas);
        if (!settings.textLOD) {
          if (old) entity.remove(ComputedLOD);
          continue;
        }
        if (
          settings.textLOD &&
          !entity.has(Culled) &&
          entity.has(ComputedVisibility) &&
          entity.read(ComputedVisibility).visible &&
          this.supported(entity)
        ) {
          const height = projectedFontHeight(
            Number(entity.read(Text).fontSize),
            entity.read(GlobalTransform).matrix,
            camera.read(ComputedCamera).viewProjectionMatrix,
            settings.width,
            settings.height,
          );
          level = chooseTextLOD(
            height,
            old?.camera === camera ? old.level : 'full',
          );
        }
      }
      // No runtime component or rebuild work for the default full path.
      if (!old && level === 'full') continue;
      if (!old) entity.add(ComputedLOD, { camera, level });
      else if (old.level !== level || old.camera !== camera) {
        Object.assign(entity.write(ComputedLOD), { camera, level });
      }
    }
  }
}
