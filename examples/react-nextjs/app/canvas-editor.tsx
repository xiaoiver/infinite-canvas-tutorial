'use client';

import { useState } from 'react';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasActions,
  useCanvasSelector,
  type InfiniteCanvasProps,
} from '@infinite-canvas-tutorial/react';
import { DocumentControls } from './document-controls';

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
  const actions = useCanvasActions();
  const ready = useCanvasSelector((state) => state.api !== null);
  const [error, setError] = useState<string | null>(null);
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const canRedo = useCanvasSelector((state) => state.canRedo);
  const enlarge = async () => {
    setError(null);
    try {
      await actions.updateNodes((nodes) => {
        const node = nodes.find((node) => node.id === 'rectangle');
        return node ? [{ ...node, width: (node.width ?? 100) + 20 }] : [];
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="toolbar">
      <button disabled={!ready} onClick={enlarge}>
        Enlarge rectangle
      </button>
      <button disabled={!canUndo} onClick={actions.undo}>
        Undo
      </button>
      <button disabled={!canRedo} onClick={actions.redo}>
        Redo
      </button>
      <span>
        Shapes: <output data-testid="shape-count">{count}</output>
      </span>
      {error && <span role="alert">{error}</span>}
      <DocumentControls storageKey="infinite-canvas:react-nextjs:v1" />
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
