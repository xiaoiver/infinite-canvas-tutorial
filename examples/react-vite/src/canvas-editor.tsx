import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasAPI,
  useCanvasSelector,
  type InfiniteCanvasProps,
} from '@infinite-canvas-tutorial/react';

const initialNodes: NonNullable<InfiniteCanvasProps['initialNodes']> = [
  {
    id: 'rectangle',
    type: 'rect',
    zIndex: 0,
    x: 50,
    y: 50,
    width: 100,
    height: 80,
    fills: [{ type: 'solid', value: '#ff8400' }],
  },
];

function Toolbar() {
  const api = useCanvasAPI();
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const canRedo = useCanvasSelector((state) => state.canRedo);
  const enlarge = () => {
    if (!api) return;
    api.runAtNextTick(() => {
      const node = api.getNodeById('rectangle');
      if (!node) return;
      api.updateNodes([{ ...node, width: (node.width ?? 100) + 20 }]);
      api.record();
    });
  };
  return (
    <div className="toolbar">
      <button disabled={!api} onClick={enlarge}>
        Enlarge rectangle
      </button>
      <button disabled={!canUndo} onClick={() => api?.undo()}>
        Undo
      </button>
      <button disabled={!canRedo} onClick={() => api?.redo()}>
        Redo
      </button>
      <span>
        Shapes: <output data-testid="shape-count">{count}</output>
      </span>
    </div>
  );
}

export function CanvasEditor() {
  return (
    <CanvasProvider>
      <Toolbar />
      <InfiniteCanvas
        style={{ height: 420 }}
        initialNodes={initialNodes}
        initialAppState={{
          topbarVisible: false,
          penbarVisible: false,
          taskbarVisible: false,
        }}
        fallback={<p role="status">Loading canvas…</p>}
      />
    </CanvasProvider>
  );
}
