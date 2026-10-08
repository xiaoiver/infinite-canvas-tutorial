import { v4 as uuidv4 } from 'uuid';
import {
  API,
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
  Highlighted,
  isBrowser,
  TesselationMethod,
  PathSerializedNode,
  updateComputedPoints,
  updateGlobalTransform,
} from '@infinite-canvas-tutorial/ecs';
import { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
import { LassoTrail } from './lasso-trail';
import { isValidLassoPath, selectByLassoPath } from './utils';

interface LassoSelection {
  lassoTrail: LassoTrail;
  svgSVGElement: SVGSVGElement;
  removeCleanup: () => void;
  mode?: 'select' | 'draw';
  previewIds: string[];
}

export class LassoSystem extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<number, LassoSelection>();

  private readonly handler = new AnimationFrameHandler();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(Cursor, Highlighted)
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
          this.clearPreview(api, selection);
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
          previewIds: [],
          removeCleanup: api.onDestroy(() => {
            const current = this.selections.get(cameraId);
            current?.lassoTrail.clearTrails();
            current?.svgSVGElement.remove();
            this.selections.delete(cameraId);
          }),
        });
        selection = this.selections.get(cameraId);

        // The trail uses canvas viewport coordinates and must not occupy space
        // in the overlay layer, even after its path has been cleared.
        Object.assign(selection.svgSVGElement.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          overflow: 'visible',
        });

        api.getSvgLayer().appendChild(selection.svgSVGElement);
      }

      const trail = selection.lassoTrail;
      const mode = appState.penbarLasso.mode ?? 'select';
      // Cancellation must precede pointerup (pinch can set both in one frame).
      if (input.key === 'Escape' || input.pointerCancelled) {
        trail.clearTrails();
        this.clearPreview(api, selection);
        if (input.key === 'Escape' && appState.layersLassoing.length > 0) {
          void api.edit(() => api.cancelLasso());
        }
        return;
      }
      if (trail.hasCurrentTrail && selection.mode !== mode) {
        trail.clearTrails();
        this.clearPreview(api, selection);
      }
      if (input.pointerDownTrigger && input.pointerButton === 0) {
        const [x, y] = input.pointerDownViewport;
        selection.mode = mode;
        trail.start(selection.svgSVGElement);
        trail.startPath(x, y);
      }
      if (!trail.hasCurrentTrail) return;

      const [x, y] = input.pointerViewport;
      const pointChanged = !trail.hasLastPoint(x, y);
      if (pointChanged) trail.addPointToPath(x, y);

      // Preview once per input frame, without committing selection/history or
      // rebuilding unchanged outlines on every animation frame.
      if (
        mode === 'select' &&
        !input.pointerUpTrigger &&
        (pointChanged || input.pointerDownTrigger)
      ) {
        const nodes = selectByLassoPath(api, trail.getPoints()).map((entity) =>
          api.getNodeByEntity(entity),
        );
        const ids = nodes.map((node) => node.id);
        const highlighted = new Set(api.getAppState().layersHighlighted);
        if (
          ids.length !== highlighted.size ||
          ids.some((id) => !highlighted.has(id))
        ) {
          api.highlightNodes(nodes);
        }
        selection.previewIds = ids;
      }

      if (input.pointerUpTrigger) {
        const points = trail.getPoints();
        trail.endPath();
        this.clearPreview(api, selection);
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

  private clearPreview(api: API, selection: LassoSelection) {
    if (!selection.previewIds.length) return;
    api.unhighlightNodes(
      selection.previewIds
        .map((id) => api.getNodeById(id))
        .filter((node) => !!node),
    );
    selection.previewIds = [];
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
