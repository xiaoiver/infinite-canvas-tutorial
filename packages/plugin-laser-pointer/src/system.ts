import {
  Camera,
  Canvas,
  Cursor,
  Input,
  InputPoint,
  Pen,
  System,
  createSVGElement,
} from '@infinite-canvas-tutorial/ecs';
import { LaserTrails } from './laser-trails';
import { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
export class DrawLaserPointer extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

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
          svgSVGElement: createSVGElement('svg') as SVGSVGElement,
        });
        selection = this.selections.get(camera.__id);

        // Default is hidden
        selection.svgSVGElement.style.overflow = 'visible';
        selection.svgSVGElement.style.position = 'absolute';

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
