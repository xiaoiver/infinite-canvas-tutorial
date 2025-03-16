import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { Transform, GlobalTransform } from '../components';
import {
  SyncSimpleTransforms,
  PropagateTransforms,
  PostStartup,
} from '../systems';

/**
 * The base plugin for handling {@link Transform} components.
 * @see https://github.com/bevyengine/bevy/blob/06cb5c5fd9436f27ec72a8810c1b5ae90be957e4/crates/bevy_transform/src/plugins.rs#L23
 */
export const TransformPlugin: Plugin = (app: App) => {
  component(Transform);
  component(GlobalTransform);
  // component(TransformBundle);

  system(PostStartup)(SyncSimpleTransforms);
  system((s) => s.after(SyncSimpleTransforms))(PropagateTransforms);
};
