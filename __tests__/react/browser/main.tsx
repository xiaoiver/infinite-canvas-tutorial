import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasAPI,
  useCanvasActions,
  useCanvasSelector,
  type CanvasActions,
} from '@infinite-canvas-tutorial/react';
import {
  FillLayers,
  Pen,
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
    boundFill: (id: string) => string | undefined;
  }
}
window.apis = {};
window.actions = {};
window.canvasErrors = [];
window.nodeChanges = {};
window.snapshots = {};
window.boundFill = (id) => {
  const api = window.apis[id];
  const layer = api.getEntity(api.getNodes()[0]).read(FillLayers).layers[0];
  return layer?.type === 'solid' ? layer.value : undefined;
};

function Toolbar({ id }: { id: string }) {
  const api = useCanvasAPI();
  const actions = useCanvasActions();
  useEffect(() => {
    window.actions[id] = actions;
    return () => {
      delete window.actions[id];
    };
  }, [id, actions]);
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const canRedo = useCanvasSelector((state) => state.canRedo);
  const selected = useCanvasSelector(
    (state) => state.appState?.layersSelected.length ?? 0,
  );
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const penbar = useCanvasSelector(
    (state) => state.appState?.penbarVisible ?? true,
  );
  return (
    <div data-testid={`${id}-toolbar`}>
      <output data-testid={`${id}-zoom`}>{zoom}</output>
      <output data-testid={`${id}-selection`}>{selected}</output>
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
        disabled={!api}
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
              new URLSearchParams(location.search).has('prepare')
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
        </CanvasProvider>
      ))}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Editor />
  </StrictMode>,
);
