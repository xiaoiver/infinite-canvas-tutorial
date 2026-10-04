import {
  createElement as h,
  StrictMode,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  CanvasProvider,
  InfiniteCanvas,
  useCanvasAPI,
  useCanvasActions,
  useCanvasSelector,
  useCanvasNode,
  useCanvasSelection,
  useCanvasHistory,
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
    hint: 'Select a shape to change its color or width, delete it, or restore the sample document. On a phone, tap to select, then drag a corner to resize; drag just outside a corner to rotate. Each canvas keeps its own zoom, selection, and history.',
    second: 'Show second canvas',
    reset: 'Reset demo',
    canvas: 'Canvas',
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
    shapes: 'Shapes',
    selected: 'Selected',
    loading: 'Loading canvas…',
    error: 'The canvas could not start. Try resetting the demo.',
  },
  zh: {
    title: '试试 React 画布',
    hint: '选中图形后修改颜色或宽度、删除图形，或恢复示例文档。手机上轻触选中，拖动角上的锚点缩放，在角外侧拖动旋转。每个画布拥有独立的缩放、选区和历史记录。',
    second: '显示第二个画布',
    reset: '重置示例',
    canvas: '画布',
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
    shapes: '图形',
    selected: '已选择',
    loading: '正在加载画布…',
    error: '画布未能启动，请尝试重置示例。',
  },
};

const colors = ['#ff8400', '#4263eb', '#9c36b5', '#0ca678'];

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
  const api = useCanvasAPI();
  const actions = useCanvasActions();
  const [error, setError] = useState<string | null>(null);
  const reportEditError = (reason: unknown) =>
    setError(reason instanceof Error ? reason.message : String(reason));
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const { canUndo, canRedo } = useCanvasHistory();
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const selected = useCanvasSelection();
  const node = useCanvasNode(selected[0]?.id);
  const nextId = useRef(2);
  const add = () => {
    if (!api) return;
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
    if (!api) return;
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
    disabled = !api,
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
      button('undo', text.undo, actions.undo, !canUndo),
      button('redo', text.redo, actions.redo, !canRedo),
      button('add', text.add, add),
      button('color', text.color, changeColor, !api || count === 0),
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
        !api || node?.width == null,
      ),
      button(
        'delete',
        text.delete,
        () => {
          void actions
            .deleteNodes(selected.map((node) => node.id))
            .catch(reportEditError);
        },
        !api || selected.length === 0,
      ),
      button('replace', text.replace, () => {
        void actions.replaceDocument(initialNodes(id)).catch(reportEditError);
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
            disabled: !api || zoom <= 0.25,
            'aria-label': text.zoomOut,
            'data-action': 'zoom-out',
            onClick: () => api?.zoomTo(Math.max(0.25, zoom / 1.25)),
          },
          '−',
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !api,
            'aria-label': text.zoomReset,
            'data-action': 'zoom-reset',
            onClick: () => api?.zoomTo(1),
          },
          h('output', { 'data-state': 'zoom' }, `${Math.round(zoom * 100)}%`),
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !api || zoom >= 4,
            'aria-label': text.zoomIn,
            'data-action': 'zoom-in',
            onClick: () => api?.zoomTo(Math.min(4, zoom * 1.25)),
          },
          '+',
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
    error && h('p', { role: 'alert' }, error),
    h(DocumentControls, {
      storageKey: `infinite-canvas:react-playground:${id}:v1`,
      filename: `canvas-${id}.ic`,
      locale,
    }),
  );
}

function CanvasPanel({
  id,
  locale,
  theme,
}: PlaygroundOptions & { id: string }) {
  const text = copy[locale];
  return h(
    CanvasProvider,
    null,
    h(
      'section',
      {
        className: 'react-demo-panel',
        'data-canvas': id,
        'aria-label': `${text.canvas} ${id}`,
      },
      h('h2', null, `${text.canvas} ${id}`),
      h(InfiniteCanvas, {
        className: 'react-demo-canvas',
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
    ),
  );
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
