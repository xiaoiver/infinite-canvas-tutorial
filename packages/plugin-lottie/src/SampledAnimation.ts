import {
  AnimationController,
  type AnimationFrameValues,
  type AnimationOptions,
  type Keyframe,
} from '@infinite-canvas-tutorial/ecs';

/** Sample procedural geometry/transforms and regular paint on one ECS controller. */
export class SampledAnimation extends AnimationController {
  constructor(
    keyframes: Keyframe[],
    options: AnimationOptions,
    private properties: string[],
    private sample: (
      time: number,
      values: AnimationFrameValues,
    ) => AnimationFrameValues,
  ) {
    super(keyframes.length ? keyframes : [{ offset: 0 }], options);
  }

  getAnimatedProperties() {
    return [...new Set([...super.getAnimatedProperties(), ...this.properties])];
  }

  getCurrentValues(snapshot = this.getSnapshot()) {
    const values = super.getCurrentValues(snapshot);
    if (!values) return null;
    const progress =
      snapshot.direction === 'forward'
        ? snapshot.progress
        : 1 - snapshot.progress;
    return this.sample(progress * this.getOptions().duration, values);
  }
}
