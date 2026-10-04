import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasProvider,
  createCanvasRuntime,
  InfiniteCanvas,
  useCanvasAPI,
  useCanvasActions,
  useCanvasSelector,
  useCanvasNode,
  useCanvasSelection,
  useCanvasHistory,
  useCanvasStatus,
  useCanvasEvent,
  type CanvasActions,
} from '@infinite-canvas-tutorial/react';
import {
  ComputedBounds,
  Deleter,
  FillLayers,
  First,
  GlobalTransform,
  Last,
  MeshPipeline,
  Pen,
  System,
  system,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';

declare global {
  interface Window {
    apis: Record<string, ExtendedAPI>;
    actions: Record<string, CanvasActions>;
    canvasErrors: string[];
    nodeChanges: Record<string, SerializedNode[][]>;
    snapshots: Record<string, unknown[]>;
    setShown: (ids: string[]) => void;
    finishPreparation: Record<string, () => void>;
    boundFill: (id: string) => string | undefined;
    sceneGeometry: (id: string) => { x: number; minX: number; maxX: number };
    initialFrames: Record<
      string,
      {
        committed: number;
        rendered: number;
        x: number;
        minX: number;
        maxX: number;
      }
    >;
  }
}
window.apis = {};
window.actions = {};
window.canvasErrors = [];
window.nodeChanges = {};
window.snapshots = {};
window.initialFrames = {};
window.finishPreparation = {};
const initialCommitFrames: Record<string, number> = {};
let frame = 0;
class InitialFrameStart extends System {
  execute() {
    frame++;
  }
}
class InitialFrameRender extends System {
  access = this.query((q) => q.usingAll.read);
  execute() {
    for (const [id, api] of Object.entries(window.apis)) {
      if (window.initialFrames[id] || initialCommitFrames[id] === undefined)
        continue;
      const node = api.getNodeById(id);
      if (!node) continue;
      const entity = api.getEntity(node);
      const bounds = entity.read(ComputedBounds).geometryWorldBounds;
      window.initialFrames[id] = {
        committed: initialCommitFrames[id],
        rendered: frame,
        x: entity.read(GlobalTransform).matrix.m20,
        minX: bounds.minX,
        maxX: bounds.maxX,
      };
    }
  }
}
const runtime = createCanvasRuntime({
  plugins: new URLSearchParams(location.search).has('initialFrame')
    ? [
        () => {
          system(First)(InitialFrameStart);
          system((s) => s.inAnyOrderWith(s.allSystems))(InitialFrameStart);
          system(Last)(InitialFrameRender);
          system((s) =>
            s.inAnyOrderWith(s.allSystems).after(MeshPipeline).before(Deleter),
          )(InitialFrameRender);
        },
      ]
    : [],
});
window.boundFill = (id) => {
  const api = window.apis[id];
  const layer = api.getEntity(api.getNodeById(id)!).read(FillLayers).layers[0];
  return layer?.type === 'solid' ? layer.value : undefined;
};
window.sceneGeometry = (id) => {
  const api = window.apis[id];
  const entity = api.getEntity(api.getNodeById(id)!);
  const bounds = entity.read(ComputedBounds).geometryWorldBounds;
  return {
    x: entity.read(GlobalTransform).matrix.m20,
    minX: bounds.minX,
    maxX: bounds.maxX,
  };
};

function Toolbar({ id }: { id: string }) {
  const api = useCanvasAPI();
  const actions = useCanvasActions();
  const { status } = useCanvasStatus();
  useCanvasEvent('ic-comment-added', ({ detail }) => {
    const { canvasX, canvasY, viewportX, viewportY } = detail;
    const expected = api!.viewport2Canvas({ x: viewportX, y: viewportY });
    api!.element.dataset.commentProbe = JSON.stringify({
      actual: [canvasX, canvasY],
      expected: [expected.x, expected.y],
    });
  });
  useCanvasEvent('ic-screenshot-downloaded', ({ detail }) => {
    api!.element.dataset.svgProbe = detail.svg;
  });
  useEffect(() => {
    window.actions[id] = actions;
    return () => {
      delete window.actions[id];
    };
  }, [id, actions]);
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const { canUndo, canRedo } = useCanvasHistory();
  const selected = useCanvasSelection();
  const node = useCanvasNode(selected[0]?.id);
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const penbar = useCanvasSelector(
    (state) => state.appState?.penbarVisible ?? true,
  );
  return (
    <div data-testid={`${id}-toolbar`}>
      <output data-testid={`${id}-status`}>{status}</output>
      <output data-testid={`${id}-zoom`}>{zoom}</output>
      <output data-testid={`${id}-selection`}>{selected.length}</output>
      <output data-testid={`${id}-node-width`}>{node?.width ?? ''}</output>
      <output data-testid={`${id}-selected-ids`}>
        {selected.map((node) => node.id).join(',')}
      </output>
      <output data-testid={`${id}-count`}>{count}</output>
      <output data-testid={`${id}-penbar`}>{String(penbar)}</output>
      <button
        data-testid={`${id}-undo`}
        disabled={!canUndo}
        onClick={actions.undo}
      >
        Undo
      </button>
      <button
        data-testid={`${id}-redo`}
        disabled={!canRedo}
        onClick={actions.redo}
      >
        Redo
      </button>
      <button data-testid={`${id}-zoom-in`} onClick={() => api?.zoomTo(2)}>
        Zoom
      </button>
      <button
        data-testid={`${id}-batch-edit`}
        disabled={status !== 'ready'}
        onClick={() => {
          void actions
            .edit((api) => {
              const node = api.getNodeById(id)!;
              api.updateNodes([{ ...node, width: node.width! + 20 }]);
              api.selectNodes([api.getNodeById(id)!]);
            })
            .catch((error: Error) => window.canvasErrors.push(error.message));
        }}
      >
        Edit and select
      </button>
    </div>
  );
}

function Editor() {
  const [shown, setShown] = useState(['left', 'right']);
  useEffect(() => {
    window.setShown = setShown;
  }, []);
  return (
    <>
      {shown.map((id) => (
        <CanvasProvider key={id}>
          <InfiniteCanvas
            runtime={runtime}
            initialAppState={{
              topbarVisible: false,
              penbarSelected: Pen.SELECT,
            }}
            initialNodes={[
              {
                id,
                zIndex: 0,
                type: 'rect',
                x: 50,
                y: 50,
                width: 100,
                height: 80,
                fills: [{ type: 'solid', value: '#ff8400' }],
              },
            ]}
            style={{ width: 400, height: 300, display: 'inline-block' }}
            onReady={
              new URLSearchParams(location.search).has('holdPreparation')
                ? () =>
                    new Promise<void>((resolve) => {
                      window.finishPreparation[id] = resolve;
                    })
                : new URLSearchParams(location.search).has('prepare')
                ? (api, { signal }) =>
                    new Promise<void>((resolve) => {
                      api.runAtNextTick(() => {
                        if (!signal.aborted) api.record();
                        resolve();
                      });
                    })
                : undefined
            }
            onAPIChange={(api) => {
              if (api) window.apis[id] = api;
              else delete window.apis[id];
            }}
            onError={(error) => window.canvasErrors.push(error.message)}
            onNodesChange={(nodes) => {
              if (
                initialCommitFrames[id] === undefined &&
                nodes.some((node) => node.id === id)
              ) {
                initialCommitFrames[id] = frame;
              }
              (window.nodeChanges[id] ??= []).push(structuredClone(nodes));
            }}
            onChange={(snapshot) => {
              (window.snapshots[id] ??= []).push({
                ids: snapshot.nodes.map((node) => node.id),
                selected: [...snapshot.appState.layersSelected],
              });
            }}
          >
            <span slot="penbar-item" data-testid={`${id}-slot`}>
              React slot
            </span>
          </InfiniteCanvas>
          <Toolbar id={id} />
          <NodeProperty id={id} />
        </CanvasProvider>
      ))}
    </>
  );
}

// Keep this consumer separate from Toolbar: selection/history updates must not
// mask a stale object selector by causing a parent render.
function NodeProperty({ id }: { id: string }) {
  const node = useCanvasSelector((state) =>
    state.nodes.find((node) => node.id === id),
  );
  return (
    <output data-testid={`${id}-object-width`}>{node?.width ?? ''}</output>
  );
}

const host = document.getElementById('root')!;
const query = new URLSearchParams(location.search);
const playgroundLocale = query.get('playground');
const starter = query.get('starter');
if (playgroundLocale) {
  // Exercise the real documentation controls without building the whole site.
  const style = document.createElement('style');
  style.textContent =
    '.react-demo-canvas { width: 100%; max-width: 400px; height: 300px; }';
  document.head.append(style);
  void import('../../../packages/site/docs/components/react/playground').then(
    ({ mountPlayground }) =>
      mountPlayground(host, {
        locale: playgroundLocale === 'zh' ? 'zh' : 'en',
        theme: 'light',
      }),
  );
} else if (starter) {
  const load =
    starter === 'nextjs'
      ? import('../../../examples/react-nextjs/app/canvas-editor')
      : import('../../../examples/react-vite/src/canvas-editor');
  void load.then(({ CanvasEditor }) =>
    createRoot(host).render(
      <StrictMode>
        <CanvasEditor />
      </StrictMode>,
    ),
  );
} else {
  createRoot(host).render(
    <StrictMode>
      <Editor />
    </StrictMode>,
  );
}
