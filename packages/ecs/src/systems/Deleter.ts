import { System } from '@lastolivegames/becsy';
import { Canvas, ToBeDeleted } from '../components';
import { ViewportCulling } from './ViewportCulling';

/** Dispose old entities before applying callbacks that may recreate the same document IDs. */
export class Deleter extends System {
  entities = this.query((q) => q.current.with(ToBeDeleted).usingAll.write);
  viewportCulling = this.attach(ViewportCulling);
  private canvases = this.query((q) => q.current.with(Canvas).read);

  execute() {
    // Resolve every spatial entry before deleting any of its ancestors.
    for (const entity of this.entities.current)
      this.viewportCulling.remove(entity);
    for (const entity of this.entities.current) entity.delete();
    // A callback may destroy its own canvas or another canvas in this frame.
    const apis = this.canvases.current.map((canvas) => canvas.read(Canvas).api);
    for (const api of apis) api?.flushPendingTasks();
    for (const api of apis) api?.flushAfterDeleteTasks();
  }
}
