import { getStroke } from 'perfect-freehand';
import { System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import simplify from 'simplify-js';
import { IPointData } from '@pixi/math';
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
  TesselationMethod,
} from '../components';
import { API } from '../API';
import {
  PathSerializedNode,
  PolylineSerializedNode,
  StrokeAttributes,
} from '../utils/serialize';
import { distanceBetweenPoints } from '../utils/matrix';
import { DRAW_RECT_Z_INDEX } from '../context';
import { serializePoints } from '../utils/serialize';
import { getFlatSvgPathFromStroke, isBrowser } from '../utils';

const PENCIL_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAKOSURBVHgB7VY7jBJRFH2Dk2VgIYp8AobYSEFCY2JpY0NBZ2MtJoSSBAjh0wANnZQmUEJNAR0lgcYWAwQsVLZhlV/4GJCded47wopZ0HVn2G04yQl5P865nzczhBxxxBHSwVxzbicURAa4XC5lt9tNU0o/wu9bGJ/8jwkpYBKJBAfCnzKZDNXr9bRQKMCQfna73dyhTTB+v18FYt1oNEo5juOr1So9PT3lcYzzhzRxRXw0GqEoHQ6H4nht4sshTFyKh8Nhqlar+clkQgVBoDzPiybQDJrIZrO00+m8IzLij8i1Wi0PBmir1RKF0cDGBJbDZDKJWbDZbEoiQxaupB0jb7fbFNZos9kUhTETWAboBaFUKtF6vZ6Hdcm3YmfNUQzZaDREE2hmOp3iupBMJulisTg3Go1PYe2BFAN7G2475VgGLAeURYCrieLfoATP4fxjIEduiL+Kb1KOxHKAASEej4viBoPhBZx/AtTeNPpriW91/WXkcogrvF6vGjv4TsTxIPz3h1gsduviCCafz7/BjmZZlscrdZviYgaKxWImFArRYDB4cPFdr2NmtVoReJCQ2Wz2a5NCQUCXMAxDxuMxsVgsNBKJMMC+1Wp91e/3z2DbVyAeoESiAZxjITKiUql+uwLxwWBAzGazbOIIdsccnc/nPfioIE6nk4Iws1wuxWzkcjmaSqWYQCAgi7gY2I45jcPhsMEzvFoulzWVSoVAvQma8Hg8BOp9ZrfbX/d6PRQ/lyK+zwA+Nh+CiWc+n++lTqd7BD1xAeVga7Xa+3Q6XVQqlVMwJFl8nwHsAQ3wPlANxFfpPeAP4AXwO3AAXAAFIhH7rgyaOFmLs+t9/NrExoikyP9lYN8eWUSP2MZP4geL9VfezEoAAAAASUVORK5CYII=") 4 28, pointer';

export class DrawPencil extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush: PolylineSerializedNode | PathSerializedNode;
      pointsBeforeSimplify: IPointData[];
      points: IPointData[];
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
      const appState = api.getAppState();
      const pen = appState.penbarSelected;
      const { freehand } = appState.penbarPencil;

      if (pen !== Pen.PENCIL) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = PENCIL_CURSOR;

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        this.selections.set(camera.__id, {
          brush: undefined,
          pointsBeforeSimplify: [],
          points: [],
          lastPointInViewport: [0, 0],
        });
        selection = this.selections.get(camera.__id);
      }

      // Clear previous points
      if (input.pointerDownTrigger) {
        selection.pointsBeforeSimplify = [];
        selection.points = [];

        const { pointerDownCanvasX, pointerDownCanvasY } = camera.read(
          ComputedCameraControl,
        );
        selection.pointsBeforeSimplify.push({
          x: pointerDownCanvasX,
          y: pointerDownCanvasY,
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
          this.handleBrushing(api, x, y, appState.penbarPencil);
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

        if (
          isBrowser &&
          (brush as PathSerializedNode).visibility === 'hidden'
        ) {
          return;
        }

        // Just click on the canvas, do nothing
        if (!brush || (brush as PolylineSerializedNode).points?.length === 0) {
          return;
        }

        api.runAtNextTick(() => {
          api.updateNode(brush, { visibility: 'hidden' }, false);

          const node: PathSerializedNode | PolylineSerializedNode = {
            id: uuidv4(),
            version: 0,
            ...appState.penbarPencil,
          };
          const points: [number, number][] = selection.points.map((p) => [
            p.x,
            p.y,
          ]);

          if (freehand) {
            const d = getFlatSvgPathFromStroke(getStroke(points));
            node.type = 'path';
            (node as PathSerializedNode).d = d;
            (node as PathSerializedNode).fill = appState.penbarPencil.stroke;
            (node as PathSerializedNode).strokeWidth = 0;
            (node as PathSerializedNode).tessellationMethod =
              TesselationMethod.LIBTESS;
          } else {
            node.type = 'polyline';
            (node as PolylineSerializedNode).points = serializePoints(points);
          }

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
              new CustomEvent('ic-pencil-drawn', {
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

  private handleBrushing(
    api: API,
    viewportX: number,
    viewportY: number,
    defaultDrawParams: Partial<StrokeAttributes>,
  ) {
    const { freehand } = api.getAppState().penbarPencil;
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);
    const { zoom } = camera.read(ComputedCamera);

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
        brush = freehand
          ? {
            id: uuidv4(),
            type: 'path',
            d: 'M 0 0 L 1 1',
            visibility: 'hidden',
            zIndex: DRAW_RECT_Z_INDEX,
            ...defaultDrawParams,
          }
          : {
            id: uuidv4(),
            type: 'polyline',
            points: '0,0 0,0',
            visibility: 'hidden',
            zIndex: DRAW_RECT_Z_INDEX,
            ...defaultDrawParams,
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

        selection.pointsBeforeSimplify.push({ x: cx, y: cy });
        selection.lastPointInViewport = [viewportX, viewportY];

        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);

        const points: [number, number][] = selection.points.map((p) => [
          p.x,
          p.y,
        ]);

        if (points.length <= 2) {
          return;
        }

        api.updateNode(
          brush,
          freehand
            ? {
              visibility: 'visible',
              d: getFlatSvgPathFromStroke(getStroke(points)),
              ...defaultDrawParams,
              strokeWidth: 0,
              fill: defaultDrawParams.stroke,
              tessellationMethod: TesselationMethod.LIBTESS,
            }
            : {
              visibility: 'visible',
              points: serializePoints(points),
              ...defaultDrawParams,
            },
          false,
        );
      }
    }
  }
}
