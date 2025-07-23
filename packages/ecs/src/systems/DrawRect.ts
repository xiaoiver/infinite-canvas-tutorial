import { System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  Ellipse,
  FillSolid,
  GlobalTransform,
  Highlighted,
  Input,
  InputPoint,
  Opacity,
  Parent,
  Path,
  Pen,
  Polyline,
  Rect,
  Renderable,
  Selected,
  Stroke,
  StrokeAttenuation,
  Text,
  Transform,
  Transformable,
  UI,
  UIType,
  Visibility,
  ZIndex,
  ComputedCameraControl,
  Name,
  SizeAttenuation,
} from '../components';
import { API } from '../API';
import {
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
} from './RenderTransformer';
import {
  EllipseSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  TextSerializedNode,
  distanceBetweenPoints,
} from '../utils';
import { DRAW_RECT_Z_INDEX } from '../context';

const LABEL_WIDTH = 100;
const LABEL_HEIGHT = 20;
const LABEL_RADIUS = 4;
// const LABEL_TOP_MARGIN = 10;

/**
 * Draw a rectangle, ellipse, line with dragging.
 */
export class DrawRect extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      rectBrush: RectSerializedNode;
      ellipseBrush: EllipseSerializedNode;
      lineBrush: PolylineSerializedNode;
      label: RectSerializedNode;
      text: TextSerializedNode;
      x: number;
      y: number;
      width: number;
      height: number;
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
            Rect,
            Circle,
            Ellipse,
            Text,
            Path,
            Polyline,
            Visibility,
            ZIndex,
            StrokeAttenuation,
            SizeAttenuation,
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

      if (
        pen !== Pen.DRAW_RECT &&
        pen !== Pen.DRAW_ELLIPSE &&
        pen !== Pen.DRAW_LINE
      ) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'crosshair';

      if (!this.selections.has(camera.__id)) {
        this.selections.set(camera.__id, {
          rectBrush: undefined,
          ellipseBrush: undefined,
          lineBrush: undefined,
          label: undefined,
          text: undefined,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
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
          this.handleBrushing(api, pen, x, y);
        });
      });

      if (input.pointerUpTrigger) {
        const {
          x,
          y,
          width,
          height,
          rectBrush,
          ellipseBrush,
          lineBrush,
          label,
        } = this.selections.get(camera.__id);

        const brush =
          pen === Pen.DRAW_RECT
            ? rectBrush
            : pen === Pen.DRAW_ELLIPSE
            ? ellipseBrush
            : lineBrush;

        api.runAtNextTick(() => {
          api.updateNode(brush, { visibility: 'hidden' });
          api.updateNode(label, { visibility: 'hidden' });

          // @ts-expect-error
          const node:
            | RectSerializedNode
            | EllipseSerializedNode
            | PolylineSerializedNode = Object.assign(
            {
              id: uuidv4(),
              type:
                pen === Pen.DRAW_RECT
                  ? 'rect'
                  : pen === Pen.DRAW_ELLIPSE
                  ? 'ellipse'
                  : 'polyline',
              fill: TRANSFORMER_MASK_FILL_COLOR,
              fillOpacity: 0.5,
              stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
              strokeWidth: 1,
            },
            pen === Pen.DRAW_LINE
              ? {
                  points: `${x},${y} ${x + width},${y + height}`,
                }
              : {
                  x,
                  y,
                  width,
                  height,
                },
          );
          api.setPen(Pen.SELECT);
          api.updateNode(node);
          api.selectNodes([node]);
          api.record();
        });
      }
    });
  }

  private handleBrushing(
    api: API,
    pen: Pen,
    viewportX: number,
    viewportY: number,
  ) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);

    const {
      pointerDownViewportX,
      pointerDownViewportY,
      pointerDownCanvasX,
      pointerDownCanvasY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
      distanceBetweenPoints(
        viewportX,
        viewportY,
        pointerDownViewportX,
        pointerDownViewportY,
      ) > 10;

    if (shouldShowSelectionBrush) {
      let brush =
        pen === Pen.DRAW_RECT
          ? selection.rectBrush
          : pen === Pen.DRAW_ELLIPSE
          ? selection.ellipseBrush
          : selection.lineBrush;
      if (!brush) {
        // @ts-expect-error
        brush = Object.assign(
          {
            id: uuidv4(),
            type:
              pen === Pen.DRAW_RECT
                ? 'rect'
                : pen === Pen.DRAW_ELLIPSE
                ? 'ellipse'
                : 'polyline',
            fill: TRANSFORMER_MASK_FILL_COLOR,
            fillOpacity: 0.5,
            stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
            visibility: 'hidden',
            zIndex: DRAW_RECT_Z_INDEX,
            strokeAttenuation: true,
          },
          pen === Pen.DRAW_LINE
            ? {
                points: '0,0 0,0',
              }
            : {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
              },
        );
        api.updateNode(brush, undefined, false);
        if (pen === Pen.DRAW_RECT) {
          selection.rectBrush = brush as RectSerializedNode;
        } else if (pen === Pen.DRAW_ELLIPSE) {
          selection.ellipseBrush = brush as EllipseSerializedNode;
        } else {
          selection.lineBrush = brush as PolylineSerializedNode;
        }
        api.getEntity(brush).add(UI, { type: UIType.BRUSH });

        const label: RectSerializedNode = {
          id: uuidv4(),
          type: 'rect',
          x: 0,
          y: 0,
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
          cornerRadius: LABEL_RADIUS,
          fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
          visibility: 'hidden',
          zIndex: DRAW_RECT_Z_INDEX - 1,
          sizeAttenuation: true,
        };
        api.updateNode(label, undefined, false);
        selection.label = label;
        api.getEntity(label).add(UI, { type: UIType.LABEL });

        const text: TextSerializedNode = {
          id: uuidv4(),
          parentId: label.id,
          type: 'text',
          content: '100x100',
          anchorX: 0,
          anchorY: 0,
          fill: 'black',
          fontFamily: 'system-ui',
          fontSize: 12,
          textAlign: 'center',
          textBaseline: 'middle',
          sizeAttenuation: true,
          zIndex: DRAW_RECT_Z_INDEX - 2,
        };
        api.updateNode(text, undefined, false);
        selection.text = text;
        api.getEntity(text).add(UI, { type: UIType.LABEL });
      }

      const { x: cx, y: cy } = api.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });

      let x = pointerDownCanvasX;
      let y = pointerDownCanvasY;
      let width = cx - x;
      let height = cy - y;

      if (pen !== Pen.DRAW_LINE) {
        // when width or height is negative, change the x or y to the opposite side
        if (width < 0) {
          x += width;
          width = -width;
        }
        if (height < 0) {
          y += height;
          height = -height;
        }
      }

      api.updateNode(
        brush,
        pen === Pen.DRAW_LINE
          ? {
              visibility: 'visible',
              points: `${x},${y} ${cx},${cy}`,
            }
          : {
              visibility: 'visible',
              x,
              y,
              width,
              height,
            },
        false,
      );

      api.updateNode(
        selection.label,
        {
          visibility: 'visible',
          x: x + width / 2 - LABEL_WIDTH / 2,
          // Label always appears at the bottom of the brush
          y: y + height - LABEL_HEIGHT / 2,
        },
        false,
      );
      api.updateNode(
        selection.text,
        {
          x: 0,
          y: 0,
          content: `${Math.round(width)}x${Math.round(height)}`,
        },
        false,
      );

      // Update the selection state
      selection.x = x;
      selection.y = y;
      selection.width = width;
      selection.height = height;
    }
  }
}
