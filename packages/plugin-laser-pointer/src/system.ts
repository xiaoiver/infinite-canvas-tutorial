import {
  Canvas,
  Cursor,
  Input,
  InputPoint,
  Pen,
  System,
} from '@infinite-canvas-tutorial/ecs';
import { AnimationFrameHandler } from './animation-frame-handler';
import { LaserTrails } from './laser-trails';
import { SVG_NS } from './animated-trail';
import { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { html } from 'lit';
import { msg, str } from '@lit/localize';
export class LaserPointerSystem extends System {
  private readonly canvases = this.query((q) =>
    q.added.and.current.with(Canvas),
  );

  private selections = new Map<
    number,
    {
      laserTrails: LaserTrails;
      svgSVGElement: SVGSVGElement;
    }
  >();

  private readonly handler = new AnimationFrameHandler();

  constructor() {
    super();

    this.query((q) => q.using(Canvas, InputPoint, Input, Cursor).write);
  }

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
      (api as ExtendedAPI).registerPen(
        Pen.LASER_POINTER,
        html`<sp-icon-events slot="icon"></sp-icon-events>`,
        msg(str`Laser Pointer`),
      );
    });

    this.canvases.current.forEach((canvas) => {
      const { inputPoints, api } = canvas.read(Canvas);
      const appState = api.getAppState();
      const pen = appState.penbarSelected;
      const camera = api.getCamera();

      if (pen !== Pen.LASER_POINTER) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        this.selections.set(camera.__id, {
          laserTrails: new LaserTrails(this.handler, api),
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
        selection.laserTrails.start(selection.svgSVGElement);
        selection.laserTrails.startPath(x, y);
      }

      // Cancel erasing
      if (input.key === 'Escape') {
        selection.laserTrails.clearTrails();
        selection.laserTrails.stop();
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

        selection.laserTrails.addPointToPath(x, y);
      });

      if (input.pointerUpTrigger) {
        selection.laserTrails.endPath();
      }
    });
  }

  finalize(): void {
    this.selections.forEach(({ laserTrails, svgSVGElement }) => {
      laserTrails.stop();
      svgSVGElement.remove();
    });
    this.selections.clear();
  }
}
