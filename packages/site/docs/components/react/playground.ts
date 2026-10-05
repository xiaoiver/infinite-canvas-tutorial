import {
  createElement as h,
  StrictMode,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasActions,
  useCanvasSelector,
  useCanvasNode,
  useCanvasSelection,
  useCanvasHistory,
  useCanvasStatus,
  useCanvasEvent,
  useCanvasCamera,
  useCanvasShortcuts,
  useCanvasCoordinates,
  useCanvasAPI,
  type CanvasPoint,
} from '@infinite-canvas-tutorial/react';
import { Pen, type SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { DocumentControls } from './document-controls';

export interface PlaygroundOptions {
  locale: 'en' | 'zh';
  theme: 'light' | 'dark';
}

const copy = {
  en: {
    title: 'Try the React canvas',
    hint: 'Select a shape to change its color or width, delete it, or restore the sample document. On a phone, tap to select, then drag a corner to resize; drag just outside a corner to rotate. Drag the rectangle button onto the canvas, or click/tap it to add at the view center. Each canvas keeps its own zoom, selection, and history.',
    second: 'Show second canvas',
    reset: 'Reset demo',
    canvas: 'Canvas',
    place: 'Drag rectangle onto canvas, or click to add at center',
    shortcuts:
      'Keyboard: Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z redo, Ctrl/⌘+A select all, Delete/Backspace delete. Focus a canvas or its controls first.',
    undo: 'Undo',
    redo: 'Redo',
    add: 'Add rectangle',
    color: 'Change color',
    delete: 'Delete selected',
    replace: 'Restore sample',
    enlarge: 'Increase width',
    width: 'Width',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset zoom',
    fit: 'Fit all shapes',
    pick: 'Pick coordinates',
    cancelPick: 'Cancel picking',
    pickHint: 'Tap or click the canvas to get its coordinates.',
    coordinates: 'Canvas coordinates',
    shapes: 'Shapes',
    selected: 'Selected',
    loading: 'Loading canvas…',
    error: 'The canvas could not start. Try resetting the demo.',
  },
  zh: {
    title: '试试 React 画布',
    hint: '选中图形后修改颜色或宽度、删除图形，或恢复示例文档。手机上轻触选中，拖动角上的锚点缩放，在角外侧拖动旋转。将矩形按钮拖入画布，或点击按钮在当前视图中心添加。每个画布拥有独立的缩放、选区和历史记录。',
    second: '显示第二个画布',
    reset: '重置示例',
    canvas: '画布',
    place: '拖入矩形，或点击居中添加',
    shortcuts:
      '快捷键：Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 重做，Ctrl/⌘+A 全选，Delete/Backspace 删除。先聚焦画布或它的控件。',
    undo: '撤销',
    redo: '重做',
    add: '添加矩形',
    color: '修改颜色',
    delete: '删除选中图形',
    replace: '恢复示例文档',
    enlarge: '增加宽度',
    width: '宽度',
    zoomIn: '放大',
    zoomOut: '缩小',
    zoomReset: '重置缩放',
    fit: '适应全部图形',
    pick: '取点坐标',
    cancelPick: '取消取点',
    pickHint: '轻触或点击画布，获取画布中的坐标。',
    coordinates: '画布坐标',
    shapes: '图形',
    selected: '已选择',
    loading: '正在加载画布…',
    error: '画布未能启动，请尝试重置示例。',
  },
};

const colors = ['#ff8400', '#4263eb', '#9c36b5', '#0ca678'];
const shapeDragType = 'application/x-infinitecanvas-react-shape';

function initialNodes(id: string): SerializedNode[] {
  return [
    {
      id: `${id}-rect`,
      type: 'rect',
      zIndex: 0,
      x: 40,
      y: 45,
      width: 100,
      height: 80,
      fills: [{ type: 'solid', value: colors[0] }],
    },
    {
      id: `${id}-ellipse`,
      type: 'ellipse',
      zIndex: 1,
      x: 175,
      y: 115,
      width: 95,
      height: 80,
      fills: [{ type: 'solid', value: colors[1] }],
    },
  ];
}

function Controls({
  id,
  locale,
}: {
  id: string;
  locale: PlaygroundOptions['locale'];
}) {
  const text = copy[locale];
  const { status } = useCanvasStatus();
  const ready = status === 'ready';
  const actions = useCanvasActions();
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const reportEditError = (reason: unknown) =>
    setError(reason instanceof Error ? reason.message : String(reason));
  const { zoom } = useCanvasCamera();
  const picking = useCanvasSelector(
    (state) => state.appState?.penbarSelected === Pen.DRAW_POINT,
  );
  useCanvasEvent(
    'ic-point-drawn',
    ({ detail: { x, y } }) => {
      setPoint({ x, y });
      void actions
        .setAppState({ penbarSelected: Pen.SELECT }, { capture: 'NEVER' })
        .catch(reportEditError);
    },
    { enabled: ready },
  );
  const { canUndo, canRedo } = useCanvasHistory();
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const selected = useCanvasSelection();
  const node = useCanvasNode(selected[0]?.id);
  const nextId = useRef(2);
  const add = () => {
    if (!ready) return;
    const index = nextId.current++;
    void actions
      .edit((api) => {
        const node: SerializedNode = {
          id: `${id}-${index}`,
          type: 'rect',
          zIndex: index,
          x: 40 + ((index * 28) % 160),
          y: 45 + ((index * 20) % 110),
          width: 80,
          height: 60,
          fills: [{ type: 'solid', value: colors[index % colors.length] }],
        };
        api.updateNodes([node]);
        api.selectNodes([node]);
      })
      .catch(reportEditError);
  };
  const changeColor = () => {
    if (!ready) return;
    void actions
      .edit((api) => {
        const selectedId = api.getAppState().layersSelected[0];
        const node = selectedId
          ? api.getNodeById(selectedId)
          : api.getNodes().find((candidate) => !candidate.isDeleted);
        if (!node || !('fills' in node)) return;
        const current = node.fills?.[0]?.value;
        const color =
          colors[(colors.indexOf(current ?? '') + 1) % colors.length];
        api.updateNode(node, { fills: [{ type: 'solid', value: color }] });
      })
      .catch(reportEditError);
  };
  const button = (
    action: string,
    label: string,
    onClick: () => void,
    disabled = !ready,
  ) =>
    h(
      'button',
      { type: 'button', onClick, disabled, 'data-action': action },
      label,
    );

  return h(
    'div',
    { className: 'react-demo-controls' },
    h(
      'div',
      {
        className: 'react-demo-actions',
        role: 'group',
        'aria-label': `${text.canvas} ${id}`,
      },
      button('undo', text.undo, actions.undo, !ready || !canUndo),
      button('redo', text.redo, actions.redo, !ready || !canRedo),
      button('add', text.add, add),
      button('color', text.color, changeColor, !ready || count === 0),
      button(
        'enlarge',
        text.enlarge,
        () => {
          void actions
            .updateNodes((nodes) =>
              nodes
                .filter((candidate) => candidate.id === node?.id)
                .map((candidate) => ({
                  ...candidate,
                  width: (candidate.width ?? 0) + 20,
                })),
            )
            .catch(reportEditError);
        },
        !ready || node?.width == null,
      ),
      button(
        'delete',
        text.delete,
        () => {
          void actions
            .deleteNodes(selected.map((node) => node.id))
            .catch(reportEditError);
        },
        !ready || selected.length === 0,
      ),
      button('replace', text.replace, () => {
        void actions.replaceDocument(initialNodes(id)).catch(reportEditError);
      }),
      button('pick', picking ? text.cancelPick : text.pick, () => {
        setPoint(null);
        void actions
          .setAppState(
            { penbarSelected: picking ? Pen.SELECT : Pen.DRAW_POINT },
            { capture: 'NEVER' },
          )
          .catch(reportEditError);
      }),
    ),
    h(
      'div',
      { className: 'react-demo-status' },
      h(
        'div',
        {
          className: 'react-demo-zoom',
          role: 'group',
          'aria-label': text.zoomReset,
        },
        h(
          'button',
          {
            type: 'button',
            disabled: !ready || zoom <= 0.25,
            'aria-label': text.zoomOut,
            'data-action': 'zoom-out',
            onClick: () => actions.zoomTo(Math.max(0.25, zoom / 1.25)),
          },
          '−',
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !ready,
            'aria-label': text.zoomReset,
            'data-action': 'zoom-reset',
            onClick: () => actions.zoomTo(1),
          },
          h('output', { 'data-state': 'zoom' }, `${Math.round(zoom * 100)}%`),
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !ready || zoom >= 4,
            'aria-label': text.zoomIn,
            'data-action': 'zoom-in',
            onClick: () => actions.zoomTo(Math.min(4, zoom * 1.25)),
          },
          '+',
        ),
        button(
          'fit',
          text.fit,
          () => actions.fitToScreen(),
          !ready || count === 0,
        ),
      ),
      h(
        'span',
        null,
        `${text.shapes}: `,
        h('output', { 'data-state': 'nodes' }, count),
      ),
      h(
        'span',
        null,
        `${text.selected}: `,
        h('output', { 'data-state': 'selected' }, selected.length),
      ),
      node?.width != null &&
        h(
          'span',
          null,
          `${text.width}: `,
          h('output', { 'data-state': 'width' }, node.width),
        ),
    ),
    h(
      'p',
      { role: 'status', 'data-state': 'point' },
      picking ? text.pickHint : point ? `${text.coordinates}: ` : '',
      !picking &&
        point &&
        h(
          'output',
          { 'data-x': point.x, 'data-y': point.y },
          `x: ${point.x.toFixed(2)}, y: ${point.y.toFixed(2)}`,
        ),
    ),
    error && h('p', { role: 'alert' }, error),
    h(DocumentControls, {
      storageKey: `infinite-canvas:react-playground:${id}:v1`,
      filename: `canvas-${id}.ic`,
      locale,
    }),
  );
}

function CanvasPanelContent({
  id,
  locale,
  theme,
}: PlaygroundOptions & { id: string }) {
  const text = copy[locale];
  const [error, setError] = useState<Error | null>(null);
  const shortcuts = useCanvasShortcuts({ onError: setError });
  const coordinates = useCanvasCoordinates();
  const actions = useCanvasActions();
  const api = useCanvasAPI();
  const { status } = useCanvasStatus();
  const ready = status === 'ready';
  const placeAt = (client: CanvasPoint) => {
    if (!ready) return;
    const point = coordinates.clientToCanvas(client);
    if (!point) return;
    setError(null);
    void actions
      .edit((current) => {
        const node: SerializedNode = {
          id: `${id}-drop-${crypto.randomUUID()}`,
          type: 'rect',
          zIndex:
            current
              .getNodes()
              .reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0) + 1,
          x: point.x - 40,
          y: point.y - 30,
          width: 80,
          height: 60,
          fills: [{ type: 'solid', value: '#0ca678' }],
        };
        current.updateNodes([node]);
        current.selectNodes([node]);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason : new Error(String(reason))),
      );
  };
  const acceptsShape = (event: DragEvent) =>
    ready && event.dataTransfer.types.includes(shapeDragType);
  return h(
    'section',
    {
      ...shortcuts,
      className: 'react-demo-panel',
      'data-canvas': id,
      'aria-label': `${text.canvas} ${id}`,
    },
    h('h2', null, `${text.canvas} ${id}`),
    h(
      'button',
      {
        type: 'button',
        'data-action': 'place',
        disabled: !ready,
        draggable: ready,
        onDragStart: (event: DragEvent<HTMLButtonElement>) => {
          event.dataTransfer.setData(shapeDragType, 'rect');
          event.dataTransfer.effectAllowed = 'copy';
        },
        onClick: () => {
          const bounds = api?.getCanvasElement().getBoundingClientRect();
          if (bounds)
            placeAt({
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
            });
        },
      },
      text.place,
    ),
    h(InfiniteCanvas, {
      className: 'react-demo-canvas',
      onDragOverCapture: (event: DragEvent<HTMLDivElement>) => {
        if (!acceptsShape(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDropCapture: (event: DragEvent<HTMLDivElement>) => {
        if (!acceptsShape(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.getData(shapeDragType) === 'rect') {
          placeAt({ x: event.clientX, y: event.clientY });
        }
      },
      locale: locale === 'zh' ? 'zh-Hans' : 'en',
      theme,
      initialNodes: initialNodes(id),
      initialAppState: {
        penbarSelected: Pen.SELECT,
        topbarVisible: false,
        penbarVisible: false,
        taskbarVisible: false,
        contextBarVisible: false,
      },
      fallback: h(
        'p',
        { className: 'react-demo-loading', role: 'status' },
        text.loading,
      ),
      renderError: () => h('p', { role: 'alert' }, text.error),
    }),
    h(Controls, { id, locale }),
    error && h('p', { role: 'alert' }, error.message),
  );
}

function CanvasPanel(props: PlaygroundOptions & { id: string }) {
  return h(CanvasProvider, null, h(CanvasPanelContent, props));
}

function Playground(options: PlaygroundOptions) {
  const text = copy[options.locale];
  const [second, setSecond] = useState(true);
  const [revision, setRevision] = useState(0);
  return h(
    'main',
    {
      className: 'react-demo',
      lang: options.locale === 'zh' ? 'zh-Hans' : 'en',
    },
    h('h1', null, text.title),
    h('p', { className: 'react-demo-hint' }, text.hint),
    h('p', { className: 'react-demo-hint' }, text.shortcuts),
    h(
      'div',
      { className: 'react-demo-settings' },
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: second,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            setSecond(event.target.checked),
        }),
        text.second,
      ),
      h(
        'button',
        {
          type: 'button',
          'data-action': 'reset',
          onClick: () => setRevision((value) => value + 1),
        },
        text.reset,
      ),
    ),
    h(
      'div',
      { className: 'react-demo-grid' },
      h(CanvasPanel, { ...options, id: 'A', key: `A-${revision}` }),
      second && h(CanvasPanel, { ...options, id: 'B', key: `B-${revision}` }),
    ),
  );
}

export function mountPlayground(host: HTMLElement, options: PlaygroundOptions) {
  const root = createRoot(host);
  const update = (next: PlaygroundOptions) =>
    root.render(h(StrictMode, null, h(Playground, next)));
  update(options);
  return { update, destroy: () => root.unmount() };
}
