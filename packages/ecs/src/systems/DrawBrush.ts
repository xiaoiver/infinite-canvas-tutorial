import { System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
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
  UIType,
  Visibility,
  ZIndex,
  ComputedCameraControl,
  Name,
} from '../components';
import { API } from '../API';
import { PolylineSerializedNode } from '../utils/serialize';
import { distanceBetweenPoints } from '../utils/matrix';
import { DRAW_RECT_Z_INDEX } from '../context';
import { serializePoints, TRANSFORMER_ANCHOR_STROKE_COLOR } from '..';

export class DrawBrush extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush: PolylineSerializedNode;
      points: [number, number][];
      lastPointInViewport: [number, number];
    }
  >();

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
            Visibility,
            ZIndex,
            StrokeAttenuation,
            Transformable,
            Name,
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
      const pen = api.getAppState().penbarSelected[0];

      if (pen !== Pen.BRUSH) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'crosshair';

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        this.selections.set(camera.__id, {
          brush: undefined,
          points: [],
          lastPointInViewport: [0, 0],
        });
        selection = this.selections.get(camera.__id);
      }

      // Clear previous points
      if (input.pointerDownTrigger) {
        selection.points = [];

        const { pointerDownCanvasX, pointerDownCanvasY } = camera.read(
          ComputedCameraControl,
        );
        selection.points.push([pointerDownCanvasX, pointerDownCanvasY]);
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

        api.runAtNextTick(() => {
          this.handleBrushing(api, x, y);
        });
      });

      if (input.pointerUpTrigger) {
      }
    });
  }

  private handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);

    const { pointerDownViewportX, pointerDownViewportY } = camera.read(
      ComputedCameraControl,
    );

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
      distanceBetweenPoints(
        viewportX,
        viewportY,
        pointerDownViewportX,
        pointerDownViewportY,
      ) > 10;

    if (shouldShowSelectionBrush) {
      let brush = selection.brush;
      if (!brush) {
        brush = {
          id: uuidv4(),
          type: 'polyline',
          points: '0,0 0,0',
          stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
          visibility: 'hidden',
          zIndex: DRAW_RECT_Z_INDEX,
          strokeAttenuation: true,
        } as PolylineSerializedNode;
        api.updateNode(brush, undefined, false);
        api.getEntity(brush).add(UI, { type: UIType.BRUSH });
        selection.brush = brush;
      }

      if (
        distanceBetweenPoints(
          viewportX,
          viewportY,
          selection.lastPointInViewport[0],
          selection.lastPointInViewport[1],
        ) > 10
      ) {
        const { x: cx, y: cy } = api.viewport2Canvas({
          x: viewportX,
          y: viewportY,
        });

        selection.points.push([cx, cy]);
        selection.lastPointInViewport = [viewportX, viewportY];

        console.log(selection.points);

        api.updateNode(
          brush,
          {
            visibility: 'visible',
            points: serializePoints(selection.points),
          },
          false,
        );
      }
    }
  }
}
