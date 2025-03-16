import { System } from '@lastolivegames/becsy';
import { CanvasConfig, Cursor, CursorValue } from '../components';

export class SetCursor extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);
  private readonly cursor = this.singleton.read(Cursor);

  /**
   * Prevent cursor change when it's the same.
   */
  #prevCursor: CursorValue;

  execute() {
    if (this.cursor.value !== this.#prevCursor) {
      this.#prevCursor = this.cursor.value;
      const { canvas } = this.canvasConfig;

      if (canvas instanceof HTMLCanvasElement) {
        canvas.style.cursor = this.cursor.value;
      }
    }
  }
}
