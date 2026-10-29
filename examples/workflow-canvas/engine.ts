import {
  API,
  App,
  Canvas,
  Theme,
  ThemeMode,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillLayers,
  StrokeLayers,
  Stroke,
  Rect,
  Polyline,
  Path,
  ComputedPoints,
  Visibility,
  Name,
  DropShadow,
  ZIndex,
  Opacity,
  GlobalTransform,
  VectorNetwork,
  Circle,
  Ellipse,
  Commands,
  ComputeZIndex,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  CheckboardStyle,
  StrokeAttenuation,
  type SerializedNode,
  inferXYWidthHeight,
} from '@infinite-canvas-tutorial/ecs';
import {
  edgePath,
  type Graph,
  type View,
  type WorkflowNode,
  type NodeKind,
} from './graph';

type Point = { x: number; y: number };
export interface ConnectionSnapshot {
  id: string;
  fromId: string;
  toId: string;
  start: Point;
  end: Point;
  sourcePort: Point;
  targetPort: Point;
}

export interface FrameSample {
  elapsed: number;
  completedAt: number;
}

export async function createEngine(
  element: HTMLCanvasElement,
  textures: Record<NodeKind, string>,
) {
  let api: API;
  let disposed = false;
  let pendingView: View | undefined;
  let viewQueued = false;
  const samples: FrameSample[] = [];
  let frameCount = 0;
  class Bootstrap extends System {
    access = this.query(
      (q) =>
        q.using(
          Canvas,
          Theme,
          Grid,
          Camera,
          Parent,
          Children,
          Transform,
          Renderable,
          FillLayers,
          StrokeLayers,
          Stroke,
          Rect,
          Polyline,
          Path,
          Visibility,
          Name,
          DropShadow,
          ZIndex,
          Opacity,
          GlobalTransform,
          StrokeAttenuation,
          VectorNetwork,
          Circle,
          Ellipse,
        ).write,
    );
    initialize() {
      api = new API(new DefaultStateManagement(), new Commands(this));
      api.createCanvas({
        element,
        width: element.clientWidth,
        height: element.clientHeight,
        devicePixelRatio: Math.min(devicePixelRatio, 2),
      });
      api.createCamera({ x: 0, y: 0, zoom: 1 });
      api.setAppState({
        checkboardStyle: CheckboardStyle.DOTS,
        themeMode: ThemeMode.DARK,
        theme: {
          mode: ThemeMode.DARK,
          colors: { dark: { background: '#171b18', grid: '#21271f' } },
        },
      });
    }
  }
  const app = new App({ maxEntities: 16384 }).addPlugins(
    ...DefaultPlugins,
    () => {
      system(PreStartUp)(Bootstrap);
      system((s) => s.before(ComputeZIndex))(Bootstrap);
    },
  );
  await app.run();
  // Measure completed engine frames, not an unrelated UI requestAnimationFrame.
  // elapsed includes world.execute's async work; it is not GPU execution time.
  const execute = app.world.execute.bind(app.world);
  app.world.execute = async (...args: Parameters<typeof execute>) => {
    const start = performance.now();
    await execute(...args);
    const completedAt = performance.now();
    frameCount++;
    samples.push({ elapsed: completedAt - start, completedAt });
    while (samples[0]?.completedAt < completedAt - 30000) samples.shift();
  };
  const mutate = (callback: (editor: API) => void) =>
    api.edit(callback, { capture: 'NEVER' });
  const card = (node: WorkflowNode): SerializedNode => ({
    id: node.id,
    type: 'rect',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zIndex: 2,
    fills: [{ type: 'image', value: textures[node.kind] }],
    editable: false,
  });
  const edge = (
    id: string,
    from: WorkflowNode,
    to: WorkflowNode,
  ): SerializedNode => {
    const path: SerializedNode = {
      id,
      type: 'path',
      d: edgePath(from, to),
      zIndex: 0,
      fills: [],
      strokes: [{ type: 'solid', value: '#7d9870' }],
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      editable: false,
    };
    // Creation normalizes world-space paths into local geometry + translation.
    // Updates must use that same representation, including the new translation.
    inferXYWidthHeight(path);
    return path;
  };
  let current: Graph | undefined;
  let selected: string | undefined;
  function selectionNode(node: WorkflowNode): SerializedNode {
    return {
      id: 'selection',
      type: 'rect',
      visibility: 'visible',
      x: node.x - 3,
      y: node.y - 3,
      width: node.width + 6,
      height: node.height + 6,
      cornerRadius: 13,
      zIndex: 1,
      fills: [{ type: 'solid', value: '#c8ee9c' }],
      editable: false,
    };
  }
  function flushView() {
    if (viewQueued || disposed) return;
    viewQueued = true;
    // Camera navigation is transient state, so do not capture the entire
    // document into a history snapshot on every animation frame.
    api.runAtNextTick(() => {
      viewQueued = false;
      const view = pendingView;
      pendingView = undefined;
      if (view && !disposed)
        api.setAppState({
          cameraX: view.x,
          cameraY: view.y,
          cameraZoom: view.zoom,
        });
    });
  }
  return {
    samples,
    get frameCount() {
      return frameCount;
    },
    counts() {
      const nodes = api.getNodes();
      return {
        nodes: nodes.filter((n) => n.id.startsWith('node-')).length,
        edges: nodes.filter((n) => n.id.startsWith('edge-')).length,
      };
    },
    // Read the same sampled geometry and world transforms used for rendering.
    // This keeps interaction tests independent of the input path strings.
    connections(): ConnectionSnapshot[] {
      return (current?.edges.slice(0, 6) ?? []).flatMap((connection) => {
        const pathNode = api.getNodeById(connection.id);
        const fromNode = api.getNodeById(connection.from);
        const toNode = api.getNodeById(connection.to);
        const path = pathNode && api.getEntity(pathNode);
        const from = fromNode && api.getEntity(fromNode);
        const to = toNode && api.getEntity(toNode);
        if (!path?.has(ComputedPoints) || !from || !to) return [];
        const points = path.read(ComputedPoints).points?.[0];
        if (!points?.length) return [];
        const worldPoint = (
          matrix: GlobalTransform['matrix'],
          x: number,
          y: number,
        ): Point => ({
          x: matrix.m00 * x + matrix.m10 * y + matrix.m20,
          y: matrix.m01 * x + matrix.m11 * y + matrix.m21,
        });
        const start = points[0];
        const end = points[points.length - 1];
        const matrix = path.read(GlobalTransform).matrix;
        return [
          {
            id: connection.id,
            fromId: connection.from,
            toId: connection.to,
            start: worldPoint(matrix, start[0], start[1]),
            end: worldPoint(matrix, end[0], end[1]),
            sourcePort: worldPoint(
              from.read(GlobalTransform).matrix,
              from.read(Rect).width - 3,
              46,
            ),
            targetPort: worldPoint(to.read(GlobalTransform).matrix, 3, 46),
          },
        ];
      });
    },
    async load(graph: Graph) {
      const previous = current;
      const hadSelection = Boolean(selected);
      current = graph;
      selected = undefined;
      const byId = new Map(graph.nodes.map((n) => [n.id, n]));
      const nodes = [
        ...graph.edges.map((e) =>
          edge(e.id, byId.get(e.from)!, byId.get(e.to)!),
        ),
        ...graph.nodes.map(card),
      ];
      const nextIds = new Set(nodes.map((n) => n.id));
      const removed = previous
        ? [...previous.nodes, ...previous.edges]
            .map((n) => n.id)
            .filter((id) => !nextIds.has(id))
        : [];
      // Becsy's default per-frame shape log is bounded. Each logical shape adds
      // several ECS components, so large scene changes must span engine frames.
      if (hadSelection)
        await mutate((editor) =>
          editor.updateNodes([
            { id: 'selection', type: 'rect', zIndex: 1, visibility: 'hidden' },
          ]),
        );
      for (let i = 0; i < removed.length; i += 128) {
        if (disposed) return;
        await mutate((editor) =>
          editor.deleteNodesById(removed.slice(i, i + 128)),
        );
      }
      for (let i = 0; i < nodes.length; i += 128) {
        if (disposed) return;
        await mutate((editor) => editor.updateNodes(nodes.slice(i, i + 128)));
      }
    },
    view(view: View) {
      pendingView = { ...view };
      void flushView();
    },
    resize(width: number, height: number) {
      return mutate((editor) => editor.resizeCanvas(width, height));
    },
    async select(node?: WorkflowNode) {
      const hadSelection = Boolean(selected);
      selected = node?.id;
      await mutate((editor) => {
        if (node) editor.updateNodes([selectionNode(node)]);
        else if (hadSelection)
          editor.updateNodes([
            { id: 'selection', type: 'rect', zIndex: 1, visibility: 'hidden' },
          ]);
      });
    },
    move(node: WorkflowNode) {
      const byId = new Map(current!.nodes.map((n) => [n.id, n]));
      // The UI may already hold a later pointer position. Keep the card and
      // every attached curve on the same immutable queued movement snapshot.
      byId.set(node.id, node);
      const attached = current!.edges.filter(
        (e) => e.from === node.id || e.to === node.id,
      );
      const updates = [
        card(node),
        ...attached.map((e) => edge(e.id, byId.get(e.from)!, byId.get(e.to)!)),
        ...(selected === node.id ? [selectionNode(node)] : []),
      ];
      return mutate((editor) => editor.updateNodes(updates));
    },
    async dispose() {
      disposed = true;
      await app.exit();
      Object.values(textures).forEach((url) => URL.revokeObjectURL(url));
    },
  };
}
export type Engine = Awaited<ReturnType<typeof createEngine>>;
