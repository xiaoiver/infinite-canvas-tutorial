import { System, component } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { Transform, GlobalTransform } from '../components';
import {
  SyncSimpleTransforms,
  PropagateTransforms,
  PostStartup,
  PostUpdate,
  Last,
} from '../systems';

/**
 * Set enum for the systems relating to transform propagation
 */
export namespace TransformSystem {
  /**
   * Propagates changes in transform to children's [`GlobalTransform`]
   */
  export const TransformPropagate = System.group();
}
TransformSystem.TransformPropagate.schedule((s) =>
  s.after(PostUpdate).before(Last),
);

/**
 * The base plugin for handling {@link Transform} components.
 * @see https://github.com/bevyengine/bevy/blob/06cb5c5fd9436f27ec72a8810c1b5ae90be957e4/crates/bevy_transform/src/plugins.rs#L23
 */
export const TransformPlugin: Plugin = (app: App) => {
  component(Transform);
  component(GlobalTransform);
  // component(TransformBundle);

  app.addSystems(PostStartup, SyncSimpleTransforms, PropagateTransforms);
};
