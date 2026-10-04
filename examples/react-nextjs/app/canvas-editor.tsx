'use client';

import { useState } from 'react';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasActions,
  useCanvasSelector,
  useCanvasStatus,
  useCanvasCamera,
  useCanvasShortcuts,
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
  const { status } = useCanvasStatus();
  const ready = status === 'ready';
  const { zoom } = useCanvasCamera();
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
      <button disabled={!ready || !canUndo} onClick={actions.undo}>
        Undo
      </button>
      <button disabled={!ready || !canRedo} onClick={actions.redo}>
        Redo
      </button>
      <button disabled={!ready} onClick={() => actions.zoomTo(1)}>
        Reset zoom
      </button>
      <button
        disabled={!ready || count === 0}
        onClick={() => actions.fitToScreen()}
      >
        Fit all shapes
      </button>
      <output aria-label="Zoom">{Math.round(zoom * 100)}%</output>
      <span>
        Shapes: <output data-testid="shape-count">{count}</output>
      </span>
      {error && <span role="alert">{error}</span>}
      <DocumentControls storageKey="infinite-canvas:react-nextjs:v1" />
    </div>
  );
}

function EditorContent() {
  const [error, setError] = useState<Error | null>(null);
  const shortcuts = useCanvasShortcuts({ onError: setError });
  return (
    <section {...shortcuts} aria-label="Canvas editor">
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
      {error && <p role="alert">{error.message}</p>}
    </section>
  );
}

export function CanvasEditor() {
  return (
    <CanvasProvider>
      <EditorContent />
    </CanvasProvider>
  );
}
