import { getStrokePoints } from 'perfect-freehand';
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
  Brush,
} from '../components';
import { API } from '../API';
import { BrushSerializedNode, serializeBrushPoints } from '../utils/serialize';
import { distanceBetweenPoints } from '../utils/matrix';
import { DRAW_RECT_Z_INDEX } from '../context';
import { isBrowser } from '../utils';

const BRUSH_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMpSURBVHgB7VZNSBtREJ5sQv6MIdHaGm3THEpjW6o92JjoQW859CJY66HtRYREEA1CqBeLB0UoXqrUgzcPueihVMzFW7VoRUgRakURFRT8gZZi0pIY903nrausloKQjS0lHwz7suzL+3bmm28W4B+D5g/rrEE4f2BPT495ZWXlIfwFMtDW1laSTqe/jY6OIuHz2NjY45mZmQqXy2W8DCKaaDQa6OrqQpvNJubl5WE4HMahoSHc3NxkOzs7r+TnBFARZ0qwt7dXtLGxAcPDw8Ls7Czo9XqYm5sDt9uNHR0d4VQq9YmeY6AiiTMEKO0afuj+/j6Ul5dDb28vRCIRSCaTQjweZ93d3Q8mJiZC9CyCStCdJyAtNL+Xenx8XMjPz4e+vr5H9PM1qARlBlCn02kpzVLqlWCMAWkCDAYDJBKJMrqlBZUEqSSgX11d/eDxeGB6ehpPDubgGdnd3YWjoyOwWq1X19bWIs3NzQ55n2qdYS4oKLhB9U7QGskLUIna2lpOSoqamhokct9DoZBDTQJcD0UktCB1AgqCwCgbrKWlBYuLi6WDFxYWJDKBQIA5nU6+/CLvVaUr+JvYKG41NDQ8EUUxPjk5iYODg9wPWGVlpXT44eGhdLXb7WJ/fz8S2ZeK/RmDZ+EKxR2TyeSrrq5+1tnZ+YJMKEXmdFqOxsZGrKurQxIrknekybxcoGIpuMKtFNcpuOLvzs/Pv21vb0efzydypywtLZWIkHOixWJhlK1lea9qBqWRiZgoSkic3q2treWBgQGuBba0tHSajaamJrG1tVX1UihhpHI46VpGIny3vb2N5AcsGAwyToB8QyoFtWaaJqkLsjSwzEaj8SZd79fX1z+nc3/4/X50OBwiWTQuLi4iueRJKbSQBfC3MlDwvr9H49m/vr4e45OSfrOpqSkkgiIJEquqqq6ByhNTCd4lNirBbbpWjIyMvDk4OBBpcEmjm3Twnu5bIEtZOAHPhlnWhdvr9T4l1/wYi8WihYWFHjhu4wtnIBPB8InF29UOx28sUiQpvlL8vOifZKpYrUyE64PrISWHat8LF4UGLuvDNYcccvjv8Au1hn6W8NMbDwAAAABJRU5ErkJggg==") 4 28, pointer';

export class DrawBrush extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush: BrushSerializedNode;
      points: { x: number; y: number; radius: number }[];
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
            Brush,
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
      const pen = api.getAppState().penbarSelected;

      if (pen !== Pen.BRUSH) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);
      const pressure = input.pressure;

      cursor.value = BRUSH_CURSOR;

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
        selection.points.push({
          x: pointerDownCanvasX,
          y: pointerDownCanvasY,
          radius: pressure,
        });
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

        api.runAtNextTick(() => {
          this.handleBrushing(api, x, y, pressure);
        });
      });

      if (input.key === 'Escape') {
        const { brush } = selection;
        if (brush) {
          api.updateNode(brush, { visibility: 'hidden' }, false);
        }
      }

      if (input.pointerUpTrigger) {
        const { brush } = this.selections.get(camera.__id);

        if (isBrowser && brush.visibility === 'hidden') {
          return;
        }

        // Just click on the canvas, do nothing
        if (!brush || brush.points?.length === 0) {
          return;
        }

        api.runAtNextTick(() => {
          const { stamps, stamp, ...rest } = api.getAppState().penbarBrush;
          api.updateNode(brush, { visibility: 'hidden' }, false);

          const node: BrushSerializedNode = {
            id: uuidv4(),
            type: 'brush',
            version: 0,
            points: brush.points,
            brushStamp: stamp, // Use stamp from current settings
            ...rest,
          };

          api.setAppState({
            penbarSelected: Pen.SELECT,
          });
          api.updateNode(node);
          api.selectNodes([node]);
          api.record();
        });
      }
    });
  }

  private handleBrushing(
    api: API,
    viewportX: number,
    viewportY: number,
    pressure: number,
  ) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);
    const defaultDrawParams = api.getAppState().penbarBrush;
    const { stamps, stamp, ...rest } = defaultDrawParams;

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
          type: 'brush',
          points: '0,0,0',
          visibility: 'hidden',
          zIndex: DRAW_RECT_Z_INDEX,
          ...rest,
        };
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

        selection.points.push({
          x: cx,
          y: cy,
          radius: pressure,
        });
        selection.lastPointInViewport = [viewportX, viewportY];
        if (selection.points.length <= 1) {
          return;
        }

        const strokePoints = getStrokePoints(selection.points);
        api.updateNode(
          brush,
          {
            visibility: 'visible',
            points: serializeBrushPoints(
              strokePoints.map(({ point, pressure }) => ({
                x: point[0],
                y: point[1],
                radius: pressure * rest.strokeWidth,
              })),
            ),
            brushStamp: stamp, // Use stamp from current settings
            ...rest,
          },
          false,
        );
      }
    }
  }
}
