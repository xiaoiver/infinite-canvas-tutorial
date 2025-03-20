import { Plugin } from '.';
import { Transform, GlobalTransform } from '../components';
import { SyncSimpleTransforms, PropagateTransforms } from '../systems';

/**
 * The base plugin for handling {@link Transform} components.
 * @see https://github.com/bevyengine/bevy/blob/06cb5c5fd9436f27ec72a8810c1b5ae90be957e4/crates/bevy_transform/src/plugins.rs#L23
 */
export const TransformPlugin: Plugin = () => {
  return [
    Transform,
    GlobalTransform,
    SyncSimpleTransforms,
    PropagateTransforms,
  ];
};
