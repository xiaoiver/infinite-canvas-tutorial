import { Entity, System } from '@lastolivegames/becsy';
import {
  AnimationPlayer,
  Camera,
  Canvas,
  Children,
  FillLayers,
  StrokeLayers,
  Opacity,
  Path,
  Stroke,
  Transform,
} from '../components';
import { safeAddComponent } from '../history';
import type { API } from '../API';
import type { PathSerializedNode } from '../types/serialized-node';
import { inferXYWidthHeight } from '../utils/deserialize';
import { isGradient } from '../utils/gradient';
import { getSceneRoot } from './Transform';
import { isFillLayerEnabled } from '../utils/fillLayers';
import type {
  AnimationController,
  AnimationFrameValues,
  AnimationSnapshot,
} from '../animation';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDasharray(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1]);
}

export function computeTranslationWithTransformOrigin(input: {
  currentTranslation: { x: number; y: number };
  currentScale: { x: number; y: number };
  currentRotation: number;
  nextScale: { x: number; y: number };
  nextRotation: number;
  origin: { x: number; y: number };
}) {
  const {
    currentTranslation,
    currentScale,
    currentRotation,
    nextScale,
    nextRotation,
    origin,
  } = input;

  const cosCurrent = Math.cos(currentRotation);
  const sinCurrent = Math.sin(currentRotation);
  const currentLocalX = origin.x * currentScale.x;
  const currentLocalY = origin.y * currentScale.y;
  const anchorX = currentTranslation.x + currentLocalX * cosCurrent - currentLocalY * sinCurrent;
  const anchorY = currentTranslation.y + currentLocalX * sinCurrent + currentLocalY * cosCurrent;

  const cosNext = Math.cos(nextRotation);
  const sinNext = Math.sin(nextRotation);
  const nextLocalX = origin.x * nextScale.x;
  const nextLocalY = origin.y * nextScale.y;

  return {
    x: anchorX - (nextLocalX * cosNext - nextLocalY * sinNext),
    y: anchorY - (nextLocalX * sinNext + nextLocalY * cosNext),
  };
}

interface CanvasPlayback {
  lastNow?: number;
  editing: boolean;
  playing: boolean;
  resume: WeakSet<AnimationController>;
}

export class AnimationSystem extends System {
  animations = this.query(
    (q) =>
      q.current
        .with(AnimationPlayer)
        .using(Canvas, Camera, Children)
        .read.using(
          Transform,
          Opacity,
          FillLayers,
          StrokeLayers,
          Stroke,
          Path,
          AnimationPlayer,
        ).write,
  );

  private readonly canvases = this.query((q) => q.current.with(Canvas).read);

  private readonly playback = new WeakMap<API, CanvasPlayback>();

  execute(): void {
    const now = performance.now();
    const scenes = new Map<API | undefined, Entity[]>();
    this.canvases.current.forEach((canvas) => {
      const api = canvas.read(Canvas).api;
      if (api) scenes.set(api, []);
    });
    this.animations.current.forEach((entity) => {
      const root = getSceneRoot(entity);
      const canvas = root.has(Camera) ? root.read(Camera).canvas : undefined;
      const api = canvas?.has(Canvas) ? canvas.read(Canvas).api : undefined;
      const entities = scenes.get(api) ?? [];
      entities.push(entity);
      scenes.set(api, entities);
    });

    scenes.forEach((entities, api) => {
      let state = api && this.playback.get(api);
      if (api && !state) {
        state = { editing: false, playing: false, resume: new WeakSet() };
        this.playback.set(api, state);
      }
      if (api?.getAppState().animationEditing) {
        this.executeEditing(now, api, entities, state!);
        return;
      }
      entities.forEach((entity) => {
        const controller = entity.write(AnimationPlayer).controller;
        if (!controller) return;
        // Resume only controllers paused by this canvas's editor. Controllers
        // explicitly paused before editing, or cancelled during it, stay stopped.
        if (
          state?.editing &&
          state.resume.has(controller) &&
          controller.getPlayState() === 'paused'
        )
          controller.play(now);
        if (controller.getPlayState() === 'idle') controller.play(now);
        this.applyValues(entity, controller, controller.tick(now));
      });
      if (state?.editing) {
        state.editing = state.playing = false;
        state.lastNow = undefined;
        state.resume = new WeakSet();
      }
    });
  }

  /** Advance and sample only the tracks owned by this canvas. */
  private executeEditing(
    now: number,
    api: API,
    entities: Entity[],
    state: CanvasPlayback,
  ) {
    const appState = api.getAppState();
    const playing = !!appState.animationPlaying;
    const loop = !!appState.animationLoop;
    let playhead = isFiniteNumber(appState.animationCurrentTime)
      ? Math.max(0, appState.animationCurrentTime)
      : 0;
    let sceneDuration = 0;
    entities.forEach((entity) => {
      const controller = entity.read(AnimationPlayer).controller;
      if (controller)
        sceneDuration = Math.max(sceneDuration, controller.getDuration());
    });
    if (playing) {
      const dt =
        !state.playing || state.lastNow === undefined
          ? 0
          : Math.max(0, now - state.lastNow);
      playhead += dt;
      if (sceneDuration > 0 && playhead >= sceneDuration) {
        if (loop) playhead %= sceneDuration;
        else {
          playhead = sceneDuration;
          api.setAppState({ animationPlaying: false });
        }
      }
      api.setAppState({ animationCurrentTime: playhead });
    }
    state.lastNow = now;
    state.editing = true;
    state.playing = !!api.getAppState().animationPlaying;
    entities.forEach((entity) => {
      const controller = entity.write(AnimationPlayer).controller;
      if (!controller) return;
      const playState = controller.getPlayState();
      if (playState === 'running' || playState === 'idle') {
        state.resume.add(controller);
        controller.pause();
      }
      controller.seek(playhead);
      this.applyValues(entity, controller, controller.getSnapshot());
    });
  }

  private applyValues(
    entity: Entity,
    controller: AnimationController,
    snapshot: AnimationSnapshot,
  ): void {
    const values = controller.getCurrentValues(snapshot);
    if (!values) {
      return;
    }
    applyAnimatedValues(entity, controller, values);
  }
}

/** Shared application of interpolated animation values onto an entity's components. */
function applyAnimatedValues(
  entity: Entity,
  controller: AnimationController,
  values: AnimationFrameValues,
): void {
  {
    if (entity.has(Transform)) {
      const transform = entity.write(Transform);
      const currentTranslation = {
        x: transform.translation.x,
        y: transform.translation.y,
      };
      const currentScale = {
        x: transform.scale.x,
        y: transform.scale.y,
      };
      const currentRotation = transform.rotation;

      const nextTranslation = {
        x: isFiniteNumber(values.x) ? values.x : currentTranslation.x,
        y: isFiniteNumber(values.y) ? values.y : currentTranslation.y,
      };
      const nextScale = {
        x: isFiniteNumber(values.scaleX)
          ? values.scaleX
          : isFiniteNumber(values.scale)
            ? values.scale
            : currentScale.x,
        y: isFiniteNumber(values.scaleY)
          ? values.scaleY
          : isFiniteNumber(values.scale)
            ? values.scale
            : currentScale.y,
      };
      const nextRotation = isFiniteNumber(values.rotation)
        ? values.rotation
        : currentRotation;

      const hasTransformOrigin = !!controller.getOptions().transformOrigin;
      const hasTransformAnimation =
        isFiniteNumber(values.scale)
        || isFiniteNumber(values.scaleX)
        || isFiniteNumber(values.scaleY)
        || isFiniteNumber(values.rotation);
      // Pivot compensation keeps the origin fixed in world space when only scale/rotation are
      // keyframed. If x/y are interpolated (e.g. Lottie position + scale), must use those — do not
      // overwrite with computeTranslationWithTransformOrigin, which ignores values.x/y.
      const translationFromKeyframes =
        isFiniteNumber(values.x) && isFiniteNumber(values.y);
      if (hasTransformOrigin && hasTransformAnimation && !translationFromKeyframes) {
        const compensated = computeTranslationWithTransformOrigin({
          currentTranslation,
          currentScale,
          currentRotation,
          nextScale,
          nextRotation,
          origin: controller.getOptions().transformOrigin!,
        });
        nextTranslation.x = compensated.x;
        nextTranslation.y = compensated.y;
      }

      transform.translation.x = nextTranslation.x;
      transform.translation.y = nextTranslation.y;
      transform.scale.x = nextScale.x;
      transform.scale.y = nextScale.y;
      transform.rotation = nextRotation;
    }

    if (isFiniteNumber(values.opacity)) {
      safeAddComponent(entity, Opacity, { opacity: values.opacity });
    }
    applyAnimatedPaint(entity, FillLayers, values.fill, values.fillOpacity);
    applyAnimatedPaint(entity, StrokeLayers, values.stroke, values.strokeOpacity);
    if (isFiniteNumber(values.strokeWidth)) {
      safeAddComponent(entity, Stroke, { width: values.strokeWidth });
    } else if (typeof values.stroke === 'string' && !entity.has(Stroke)) {
      safeAddComponent(entity, Stroke, { width: 1 });
    }

    if (isDasharray(values.strokeDasharray)) {
      safeAddComponent(entity, Stroke, {
        dasharray: [values.strokeDasharray[0], values.strokeDasharray[1]],
      });
    }

    const strokeDashoffset = isFiniteNumber(values.strokeDashoffset)
      ? values.strokeDashoffset
      : isFiniteNumber(values.dashoffset)
        ? values.dashoffset
        : undefined;
    if (strokeDashoffset !== undefined) {
      safeAddComponent(entity, Stroke, { dashoffset: strokeDashoffset });
    }

    if (typeof values.d === 'string') {
      const transform = entity.write(Transform);

      const path = {
        d: values.d,
      }
      const inferred = inferXYWidthHeight({
        ...path,
        id: '',
        type: 'path',
        zIndex: 0,
      }) as PathSerializedNode;
      transform.translation.x = inferred.x;
      transform.translation.y = inferred.y;

      safeAddComponent(entity, Path, { d: inferred.d });
    }
  }
}

/** Update the first enabled paint atomically, retaining all other layers. */
function applyAnimatedPaint(
  entity: Entity,
  component: typeof FillLayers | typeof StrokeLayers,
  paint: unknown,
  opacity: unknown,
) {
  const hasPaint = typeof paint === 'string';
  const hasOpacity = isFiniteNumber(opacity);
  if (!hasPaint && !hasOpacity) return;
  const layers = entity.has(component)
    ? [...entity.read(component).layers]
    : [];
  const index = layers.findIndex(isFillLayerEnabled);
  if (index < 0 && !hasPaint) return;
  const previous = layers[index];
  const next = hasPaint
    ? {
        ...previous,
        type: isGradient(paint) ? ('gradient' as const) : ('solid' as const),
        value: paint,
      }
    : { ...previous };
  if (hasOpacity) next.opacity = opacity;
  if (index < 0) layers.push(next);
  else layers[index] = next;
  safeAddComponent(entity, component, { layers });
}
