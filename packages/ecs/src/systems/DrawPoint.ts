import { System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  FillLayers,
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
          .using(ComputedBounds, ComputedCamera)
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
            FillLayers,
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

      const { api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;

      if (pen !== Pen.DRAW_POINT) {
        return;
      }

      const input = canvas.write(Input);
      if (input.pointerUpTrigger && !input.pointerCancelled) {
        if (isBrowser) {
          // CameraControl has already cleared its press coordinates on release.
          const [x, y] = input.pointerDownViewport;
          const point = api.viewport2Canvas({ x, y });
          // FIXME: Use the correct event name
          // @ts-ignore
          api.element.dispatchEvent(
            new CustomEvent('ic-point-drawn', {
              detail: point,
            }),
          );
        }
      }
    });
  }
}
