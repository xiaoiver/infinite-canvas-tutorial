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
  RoughPolylineSerializedNode,
  RoughRectSerializedNode,
  StrokeAttributes,
  distanceBetweenPoints,
  isBrowser,
  snapToGrid,
} from '../utils';
import { DRAW_RECT_Z_INDEX } from '../context';
import { DOMAdapter, Event, TRANSFORMER_ANCHOR_STROKE_COLOR } from '..';

const PEN_TO_TYPE = {
  [Pen.DRAW_RECT]: 'rect',
  [Pen.DRAW_ELLIPSE]: 'ellipse',
  [Pen.DRAW_LINE]: 'polyline',
  [Pen.DRAW_ARROW]: 'polyline',
  [Pen.DRAW_ROUGH_RECT]: 'rough-rect',
  [Pen.DRAW_ROUGH_ELLIPSE]: 'rough-ellipse',
  [Pen.DRAW_ROUGH_LINE]: 'rough-polyline',
} as const;

interface DrawRectSelection {
  rectBrush: RectSerializedNode;
  ellipseBrush: EllipseSerializedNode;
  lineBrush: PolylineSerializedNode;
  arrowBrush: PolylineSerializedNode;
  roughRectBrush: RoughRectSerializedNode;
  roughEllipseBrush: RoughEllipseSerializedNode;
  roughLineBrush: RoughPolylineSerializedNode;
  label: HTMLDivElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draw a rectangle, ellipse, line with dragging.
 */
export class DrawRect extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<number, DrawRectSelection>();

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
        | Pen.DRAW_ROUGH_ELLIPSE
        | Pen.DRAW_ROUGH_LINE,
        Partial<RoughAttributes & StrokeAttributes & FillAttributes>
      > = {
        [Pen.DRAW_RECT]: appState.penbarDrawRect,
        [Pen.DRAW_ELLIPSE]: appState.penbarDrawEllipse,
        [Pen.DRAW_LINE]: appState.penbarDrawLine,
        [Pen.DRAW_ARROW]: appState.penbarDrawArrow,
        [Pen.DRAW_ROUGH_RECT]: appState.penbarDrawRoughRect,
        [Pen.DRAW_ROUGH_ELLIPSE]: appState.penbarDrawRoughEllipse,
        [Pen.DRAW_ROUGH_LINE]: appState.penbarDrawRoughLine,
      };

      if (
        pen !== Pen.DRAW_RECT &&
        pen !== Pen.DRAW_ELLIPSE &&
        pen !== Pen.DRAW_LINE &&
        pen !== Pen.DRAW_ARROW &&
        pen !== Pen.DRAW_ROUGH_RECT &&
        pen !== Pen.DRAW_ROUGH_ELLIPSE &&
        pen !== Pen.DRAW_ROUGH_LINE
      ) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'crosshair';

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        selection = {
          rectBrush: undefined,
          ellipseBrush: undefined,
          lineBrush: undefined,
          arrowBrush: undefined,
          roughRectBrush: undefined,
          roughEllipseBrush: undefined,
          roughLineBrush: undefined,
          label: DOMAdapter.get().getDocument().createElement('div'),
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
        this.selections.set(camera.__id, selection);

        if (isBrowser) {
          const { label } = selection;
          initLabel(label);
          api.getSvgLayer().appendChild(selection.label);
        }
      }

      // Dragging
      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = input.pointerViewport;

        // Prev and current point are the same, do nothing
        if (prevX === x && prevY === y) {
          return;
        }

        const isSquare = input.shiftKey;
        api.runAtNextTick(() => {
          this.handleBrushing(api, pen, x, y, defaultDrawParams[pen], isSquare);
        });
      });

      if (input.key === 'Escape') {
        this.hideBrush(api, selection);
      }

      if (input.pointerUpTrigger) {
        const selection = this.selections.get(camera.__id);
        if (isBrowser && selection.label.style.visibility === 'hidden') {
          return;
        }

        const { x, y, width, height } = selection;

        const brush = this.getBrush(selection, pen);

        // Just click on the canvas, do nothing
        if (!brush || (width === 0 && height === 0)) {
          return;
        }

        api.runAtNextTick(() => {
          this.hideBrush(api, selection);

          const node:
            | RectSerializedNode
            | EllipseSerializedNode
            | PolylineSerializedNode
            | RoughEllipseSerializedNode
            | RoughRectSerializedNode
            | RoughPolylineSerializedNode = Object.assign(
              {
                id: uuidv4(),
                type: PEN_TO_TYPE[pen],
                version: 0,
              },
              defaultDrawParams[pen],
              pen === Pen.DRAW_LINE ||
                pen === Pen.DRAW_ARROW ||
                pen === Pen.DRAW_ROUGH_LINE
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

          if (isBrowser) {
            // FIXME: Use the correct event name
            // @ts-ignore
            api.element.dispatchEvent(
              new CustomEvent('ic-rect-drawn', {
                detail: {
                  node,
                },
              }),
            );
          }
        });
      }
    });
  }

  finalize(): void {
    this.selections.forEach((selection) => {
      selection.label.remove();
    });
    this.selections.clear();
  }

  private handleBrushing(
    api: API,
    pen: Pen,
    viewportX: number,
    viewportY: number,
    defaultDrawParams: Partial<
      RoughAttributes & StrokeAttributes & FillAttributes
    >,
    isSquare = false,
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
                  : pen === Pen.DRAW_ROUGH_LINE
                    ? selection.roughLineBrush
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
          pen === Pen.DRAW_LINE ||
            pen === Pen.DRAW_ARROW ||
            pen === Pen.DRAW_ROUGH_LINE
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
        } else if (pen === Pen.DRAW_ROUGH_LINE) {
          selection.roughLineBrush = brush as RoughPolylineSerializedNode;
        } else {
          selection.arrowBrush = brush as PolylineSerializedNode;
        }
        api.getEntity(brush).add(UI, { type: UIType.BRUSH });
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

      const isLine =
        pen === Pen.DRAW_LINE ||
        pen === Pen.DRAW_ARROW ||
        pen === Pen.DRAW_ROUGH_LINE;

      if (!isLine) {
        if (isSquare) {
          if (Math.abs(width) > Math.abs(height)) {
            width = Math.sign(width) * Math.abs(height);
          } else {
            height = Math.sign(height) * Math.abs(width);
          }
        }
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
        pen === Pen.DRAW_LINE ||
          pen === Pen.DRAW_ARROW ||
          pen === Pen.DRAW_ROUGH_LINE
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

      const { label } = selection;

      showLabel(label, api, { x, y, width, height, rotate: isLine });

      // Update the selection state
      selection.x = x;
      selection.y = y;
      selection.width = width;
      selection.height = height;
    }
  }

  private hideBrush(api: API, selection: DrawRectSelection) {
    const pen = api.getAppState().penbarSelected;
    const brush = this.getBrush(selection, pen);
    if (brush) {
      api.updateNode(brush, { visibility: 'hidden' }, false);
    }
    hideLabel(selection.label);
  }

  private getBrush(selection: DrawRectSelection, pen: Pen) {
    const {
      rectBrush,
      roughRectBrush,
      roughEllipseBrush,
      ellipseBrush,
      lineBrush,
      roughLineBrush,
      arrowBrush,
    } = selection;
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
                : pen === Pen.DRAW_ROUGH_LINE
                  ? roughLineBrush
                  : arrowBrush;
    return brush;
  }
}

export function initLabel(label: HTMLDivElement) {
  if (isBrowser) {
    label.style.position = 'absolute';
    label.style.top = '0';
    label.style.left = '0';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.justifyContent = 'center';
    label.style.padding = '4px';
    label.style.borderRadius = '4px';
    label.style.backgroundColor = TRANSFORMER_ANCHOR_STROKE_COLOR;
    label.style.color = 'white';
    label.style.visibility = 'hidden';
  }
}

export function hideLabel(label: HTMLDivElement) {
  if (isBrowser) {
    label.style.visibility = 'hidden';
  }
}

export function showLabel(
  label: HTMLDivElement,
  api: API,
  {
    x,
    y,
    width,
    height,
    rotate,
  }: { x: number; y: number; width: number; height: number; rotate?: boolean },
) {
  if (isBrowser) {
    if (api.getAppState().penbarDrawSizeLabelVisible) {
      label.style.visibility = 'visible';
    }

    label.innerText = `${Math.round(Math.abs(width))} × ${Math.round(
      Math.abs(height),
    )}`;

    if (rotate) {
      const { x: viewportX2, y: viewportY2 } = api.canvas2Viewport({
        x: x + width / 2,
        y: y + height / 2,
      });
      label.style.top = `${viewportY2}px`;
      label.style.left = `${viewportX2}px`;
      const rad = Math.atan2(height, width);
      let deg = rad * (180 / Math.PI);
      if (deg >= 90 && deg <= 180) {
        deg = deg - 180;
      } else if (deg <= -90 && deg >= -180) {
        deg = deg + 180;
      }
      // Rotate the label to the direction of the line
      label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    } else {
      const { x: viewportX2, y: viewportY2 } = api.canvas2Viewport({
        x: x + width / 2,
        y: y + height,
      });
      label.style.top = `${viewportY2}px`;
      label.style.left = `${viewportX2}px`;
      label.style.transform = 'translate(-50%, 8px)';
    }
  }
}
