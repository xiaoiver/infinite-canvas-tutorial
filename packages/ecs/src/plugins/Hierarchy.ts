/**
 * @see https://github.com/bevyengine/bevy/blob/latest/crates/bevy_hierarchy
 */

import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Children, FractionalIndex, Parent, ZIndex } from '../components';
import { ComputeZIndex, PreUpdate } from '../systems';

// /**
//  * @see https://github.com/bevyengine/bevy/blob/latest/crates/bevy_hierarchy/src/events.rs
//  */
// export enum HierarchyEvent {
//   /**
//    * Fired whenever an [`Entity`] is added as a child to a parent.
//    */
//   CHILD_ADDED,
//   /**
//    * Fired whenever a child [`Entity`] is removed from its parent.
//    */
//   CHILD_REMOVED,
//   /**
//    * Fired whenever a child [`Entity`] is moved to a new parent.
//    */
//   CHILD_MOVED,
// }

export const HierarchyPlugin: Plugin = () => {
  component(Parent);
  component(Children);
  component(ZIndex);
  component(FractionalIndex);

  system(PreUpdate)(ComputeZIndex);
};
