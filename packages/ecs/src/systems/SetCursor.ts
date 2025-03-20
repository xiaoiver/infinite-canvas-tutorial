import { System } from '@lastolivegames/becsy';
import { Canvas, Cursor } from '../components';
import { Last, Update } from '..';

export class SetCursor extends System {
  private readonly cursors = this.query(
    (q) => q.addedOrChanged.with(Cursor).trackWrites,
  );

  constructor() {
    super();
    this.schedule((s) => s.after(Update).before(Last));
    this.query((q) => q.using(Canvas).read);
  }

  execute() {
    this.cursors.addedOrChanged.forEach((entity) => {
      const cursor = entity.read(Cursor);
      const { element } = entity.read(Canvas);

      if (element instanceof HTMLCanvasElement) {
        element.style.cursor = cursor.value;
      }
    });
  }
}
