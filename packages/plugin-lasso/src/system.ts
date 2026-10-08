import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  Canvas,
  ComputedCamera,
  ComputedVisibility,
  Cursor,
  Input,
  Pen,
  RBush,
  Rect,
  Circle,
  Locked,
  System,
  FractionalIndex,
  createSVGElement,
  UI,
  Polyline,
  Ellipse,
  GlobalTransform,
  isBrowser,
  TesselationMethod,
  PathSerializedNode,
  updateComputedPoints,
  updateGlobalTransform,
} from '@infinite-canvas-tutorial/ecs';
import { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
import { LassoTrail } from './lasso-trail';
import { isValidLassoPath, selectByLassoPath } from './utils';
export class LassoSystem extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      lassoTrail: LassoTrail;
      svgSVGElement: SVGSVGElement;
      removeCleanup: () => void;
      mode?: 'select' | 'draw';
    }
  >();

  private readonly handler = new AnimationFrameHandler();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(Cursor)
          .write.and.using(
            Canvas,
            Input,
            ComputedCamera,
            ComputedVisibility,
            RBush,
            Rect,
            Circle,
            Locked,
            UI,
            Polyline,
            Ellipse,
            FractionalIndex,
            GlobalTransform,
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

      const { api } = canvas.read(Canvas);
      const cameraId = camera.__id;
      const appState = api.getAppState();
      const pen = appState.penbarSelected;

      let selection = this.selections.get(cameraId);

      if (
        pen !== Pen.LASSO &&
        appState.penbarLasso.mode !== 'draw' &&
        appState.layersLassoing.length === 0
      ) {
        // Clear selection
        if (selection?.lassoTrail.hasCurrentTrail) {
          selection.lassoTrail.clearTrails();
        }
        return;
      }

      const input = canvas.read(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (!selection) {
        this.selections.set(cameraId, {
          lassoTrail: new LassoTrail(this.handler, api),
          svgSVGElement: createSVGElement('svg') as SVGSVGElement,
          removeCleanup: api.onDestroy(() => {
            const current = this.selections.get(cameraId);
            current?.lassoTrail.clearTrails();
            current?.svgSVGElement.remove();
            this.selections.delete(cameraId);
          }),
        });
        selection = this.selections.get(cameraId);

        // Default is hidden
        selection.svgSVGElement.style.overflow = 'visible';

        api.getSvgLayer().appendChild(selection.svgSVGElement);
      }

      const trail = selection.lassoTrail;
      const mode = appState.penbarLasso.mode ?? 'select';
      // Cancellation must precede pointerup (pinch can set both in one frame).
      if (input.key === 'Escape' || input.pointerCancelled) {
        trail.clearTrails();
        if (input.key === 'Escape' && appState.layersLassoing.length > 0) {
          void api.edit(() => api.cancelLasso());
        }
        return;
      }
      if (trail.hasCurrentTrail && selection.mode !== mode) {
        trail.clearTrails();
      }
      if (input.pointerDownTrigger && input.pointerButton === 0) {
        const [x, y] = input.pointerDownViewport;
        selection.mode = mode;
        trail.start(selection.svgSVGElement);
        trail.startPath(x, y);
      }
      if (!trail.hasCurrentTrail) return;

      const [x, y] = input.pointerViewport;
      if (!trail.hasLastPoint(x, y)) trail.addPointToPath(x, y);

      if (input.pointerUpTrigger) {
        const points = trail.getPoints();
        trail.endPath();
        if (!isValidLassoPath(points)) return;

        if (mode === 'select') {
          const selected = selectByLassoPath(api, points);
          const nodes = selected.map((entity) => api.getNodeByEntity(entity));
          void api.edit(() => {
            api.setAppState({ penbarSelected: Pen.SELECT });
            api.selectNodes(nodes);
          });
          return;
        }
        const { stroke, fills, strokes, strokeWidth, strokeOpacity } =
          appState.penbarLasso;
        if (mode === 'draw' && points?.length > 0) {
          if (isBrowser) {
            const node: PathSerializedNode = {
              id: uuidv4(),
              type: 'path',
              version: 0,
              d: `M${points[0][0]},${points[0][1]}L${points
                .slice(1)
                .map((p) => `${p[0]},${p[1]}`)
                .join(' ')}Z`,
              fills,
              stroke,
              strokes,
              strokeWidth,
              strokeOpacity,
              tessellationMethod: TesselationMethod.LIBTESS,
              zIndex: 0,
            };
            void api.edit(() => {
              api.updateNode(node);
              const parent = api.getNodeById(appState.layersLassoing[0]);
              if (parent) api.reparentNode(node, parent);
              api.setAppState({
                layersLassoing: [],
                penbarLasso: {
                  ...api.getAppState().penbarLasso,
                  mode: undefined,
                },
              });

              const entity = api.getEntity(node);
              if (entity) {
                updateGlobalTransform(entity);
                updateComputedPoints(entity);
              }
              const target =
                'element' in api
                  ? (api.element as EventTarget)
                  : api.getCanvasElement();
              target.dispatchEvent(
                new CustomEvent('ic-lasso-drawn', {
                  detail: {
                    node,
                  },
                }),
              );
            });
          }
        }
      }
    });
  }

  finalize(): void {
    this.selections.forEach(({ lassoTrail, svgSVGElement, removeCleanup }) => {
      removeCleanup();
      lassoTrail.clearTrails();
      svgSVGElement.remove();
    });
    this.selections.clear();
  }
}
