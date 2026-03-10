import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  Canvas,
  ComputedCamera,
  Cursor,
  Input,
  InputPoint,
  Pen,
  RBush,
  Rect,
  Selected,
  System,
  Transformable,
  FractionalIndex,
  createSVGElement,
  UI,
  Polyline,
  Ellipse,
  Transform,
  Marker,
  Name,
  ZIndex,
  Visibility,
  Path,
  Stroke,
  Opacity,
  FillSolid,
  Renderable,
  Children,
  Parent,
  Highlighted,
  GlobalTransform,
  ComputedBounds,
  ComputedPoints,
  isBrowser,
  TesselationMethod,
  PathSerializedNode,
  updateComputedPoints,
  updateGlobalTransform,
} from '@infinite-canvas-tutorial/ecs';
import { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
import { LassoTrail } from './lasso-trail';
export class LassoSystem extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      lassoTrail: LassoTrail;
      svgSVGElement: SVGSVGElement;
    }
  >();

  private readonly handler = new AnimationFrameHandler();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(Canvas,
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
            Path,
            Polyline,
            Visibility,
            ZIndex,
            Transformable,
            Name,
            Marker,
            ComputedPoints,)
          .write.and.using(
            Camera,
            ComputedCamera,
            RBush,
            Rect,
            Polyline,
            Ellipse,
            FractionalIndex,
            ComputedBounds,
          ).read,
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

      let selection = this.selections.get(camera.__id);

      if (pen !== Pen.LASSO && appState.penbarLasso.mode !== 'draw' && appState.layersLassoing.length === 0) {
        // Clear selection
        if (selection) {
          selection.lassoTrail.clearTrails();
        }
        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (!selection) {
        this.selections.set(camera.__id, {
          lassoTrail: new LassoTrail(this.handler, api),
          svgSVGElement: createSVGElement('svg') as SVGSVGElement,
        });
        selection = this.selections.get(camera.__id);

        // Default is hidden
        selection.svgSVGElement.style.overflow = 'visible';

        api.getSvgLayer().appendChild(selection.svgSVGElement);
      }

      // Clear previous points
      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;
        selection.lassoTrail.start(selection.svgSVGElement);
        selection.lassoTrail.startPath(x, y);
      }

      // Cancel erasing
      if (input.key === 'Escape') {
        selection.lassoTrail.clearTrails();
        selection.lassoTrail.stop();

        if (api.getAppState().layersLassoing.length > 0) {
          api.cancelLasso();
        }
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

        selection.lassoTrail.addPointToPath(x, y);
      });

      if (input.pointerUpTrigger) {
        selection.lassoTrail.endPath();

        const { mode, stroke, fill, fillOpacity, strokeWidth, strokeOpacity } = appState.penbarLasso;

        const points = selection.lassoTrail.getPoints();
        if (mode === 'draw' && points?.length > 0) {
          if (isBrowser) {
            const node: PathSerializedNode = {
              id: uuidv4(),
              type: 'path',
              version: 0,
              d: `M${points[0][0]},${points[0][1]}L${points.slice(1).map((p) => `${p[0]},${p[1]}`).join(' ')}Z`,
              fill,
              fillOpacity,
              stroke,
              strokeWidth,
              strokeOpacity,
              tessellationMethod: TesselationMethod.LIBTESS,
              zIndex: 0,
            };
            api.updateNode(node);
            api.reparentNode(node, api.getNodeById(appState.layersLassoing[0]));
            api.setAppState({
              layersLassoing: [],
              penbarLasso: {
                ...api.getAppState().penbarLasso,
                mode: undefined,
              }
            });
            api.record();

            const entity = api.getEntity(node);
            if (entity) {
              updateGlobalTransform(entity);
              updateComputedPoints(entity);
            }
            // FIXME: Use the correct event name
            // @ts-ignore
            api.element.dispatchEvent(
              new CustomEvent('ic-lasso-drawn', {
                detail: {
                  node,
                },
              }),
            );
          }
        }
      }
    });
  }

  finalize(): void {
    this.selections.forEach(({ lassoTrail, svgSVGElement }) => {
      lassoTrail.stop();
      svgSVGElement.remove();
    });
    this.selections.clear();
  }
}
