import { Entity, System } from '@lastolivegames/becsy';
import {
  AnimationPlayer,
  FillLayers,
  StrokeLayers,
  Opacity,
  Path,
  Stroke,
  Transform,
} from '../components';
import { safeAddComponent } from '../history';
import { Canvas, inferXYWidthHeight, isGradient, PathSerializedNode } from '..';
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

export class AnimationSystem extends System {
  animations = this.query((q) =>
    q.current
      .with(AnimationPlayer)
      .using(Canvas).read
      .using(
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

  /** Wall-clock timestamp of the previous frame, used to advance the scene playhead. */
  #lastNow: number | undefined;
  /** Whether the previous frame was in editing (scrub) mode, to detect transitions. */
  #wasEditing = false;

  execute(): void {
    // 与 AnimationController.play/tick 默认时间基准一致（performance.now），避免与 UI 里无参
    // controller.play() 混用 Date.now 导致 pause 后 resume 时 startTime 算错、像从头播放。
    const now = performance.now();

    // The Animation/Timeline editor drives a single, deterministic scene playhead
    // instead of letting every controller free-run. We read that state from the
    // canvas-attached API; when no editor is active we keep the legacy behavior.
    const api = this.getApi();
    const appState = api?.getAppState?.();
    const editing = !!appState?.animationEditing;

    if (editing) {
      this.executeEditing(now, api!, appState!);
      this.#wasEditing = true;
      return;
    }

    // Leaving editing mode: resume controllers that the editor had paused so that
    // normal autoplay continues from the current position rather than restarting.
    if (this.#wasEditing) {
      this.animations.current.forEach((entity) => {
        const controller = entity.write(AnimationPlayer).controller;
        if (controller && controller.getPlayState() === 'paused') {
          controller.play(now);
        }
      });
      this.#wasEditing = false;
    }
    this.#lastNow = undefined;

    this.animations.current.forEach((entity) => {
      const player = entity.write(AnimationPlayer);
      const controller = player.controller;
      if (!controller) {
        return;
      }

      if (controller.getPlayState() === 'idle') {
        controller.play(now);
      }

      const snapshot = controller.tick(now);
      this.applyValues(entity, controller, snapshot);
    });
  }

  /** @returns the API attached to the first canvas, if any. */
  private getApi():
    | {
      getAppState?: () => Record<string, unknown>;
      setAppState?: (s: Record<string, unknown>) => void;
    }
    | undefined {
    let api: unknown;
    this.canvases.current.forEach((canvas) => {
      if (!api) {
        api = canvas.read(Canvas).api;
      }
    });
    return api as
      | {
        getAppState?: () => Record<string, unknown>;
        setAppState?: (s: Record<string, unknown>) => void;
      }
      | undefined;
  }

  /**
   * Editor (scrub) mode: advance a single scene playhead when playing, otherwise
   * sample every controller at the fixed `animationCurrentTime`.
   */
  private executeEditing(
    now: number,
    api: { getAppState?: () => any; setAppState?: (s: any) => void },
    appState: any,
  ) {
    const playing = !!appState.animationPlaying;
    const loop = !!appState.animationLoop;
    let playhead = isFiniteNumber(appState.animationCurrentTime)
      ? Math.max(0, appState.animationCurrentTime)
      : 0;

    // Scene duration = longest active track end-time across all controllers.
    let sceneDuration = 0;
    this.animations.current.forEach((entity) => {
      const controller = entity.read(AnimationPlayer).controller;
      if (controller) {
        sceneDuration = Math.max(sceneDuration, controller.getDuration());
      }
    });

    if (playing) {
      const dt = this.#lastNow === undefined ? 0 : Math.max(0, now - this.#lastNow);
      playhead += dt;
      if (sceneDuration > 0 && playhead >= sceneDuration) {
        if (loop) {
          playhead = playhead % sceneDuration;
        } else {
          playhead = sceneDuration;
          api.setAppState?.({ animationPlaying: false });
        }
      }
      api.setAppState?.({ animationCurrentTime: playhead });
    }
    this.#lastNow = now;

    this.animations.current.forEach((entity) => {
      const player = entity.write(AnimationPlayer);
      const controller = player.controller;
      if (!controller) {
        return;
      }
      controller.seek(playhead);
      const snapshot = controller.getSnapshot();
      this.applyValues(entity, controller, snapshot);
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

    if (
      isFiniteNumber(values.opacity)
      || isFiniteNumber(values.fillOpacity)
      || isFiniteNumber(values.strokeOpacity)
    ) {
      const opacityPatch: Partial<Opacity> = {};
      if (isFiniteNumber(values.opacity)) {
        opacityPatch.opacity = values.opacity;
      }
      if (isFiniteNumber(values.fillOpacity)) {
        if (entity.has(FillLayers)) {
          const fl = entity.write(FillLayers);
          const layers = [...fl.layers];
          const i = layers.findIndex(isFillLayerEnabled);
          if (i >= 0) {
            layers[i] = {
              ...layers[i]!,
              opacity: values.fillOpacity,
            };
            fl.layers = layers;
          }
        }
      }
      if (isFiniteNumber(values.strokeOpacity)) {
        if (entity.has(StrokeLayers)) {
          const sl = entity.write(StrokeLayers);
          const layers = [...sl.layers];
          const i = layers.findIndex(isFillLayerEnabled);
          if (i >= 0) {
            layers[i] = {
              ...layers[i]!,
              opacity: values.strokeOpacity,
            };
            sl.layers = layers;
          }
        }
      }
      if (Object.keys(opacityPatch).length > 0) {
        safeAddComponent(entity, Opacity, opacityPatch);
      }
    }

    if (typeof values.fill === 'string') {
      if (isGradient(values.fill)) {
        safeAddComponent(entity, FillLayers, {
          layers: [{ type: 'gradient', value: values.fill }],
        });
      } else {
        safeAddComponent(entity, FillLayers, {
          layers: [{ type: 'solid', value: values.fill }],
        });
      }
    }

    if (isFiniteNumber(values.strokeWidth)) {
      safeAddComponent(entity, Stroke, { width: values.strokeWidth });
    }

    if (typeof values.stroke === 'string') {
      if (entity.has(StrokeLayers)) {
        const sl = entity.write(StrokeLayers);
        const layers = sl.layers.map((L) => ({ ...L }));
        const i = layers.findIndex(isFillLayerEnabled);
        if (i >= 0) {
          const L = layers[i];
          if (L && 'value' in L) {
            layers[i] = { ...L, value: values.stroke };
            sl.layers = layers;
          }
        } else {
          sl.layers = [{ type: 'solid', value: values.stroke }];
        }
      } else {
        safeAddComponent(entity, StrokeLayers, {
          layers: [{ type: 'solid', value: values.stroke }],
        });
      }
      if (!entity.has(Stroke)) {
        safeAddComponent(entity, Stroke, { width: 1 });
      }
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
