import { IPointData } from '@pixi/math';
import { uid } from '../../utils/uid';
import { AbstractPen, PenEvent, PenState } from './AbstractPen';
import { FederatedMouseEvent } from '../../events';
import { Path, PathAttributes } from '../Path';

export type RectPenStyle = Partial<Omit<PathAttributes, 'd'>>;

const sortBBoxPoints = (points: IPointData[]) => {
  const [tl, tr, bl, br] = points.concat().sort((a, b) => b.y - a.y);
  const t = [bl, br].sort((a, b) => a.x - b.x);
  const b = [tl, tr].sort((a, b) => b.x - a.x);
  return t.concat(b);
};

export function isInvalidRect(p: IPointData, q: IPointData, threshold: number) {
  return Math.abs(p.x - q.x) < threshold || Math.abs(p.y - q.y) < threshold;
}

export class RectPen extends AbstractPen {
  #start: { canvas: IPointData; client: IPointData } | undefined;
  #end: { canvas: IPointData; client: IPointData } | undefined;
  #rect: Path | undefined;

  get start() {
    return this.#start;
  }

  get end() {
    return this.#end;
  }

  get state(): PenState {
    if (!this.#start || !this.#end) return null;
    const tr = {
      canvas: this.api.viewport2Canvas({
        x: this.#end.client.x,
        y: this.#start.client.y,
      }),
      client: { x: this.#end.client.x, y: this.#start.client.y },
    };
    const bl = {
      canvas: this.api.viewport2Canvas({
        x: this.#start.client.x,
        y: this.#end.client.y,
      }),
      client: { x: this.#start.client.x, y: this.#end.client.y },
    };

    return {
      // type: this.type,
      points: sortBBoxPoints([
        this.#start.canvas,
        tr.canvas,
        this.#end.canvas,
        bl.canvas,
      ]),
      id: this.id,
      isDrawing: this.isDrawing,
    };
  }

  onMouseDown(e: FederatedMouseEvent) {
    if (this.#start) {
      this.onMouseUp(e);
      return;
    }
    this.isDrawing = true;
    this.#start = {
      canvas: { x: e.global.x, y: e.global.y },
      client: { x: e.client.x, y: e.client.y },
    };
    this.#end = {
      canvas: { x: e.global.x, y: e.global.y },
      client: { x: e.client.x, y: e.client.y },
    };
    this.id = uid('pen');
    this.emit(PenEvent.START, this.state);
  }

  onMouseMove(e: FederatedMouseEvent) {
    if (!this.isDrawing) return;
    this.#end = {
      canvas: { x: e.global.x, y: e.global.y },
      client: { x: e.client.x, y: e.client.y },
    };
    this.emit(PenEvent.MODIFIED, this.state);
  }

  onMouseUp(e: FederatedMouseEvent) {
    if (!this.isDrawing) return;
    if (isInvalidRect(this.#start.client, this.#end.client, 2)) {
      this.emit(PenEvent.CANCEL, this.state);
      this.reset();
      return;
    }
    this.isDrawing = false;
    this.emit(PenEvent.COMPLETE, this.state);
    this.reset();
  }

  onMouseDbClick() {}

  onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Escape') {
      this.emit(PenEvent.CANCEL, this.state);
      this.reset();
      e.stopPropagation();
    }
  }

  reset() {
    super.reset();
    this.#start = undefined;
    this.#end = undefined;
  }

  render(state: PenState, style: RectPenStyle) {
    const { points } = state;
    const [tl, tr, br, bl] = points;

    if (!this.#rect) {
      this.#rect = new Path({
        d: `M${tl.x},${tl.y}L${tr.x},${tr.y}L${br.x},${br.y}L${bl.x},${bl.y}Z`,
        selectable: false,
        ...style,
      });
      this.layer.appendChild(this.#rect);
    }

    this.#rect.d = `M${tl.x},${tl.y}L${tr.x},${tr.y}L${br.x},${br.y}L${bl.x},${bl.y}Z`;
    this.#rect.visible = true;
  }

  hide() {
    if (this.#rect) {
      this.#rect.visible = false;
    }
  }

  destroy() {
    this.#rect = undefined;
  }
}
