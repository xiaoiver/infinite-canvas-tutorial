/**
 * @see https://github.com/bevyengine/bevy/blob/latest/crates/bevy_hierarchy
 */

import { component } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from './';
import { Children, Parent } from '../components';

/**
 * @see https://github.com/bevyengine/bevy/blob/latest/crates/bevy_hierarchy/src/events.rs
 */
export enum HierarchyEvent {
  /**
   * Fired whenever an [`Entity`] is added as a child to a parent.
   */
  CHILD_ADDED,
  /**
   * Fired whenever a child [`Entity`] is removed from its parent.
   */
  CHILD_REMOVED,
  /**
   * Fired whenever a child [`Entity`] is moved to a new parent.
   */
  CHILD_MOVED,
}

export class HierarchyPlugin implements Plugin {
  build(app: App) {
    component(Parent);
    component(Children);
    // app.addEvent(HierarchyEvent);
  }
}
