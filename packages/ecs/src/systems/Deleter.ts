import { System } from '@lastolivegames/becsy';
import { Canvas, ToBeDeleted } from '../components';
import { ViewportCulling } from './ViewportCulling';
/**
 * Deletes entities with the {@link ToBeDeleted} component.
 * @see https://lastolivegames.github.io/becsy/guide/architecture/entities#deleting-entities
 */
export class Deleter extends System {
  // Note the usingAll.write below, which grants write entitlements on all component types.
  entities = this.query((q) => q.current.with(ToBeDeleted).usingAll.write);

  viewportCulling = this.attach(ViewportCulling);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  execute() {
    this.canvases.current.forEach((canvas) => {
      canvas.read(Canvas).api?.flushPendingTasks();
    });

    for (const entity of this.entities.current) {
      /**
       * Execute before node removed from scenegraph.
       */
      this.viewportCulling.remove(entity);
    }
    // Remove every spatial entry while parent links are still available.
    for (const entity of this.entities.current) entity.delete();
  }
}
