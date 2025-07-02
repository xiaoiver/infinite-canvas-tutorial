import { System } from '@lastolivegames/becsy';
import { ToBeDeleted } from '../components';
import { ViewportCulling } from './ViewportCulling';
import { pendingAPICallings } from '..';
/**
 * Deletes entities with the {@link ToBeDeleted} component.
 * @see https://lastolivegames.github.io/becsy/guide/architecture/entities#deleting-entities
 */
export class Deleter extends System {
  // Note the usingAll.write below, which grants write entitlements on all component types.
  entities = this.query((q) => q.current.with(ToBeDeleted).usingAll.write);

  viewportCulling = this.attach(ViewportCulling);

  execute() {
    if (pendingAPICallings.length) {
      pendingAPICallings.forEach((fn) => fn());
      pendingAPICallings.length = 0;
    }

    for (const entity of this.entities.current) {
      /**
       * Execute before node removed from scenegraph.
       */
      this.viewportCulling.remove(entity);

      entity.delete();
    }
  }
}
