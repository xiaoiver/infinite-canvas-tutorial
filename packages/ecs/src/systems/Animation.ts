import { System } from '@lastolivegames/becsy';
import {
  AnimationPlayer,
  FillSolid,
  Opacity,
  Stroke,
  Transform,
} from '../components';
import { safeAddComponent } from '..';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDasharray(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1]);
}

export class AnimationSystem extends System {
  animations = this.query((q) =>
    q.current
      .with(AnimationPlayer)
      .using(AnimationPlayer).write
      .using(Transform, Opacity, FillSolid, Stroke).write,
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
        if (isFiniteNumber(values.x)) {
          transform.translation.x = values.x;
        }
        if (isFiniteNumber(values.y)) {
          transform.translation.y = values.y;
        }
        if (isFiniteNumber(values.scale)) {
          transform.scale.x = values.scale;
          transform.scale.y = values.scale;
        }
        if (isFiniteNumber(values.scaleX)) {
          transform.scale.x = values.scaleX;
        }
        if (isFiniteNumber(values.scaleY)) {
          transform.scale.y = values.scaleY;
        }
        if (isFiniteNumber(values.rotation)) {
          transform.rotation = values.rotation;
        }
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
    });
  }
}
