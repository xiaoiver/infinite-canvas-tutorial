import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Transform, GlobalTransform } from '../components';
import {
  SyncSimpleTransforms,
  PropagateTransforms,
  PostStartUp,
} from '../systems';

/**
 * The base plugin for handling {@link Transform} components.
 * @see https://github.com/bevyengine/bevy/blob/06cb5c5fd9436f27ec72a8810c1b5ae90be957e4/crates/bevy_transform/src/plugins.rs#L23
 */
export const TransformPlugin: Plugin = () => {
  component(Transform);
  component(GlobalTransform);

  system(PostStartUp)(SyncSimpleTransforms);
  system((s) => s.after(SyncSimpleTransforms))(PropagateTransforms);
};
