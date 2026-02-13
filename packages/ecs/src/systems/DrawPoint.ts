import { System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  FillSolid,
  GlobalTransform,
  Highlighted,
  Input,
  InputPoint,
  Opacity,
  Parent,
  Pen,
  Polyline,
  Renderable,
  Selected,
  Stroke,
  StrokeAttenuation,
  Transform,
  Transformable,
  UI,
  Visibility,
  ZIndex,
  ComputedCameraControl,
  Name,
  Brush,
  HTML,
  HTMLContainer,
} from '../components';
import { isBrowser } from '../utils';

export class DrawPoint extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(ComputedBounds, ComputedCamera, ComputedCameraControl)
          .read.update.and.using(
            Canvas,
            GlobalTransform,
            InputPoint,
            Input,
            Cursor,
            Camera,
            UI,
            Selected,
            Highlighted,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Polyline,
            Brush,
            Visibility,
            ZIndex,
            StrokeAttenuation,
            Transformable,
            Name,
            HTML,
            HTMLContainer,
          ).write,
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
      const pen = api.getAppState().penbarSelected;

      if (pen !== Pen.DRAW_POINT) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      if (input.pointerUpTrigger) {
        if (isBrowser) {
          const { pointerDownCanvasX, pointerDownCanvasY } = camera.read(
            ComputedCameraControl,
          );
          // FIXME: Use the correct event name
          // @ts-ignore
          api.element.dispatchEvent(
            new CustomEvent('ic-point-drawn', {
              detail: {
                x: pointerDownCanvasX,
                y: pointerDownCanvasY,
              },
            }),
          );
        }
      }
    });
  }
}
