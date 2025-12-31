import {
  Camera,
  Canvas,
  ComputedCamera,
  Cursor,
  Input,
  InputPoint,
  Pen,
  RBush,
  System,
} from '@infinite-canvas-tutorial/ecs';
import { LassoTrail } from './lasso-trail';
import {
  ExtendedAPI,
  SVG_NS,
  AnimationFrameHandler,
} from '@infinite-canvas-tutorial/webcomponents';
import { html } from 'lit';
import { msg, str } from '@lit/localize';
export class LassoSystem extends System {
  private readonly canvases = this.query((q) =>
    q.added.and.current.with(Canvas),
  );

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
          .using(Canvas, InputPoint, Input, Cursor)
          .write.and.using(Camera, ComputedCamera, RBush).read,
    );
  }

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      (api as ExtendedAPI).registerPen(
        Pen.LASSO,
        html`<sp-icon-region-select slot="icon"></sp-icon-region-select>`,
        msg(str`Lasso`),
      );
    });

    this.canvases.current.forEach((canvas) => {
      const { inputPoints, api } = canvas.read(Canvas);
      const appState = api.getAppState();
      const pen = appState.penbarSelected;
      const camera = api.getCamera();

      if (pen !== Pen.LASSO) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        this.selections.set(camera.__id, {
          lassoTrail: new LassoTrail(this.handler, api),
          svgSVGElement: document.createElementNS(
            SVG_NS,
            'svg',
          ) as SVGSVGElement,
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
