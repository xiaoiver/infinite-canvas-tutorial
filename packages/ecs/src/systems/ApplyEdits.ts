import { System } from '@lastolivegames/becsy';
import { Canvas } from '../components';

/** Apply document edits before geometry, transforms, bounds, and rendering. */
export class ApplyEdits extends System {
  private canvases = this.query((q) => q.current.with(Canvas).usingAll.write);

  execute() {
    // A callback may destroy its own canvas or another canvas in this phase.
    const apis = this.canvases.current.map((canvas) => canvas.read(Canvas).api);
    for (const api of apis) api?.flushPendingEdits();
  }
}
