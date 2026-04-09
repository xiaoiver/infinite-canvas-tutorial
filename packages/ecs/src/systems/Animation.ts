import { System } from '@lastolivegames/becsy';
import {
  AnimationPlayer,
  FillSolid,
  Opacity,
  Path,
  Stroke,
  Transform,
} from '../components';
import { safeAddComponent } from '../history';

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
      .using(AnimationPlayer).write
      .using(Transform, Opacity, FillSolid, Stroke, Path).write,
  );

  execute(): void {
    const now = Date.now();

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
      const values = controller.getCurrentValues(snapshot);
      if (!values) {
        return;
      }

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
        if (hasTransformOrigin && hasTransformAnimation) {
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
        safeAddComponent(entity, Opacity, {
          opacity: isFiniteNumber(values.opacity) ? values.opacity : undefined,
          fillOpacity: isFiniteNumber(values.fillOpacity) ? values.fillOpacity : undefined,
          strokeOpacity: isFiniteNumber(values.strokeOpacity) ? values.strokeOpacity : undefined,
        });
      }

      if (typeof values.fill === 'string') {
        safeAddComponent(entity, FillSolid, { value: values.fill });
      }

      if (isFiniteNumber(values.strokeWidth)) {
        safeAddComponent(entity, Stroke, { width: values.strokeWidth });
      }

      if (typeof values.stroke === 'string') {
        safeAddComponent(entity, Stroke, { color: values.stroke });
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
        safeAddComponent(entity, Path, { d: values.d });
      }
    });
  }
}
