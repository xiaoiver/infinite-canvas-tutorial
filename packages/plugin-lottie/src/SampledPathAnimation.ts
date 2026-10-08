import {
  AnimationController,
  type AnimationOptions,
  type Keyframe,
} from '@infinite-canvas-tutorial/ecs';

/** Procedural path geometry sampled by the same ECS controller as its paint. */
export class SampledPathAnimation extends AnimationController {
  constructor(
    keyframes: Keyframe[],
    options: AnimationOptions,
    private samplePath: (time: number) => string,
  ) {
    super(keyframes.length ? keyframes : [{ offset: 0 }], options);
  }

  getAnimatedProperties() {
    return [...new Set([...super.getAnimatedProperties(), 'd'])];
  }

  getCurrentValues(snapshot = this.getSnapshot()) {
    const values = super.getCurrentValues(snapshot);
    if (!values) return null;
    const progress =
      snapshot.direction === 'forward'
        ? snapshot.progress
        : 1 - snapshot.progress;
    return {
      ...values,
      d: this.samplePath(progress * this.getOptions().duration),
    };
  }
}
