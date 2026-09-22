import { field, Type } from '@lastolivegames/becsy';
import { AnimationController, AnimationOptions, Keyframe } from '../../animation';

export class AnimationPlayer {
  @field({ type: Type.object, default: null }) declare controller: AnimationController | null;

  constructor(
    props?: { keyframes: Keyframe[]; options: AnimationOptions } | { controller: AnimationController },
  ) {
    if (!props) {
      this.controller = null;
      return;
    }
    if ('controller' in props) {
      this.controller = props.controller;
    } else {
      this.controller = new AnimationController(props.keyframes, props.options);
    }
  }
}
