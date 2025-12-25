import { getStroke } from 'perfect-freehand';
import { Entity, System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
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
  SerializedNode,
} from '../utils/serialize';
import { distanceBetweenPoints } from '../utils/matrix';
import { DRAW_RECT_Z_INDEX } from '../context';
import { getFlatSvgPathFromStroke } from '../utils';

const ERASER_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAKTSURBVHgB7ZUxjNJQGMdfMR4qnMggIRKT83RQE3EgYYKNwfEGExIGJi9OLEwyycRAwg6jGziJEFYYCIM6wEAQIRAgIXAuBCGV49rn9/VaUxqKXLkmDvyTf2j7aH//9/W9r4Tstdde2sVseU0/eCgUerlcLguU0u+FQuFUHDMQnSXAW63WGwBTv9/POxwOvlar0W63m9U7hABvt9tv5/M5NZlMF8FgkGazWQqXuVwuR3u9Xl6vEH/hs9mMGo1GLhwOU0lQEV1DrMxcDuc4TjAKxnUJsREuSRkCFiXtdDof5M/YCa4suxyuDNFsNoUQGDiVSnmIRq3M3Gw2c263WwDA1qNqksa8Xi9NJpM0k8m8JxoqsAK3WCycwWDAWdFoNKpaAZ7nhV/ckvBfnmVZGolETuD4YCc4wzAUA2wKIcHr9boA7/f7tFKpfIRjO/jOznAEo9eFUMKhISH8Exw/FgPc2BreaDRO1eBqITCAHF4ul7EjPgU/BBvJtgoEAsf4QLvdzqvBlSHi8Ti2YDX4LXIFMel0OlQsFlcAmyz7j2a4vEsxUPoDm82Gx/y/boQKESgWgRC44JjhcPjZ4/G8g6EZ+Cf4N7mizOAH0HDOsKwYQq0K+HrEV8QNBgNarVa/EI1ll+smBnA6na9gZmwsFlsbYg38G1x/Bj7aBS7pEPzI5XKdYIhEIoEwXuoBUhir1UrH4zE2nK9w/hzvAd8m1yBcE/fAT6ASr0ejURt32WQyofgtQE+nU9wo5/l8Hvf5C/CxCNf0wWFUQtwF38df+ADZfD7f0WKxEAbhnJRKpR+wYEfkcsGdgVmiUWqpMQTO6hCAZoDjudTNLkT/En1OLtfHtQaQxiSwvJUKn1oxhGbwXv+N/gDk8Y8/v/PEpgAAAABJRU5ErkJggg==") 4 28, pointer';

export class DrawEraser extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush: PolylineSerializedNode | PathSerializedNode;
      pointsBeforeSimplify: IPointData[];
      points: IPointData[];
      lastPointInViewport: [number, number];
      selected: Set<Entity>;
      selectedOpacityMap: Map<SerializedNode['id'], number>;
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

      if (pen !== Pen.ERASER) {
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = ERASER_CURSOR;

      let selection = this.selections.get(camera.__id);
      if (!selection) {
        this.selections.set(camera.__id, {
          brush: undefined,
          pointsBeforeSimplify: [],
          points: [],
          lastPointInViewport: [0, 0],
          selected: new Set(),
          selectedOpacityMap: new Map(),
        });
        selection = this.selections.get(camera.__id);
      }

      // Clear previous points
      if (input.pointerDownTrigger) {
        selection.pointsBeforeSimplify = [];
        selection.points = [];
        selection.selected.clear();
        selection.selectedOpacityMap.clear();

        const { pointerDownCanvasX, pointerDownCanvasY } = camera.read(
          ComputedCameraControl,
        );
        selection.pointsBeforeSimplify.push({
          x: pointerDownCanvasX,
          y: pointerDownCanvasY,
        });
      }

      // Cancel erasing
      if (input.key === 'Escape') {
        selection.pointsBeforeSimplify = [];
        selection.points = [];
        selection.selected.clear();
        // restore the opacity of the selected nodes.
        selection.selectedOpacityMap.forEach((opacity, id) => {
          const node = api.getNodeById(id);
          if (node) {
            api.updateNode(node, { opacity });
          }
        });
        selection.selectedOpacityMap.clear();
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
        const { brush, selected } = this.selections.get(camera.__id);

        // Just click on the canvas, do nothing
        if (!brush || (brush as PolylineSerializedNode).points?.length === 0) {
          return;
        }

        api.runAtNextTick(() => {
          api.updateNode(brush, { visibility: 'hidden' }, false);
          api.setAppState({
            penbarSelected: Pen.SELECT,
          });

          const toDelete = Array.from(selected)
            .map((e) => api.getNodeByEntity(e)?.id)
            .filter((id) => id !== undefined);

          if (toDelete.length > 0) {
            // Delete all selected nodes
            api.deleteNodesById(toDelete);
            api.record();
          }
        });
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
          type: 'path',
          d: 'M 0 0 L 1 1',
          visibility: 'hidden',
          zIndex: DRAW_RECT_Z_INDEX,
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

        const selected = api
          .elementsFromBBox(cx, cy, cx, cy)
          .filter((e) => !e.has(UI));
        selected.forEach((e) => selection.selected.add(e));

        selection.selected.forEach((e) => {
          const node = api.getNodeByEntity(e);
          if (node) {
            if (!selection.selectedOpacityMap.has(node.id)) {
              // Save the opacity of the selected nodes.
              selection.selectedOpacityMap.set(
                node.id,
                (node as PathSerializedNode).opacity ?? 1,
              );
            }
            api.updateNode(node, {
              opacity: 0.2,
            });
          }
        });

        selection.pointsBeforeSimplify.push({ x: cx, y: cy });
        selection.lastPointInViewport = [viewportX, viewportY];

        // choose tolerance based on the camera zoom level
        selection.points = selection.pointsBeforeSimplify.slice(-4);

        // Clear pointsBeforeSimplify after 2 seconds
        // setTimeout(() => {
        //   selection.pointsBeforeSimplify = [];
        // }, 2000);

        const points: [number, number][] = selection.points.map((p) => [
          p.x,
          p.y,
        ]);

        if (points.length <= 2) {
          return;
        }

        api.updateNode(
          brush,
          {
            visibility: 'visible',
            d: getFlatSvgPathFromStroke(
              getStroke(points, {
                thinning: 0.2,
              }),
            ),
            strokeWidth: 0,
            fill: 'grey',
            tessellationMethod: TesselationMethod.LIBTESS,
          },
          false,
        );
      }
    }
  }
}
