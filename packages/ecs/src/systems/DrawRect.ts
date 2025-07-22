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
import { TRANSFORMER_ANCHOR_STROKE_COLOR } from './RenderTransformer';
import {
  RectSerializedNode,
  TextSerializedNode,
  distanceBetweenPoints,
} from '../utils';
import { DRAW_RECT_Z_INDEX } from '..';

const LABEL_WIDTH = 100;
const LABEL_HEIGHT = 20;
const LABEL_RADIUS = 4;
const LABEL_TOP_MARGIN = 10;

export class DrawRect extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush: RectSerializedNode;
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

      if (pen !== Pen.DRAW_RECT) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'crosshair';

      if (!this.selections.has(camera.__id)) {
        this.selections.set(camera.__id, {
          brush: undefined,
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
          this.handleBrushing(api, x, y);
        });
      });

      if (input.pointerUpTrigger) {
        const { x, y, width, height, brush, label } = this.selections.get(
          camera.__id,
        );

        api.runAtNextTick(() => {
          api.updateNode(brush, { visibility: 'hidden' });
          api.updateNode(label, { visibility: 'hidden' });

          const node: RectSerializedNode = {
            id: uuidv4(),
            type: 'rect',
            x,
            y,
            width,
            height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            fill: '#e0f2ff',
            fillOpacity: 0.5,
            stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
            strokeWidth: 1,
          };
          api.setPen(Pen.SELECT);
          api.updateNode(node);
          api.selectNodes([node]);
          api.record();
        });
      }
    });
  }

  private handleBrushing(api: API, viewportX: number, viewportY: number) {
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
      if (!selection.brush) {
        const brush: RectSerializedNode = {
          id: uuidv4(),
          type: 'rect',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          fill: '#e0f2ff',
          fillOpacity: 0.5,
          stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
          visibility: 'hidden',
          zIndex: DRAW_RECT_Z_INDEX,
          strokeAttenuation: true,
        };
        api.updateNode(brush, undefined, false);
        selection.brush = brush;
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
          zIndex: DRAW_RECT_Z_INDEX,
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
          fill: 'white',
          fontFamily: 'system-ui',
          fontSize: 12,
          textAlign: 'center',
          textBaseline: 'middle',
          sizeAttenuation: true,
          zIndex: DRAW_RECT_Z_INDEX,
        };
        api.updateNode(text, undefined, false);
        selection.text = text;
        api.getEntity(text).add(UI, { type: UIType.LABEL });
      }

      const { x: wx, y: wy } = api.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });

      selection.x = pointerDownCanvasX;
      selection.y = pointerDownCanvasY;
      selection.width = wx - pointerDownCanvasX;
      selection.height = wy - pointerDownCanvasY;

      // when width or height is negative, change the x or y to the opposite side
      if (selection.width < 0) {
        selection.x += selection.width;
        selection.width = -selection.width;
      }
      if (selection.height < 0) {
        selection.y += selection.height;
        selection.height = -selection.height;
      }

      api.updateNode(
        selection.brush,
        {
          visibility: 'visible',
          x: selection.x,
          y: selection.y,
          width: selection.width,
          height: selection.height,
        },
        false,
      );
      api.updateNode(
        selection.label,
        {
          visibility: 'visible',
          x: selection.x + selection.width / 2 - LABEL_WIDTH / 2,
          // Label always appears at the bottom of the brush
          y: selection.y + selection.height + LABEL_TOP_MARGIN,
        },
        false,
      );
      api.updateNode(
        selection.text,
        {
          x: 0,
          y: LABEL_HEIGHT / 2,
          content: `${Math.round(selection.width)}x${Math.round(
            selection.height,
          )}`,
        },
        false,
      );
    }
  }
}
