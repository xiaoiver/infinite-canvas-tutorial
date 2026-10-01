import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasAPI,
  useCanvasSelector,
} from '@infinite-canvas-tutorial/react';
import { Pen } from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';

declare global {
  interface Window {
    apis: Record<string, ExtendedAPI>;
    canvasErrors: string[];
    setShown: (ids: string[]) => void;
  }
}
window.apis = {};
window.canvasErrors = [];

function Toolbar({ id }: { id: string }) {
  const api = useCanvasAPI();
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const canRedo = useCanvasSelector((state) => state.canRedo);
  const selected = useCanvasSelector(
    (state) => state.appState?.layersSelected.length ?? 0,
  );
  return (
    <div data-testid={`${id}-toolbar`}>
      <output data-testid={`${id}-zoom`}>{zoom}</output>
      <output data-testid={`${id}-selection`}>{selected}</output>
      <button
        data-testid={`${id}-undo`}
        disabled={!canUndo}
        onClick={() => api?.undo()}
      >
        Undo
      </button>
      <button
        data-testid={`${id}-redo`}
        disabled={!canRedo}
        onClick={() => api?.redo()}
      >
        Redo
      </button>
      <button data-testid={`${id}-zoom-in`} onClick={() => api?.zoomTo(2)}>
        Zoom
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
            onAPIChange={(api) => {
              if (api) window.apis[id] = api;
              else delete window.apis[id];
            }}
            onError={(error) => window.canvasErrors.push(error.message)}
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
