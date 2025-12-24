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
  Marker,
} from '../components';
import { API } from '../API';
import {
  EllipseSerializedNode,
  FillAttributes,
  PolylineSerializedNode,
  RectSerializedNode,
  RoughAttributes,
  RoughEllipseSerializedNode,
  RoughRectSerializedNode,
  StrokeAttributes,
  TextSerializedNode,
  distanceBetweenPoints,
  snapToGrid,
} from '../utils';
import { DRAW_RECT_Z_INDEX } from '../context';

// const LABEL_WIDTH = 100;
// const LABEL_HEIGHT = 20;
// const LABEL_RADIUS = 4;
// const LABEL_TOP_MARGIN = 10;

const PEN_TO_TYPE = {
  [Pen.DRAW_RECT]: 'rect',
  [Pen.DRAW_ELLIPSE]: 'ellipse',
  [Pen.DRAW_LINE]: 'polyline',
  [Pen.DRAW_ARROW]: 'polyline',
  [Pen.DRAW_ROUGH_RECT]: 'rough-rect',
  [Pen.DRAW_ROUGH_ELLIPSE]: 'rough-ellipse',
} as const;

/**
 * Draw a rectangle, ellipse, line with dragging.
 */
export class DrawRect extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      rectBrush: RectSerializedNode;
      roughRectBrush: RoughRectSerializedNode;
      roughEllipseBrush: RoughEllipseSerializedNode;
      ellipseBrush: EllipseSerializedNode;
      lineBrush: PolylineSerializedNode;
      arrowBrush: PolylineSerializedNode;
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
            Marker,
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
      const appState = api.getAppState();
      const pen = appState.penbarSelected;
      const defaultDrawParams: Record<
        | Pen.DRAW_RECT
        | Pen.DRAW_ELLIPSE
        | Pen.DRAW_LINE
        | Pen.DRAW_ARROW
        | Pen.DRAW_ROUGH_RECT
        | Pen.DRAW_ROUGH_ELLIPSE,
        Partial<RoughAttributes & StrokeAttributes & FillAttributes>
      > = {
        [Pen.DRAW_RECT]: appState.penbarDrawRect,
        [Pen.DRAW_ELLIPSE]: appState.penbarDrawEllipse,
        [Pen.DRAW_LINE]: appState.penbarDrawLine,
        [Pen.DRAW_ARROW]: appState.penbarDrawArrow,
        [Pen.DRAW_ROUGH_RECT]: appState.penbarDrawRoughRect,
        [Pen.DRAW_ROUGH_ELLIPSE]: appState.penbarDrawRoughEllipse,
      };

      if (
        pen !== Pen.DRAW_RECT &&
        pen !== Pen.DRAW_ELLIPSE &&
        pen !== Pen.DRAW_LINE &&
        pen !== Pen.DRAW_ARROW &&
        pen !== Pen.DRAW_ROUGH_RECT &&
        pen !== Pen.DRAW_ROUGH_ELLIPSE
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
          arrowBrush: undefined,
          roughRectBrush: undefined,
          roughEllipseBrush: undefined,
          label: undefined,
          text: undefined,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
      }

      if (input.key === 'Escape') {
        // TODO: cancel drawing rect
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
          this.handleBrushing(api, pen, x, y, defaultDrawParams[pen]);
        });
      });

      if (input.pointerUpTrigger) {
        const {
          x,
          y,
          width,
          height,
          rectBrush,
          roughRectBrush,
          roughEllipseBrush,
          ellipseBrush,
          lineBrush,
          arrowBrush,
          // label,
        } = this.selections.get(camera.__id);

        const brush =
          pen === Pen.DRAW_RECT
            ? rectBrush
            : pen === Pen.DRAW_ROUGH_RECT
            ? roughRectBrush
            : pen === Pen.DRAW_ROUGH_ELLIPSE
            ? roughEllipseBrush
            : pen === Pen.DRAW_ELLIPSE
            ? ellipseBrush
            : pen === Pen.DRAW_LINE
            ? lineBrush
            : arrowBrush;

        // Just click on the canvas, do nothing
        if (!brush || (width === 0 && height === 0)) {
          return;
        }

        api.runAtNextTick(() => {
          api.updateNode(brush, { visibility: 'hidden' }, false);
          // api.updateNode(label, { visibility: 'hidden' }, false);

          const node:
            | RectSerializedNode
            | EllipseSerializedNode
            | RoughEllipseSerializedNode
            | RoughRectSerializedNode
            | PolylineSerializedNode = Object.assign(
            {
              id: uuidv4(),
              type: PEN_TO_TYPE[pen],
            },
            defaultDrawParams[pen],
            pen === Pen.DRAW_LINE || pen === Pen.DRAW_ARROW
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
    pen: Pen,
    viewportX: number,
    viewportY: number,
    defaultDrawParams: Partial<
      RoughAttributes & StrokeAttributes & FillAttributes
    >,
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
          : pen === Pen.DRAW_ROUGH_RECT
          ? selection.roughRectBrush
          : pen === Pen.DRAW_ELLIPSE
          ? selection.ellipseBrush
          : pen === Pen.DRAW_LINE
          ? selection.lineBrush
          : pen === Pen.DRAW_ROUGH_ELLIPSE
          ? selection.roughEllipseBrush
          : selection.arrowBrush;
      if (!brush) {
        // @ts-expect-error
        brush = Object.assign(
          {
            id: uuidv4(),
            type: PEN_TO_TYPE[pen],
            visibility: 'hidden',
            zIndex: DRAW_RECT_Z_INDEX,
            strokeAttenuation: true,
          },
          pen === Pen.DRAW_LINE || pen === Pen.DRAW_ARROW
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
        } else if (pen === Pen.DRAW_ROUGH_RECT) {
          selection.roughRectBrush = brush as RoughRectSerializedNode;
        } else if (pen === Pen.DRAW_ELLIPSE) {
          selection.ellipseBrush = brush as EllipseSerializedNode;
        } else if (pen === Pen.DRAW_LINE) {
          selection.lineBrush = brush as PolylineSerializedNode;
        } else if (pen === Pen.DRAW_ROUGH_ELLIPSE) {
          selection.roughEllipseBrush = brush as RoughEllipseSerializedNode;
        } else {
          selection.arrowBrush = brush as PolylineSerializedNode;
        }
        api.getEntity(brush).add(UI, { type: UIType.BRUSH });

        // const label: RectSerializedNode = {
        //   id: uuidv4(),
        //   type: 'rect',
        //   x: 0,
        //   y: 0,
        //   width: LABEL_WIDTH,
        //   height: LABEL_HEIGHT,
        //   cornerRadius: LABEL_RADIUS,
        //   fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
        //   visibility: 'hidden',
        //   zIndex: DRAW_RECT_Z_INDEX - 1,
        //   sizeAttenuation: true,
        // };
        // api.updateNode(label, undefined, false);
        // selection.label = label;
        // api.getEntity(label).add(UI, { type: UIType.LABEL });

        // const text: TextSerializedNode = {
        //   id: uuidv4(),
        //   parentId: label.id,
        //   type: 'text',
        //   content: '100x100',
        //   anchorX: 0,
        //   anchorY: 0,
        //   fill: 'black',
        //   fontFamily: 'system-ui',
        //   fontSize: 12,
        //   textAlign: 'center',
        //   textBaseline: 'middle',
        //   sizeAttenuation: true,
        //   zIndex: DRAW_RECT_Z_INDEX - 2,
        // };
        // api.updateNode(text, undefined, false);
        // selection.text = text;
        // api.getEntity(text).add(UI, { type: UIType.LABEL });
      }

      let { x: cx, y: cy } = api.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });
      let x = pointerDownCanvasX;
      let y = pointerDownCanvasY;

      const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState();
      if (snapToPixelGridEnabled) {
        x = snapToGrid(x, snapToPixelGridSize);
        y = snapToGrid(y, snapToPixelGridSize);
        cx = snapToGrid(cx, snapToPixelGridSize);
        cy = snapToGrid(cy, snapToPixelGridSize);
      }

      let width = cx - x;
      let height = cy - y;

      if (pen !== Pen.DRAW_LINE && pen !== Pen.DRAW_ARROW) {
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
        pen === Pen.DRAW_LINE || pen === Pen.DRAW_ARROW
          ? {
              ...defaultDrawParams,
              visibility: 'visible',
              points: `${x},${y} ${cx},${cy}`,
            }
          : {
              ...defaultDrawParams,
              visibility: 'visible',
              x,
              y,
              width,
              height,
            },
        false,
      );

      // api.updateNode(
      //   selection.label,
      //   {
      //     visibility: 'visible',
      //     x: x + width / 2 - LABEL_WIDTH / 2,
      //     // Label always appears at the bottom of the brush
      //     y: y + height - LABEL_HEIGHT / 2,
      //   },
      //   false,
      // );
      // api.updateNode(
      //   selection.text,
      //   {
      //     x: 0,
      //     y: 0,
      //     content: `${Math.round(width)}x${Math.round(height)}`,
      //   },
      //   false,
      // );

      // Update the selection state
      selection.x = x;
      selection.y = y;
      selection.width = width;
      selection.height = height;
    }
  }
}
