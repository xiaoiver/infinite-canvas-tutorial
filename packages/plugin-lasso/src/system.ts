import {
  Camera,
  Canvas,
  ComputedCamera,
  Cursor,
  Input,
  InputPoint,
  Pen,
  RBush,
  Rect,
  Selected,
  System,
  Transformable,
  createSVGElement,
} from '@infinite-canvas-tutorial/ecs';
import { LassoTrail } from './lasso-trail';
import { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
export class LassoSystem extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      lassoTrail: LassoTrail;
      svgSVGElement: SVGSVGElement;
    }
  >();

  private readonly handler = new AnimationFrameHandler();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(Canvas, InputPoint, Input, Cursor, Selected, Transformable)
          .write.and.using(Camera, ComputedCamera, RBush, Rect).read,
    );
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const { inputPoints, api } = canvas.read(Canvas);
      const appState = api.getAppState();
      const pen = appState.penbarSelected;

      let selection = this.selections.get(camera.__id);

      if (pen !== Pen.LASSO) {
        // Clear selection
        if (selection) {
          selection.lassoTrail.clearTrails();
        }
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (!selection) {
        this.selections.set(camera.__id, {
          lassoTrail: new LassoTrail(this.handler, api),
          svgSVGElement: createSVGElement('svg') as SVGSVGElement,
        });
        selection = this.selections.get(camera.__id);

        // Default is hidden
        selection.svgSVGElement.style.overflow = 'visible';

        api.getSvgLayer().appendChild(selection.svgSVGElement);
      }

      // Clear previous points
      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;
        selection.lassoTrail.start(selection.svgSVGElement);
        selection.lassoTrail.startPath(x, y);
      }

      // Cancel erasing
      if (input.key === 'Escape') {
        selection.lassoTrail.clearTrails();
        selection.lassoTrail.stop();
      }

      // Dragging
      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = input.pointerViewport;

        // TODO: If the pointer is not moved, change the selection mode to SELECT
        if (prevX === x && prevY === y) {
          return;
        }

        selection.lassoTrail.addPointToPath(x, y);
      });

      if (input.pointerUpTrigger) {
        selection.lassoTrail.endPath();
      }
    });
  }

  finalize(): void {
    this.selections.forEach(({ lassoTrail, svgSVGElement }) => {
      lassoTrail.stop();
      svgSVGElement.remove();
    });
    this.selections.clear();
  }
}
