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
  useCanvasSelector,
} from '@infinite-canvas-tutorial/react';
import { Pen, type SerializedNode } from '@infinite-canvas-tutorial/ecs';

export interface PlaygroundOptions {
  locale: 'en' | 'zh';
  theme: 'light' | 'dark';
}

const copy = {
  en: {
    title: 'Try the React canvas',
    hint: 'Drag a shape, add a rectangle, or change its color. Each canvas keeps its own zoom, selection, and history.',
    second: 'Show second canvas',
    reset: 'Reset demo',
    canvas: 'Canvas',
    undo: 'Undo',
    redo: 'Redo',
    add: 'Add rectangle',
    color: 'Change color',
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
    hint: '拖动图形、添加矩形或修改颜色。每个画布拥有独立的缩放、选区和历史记录。',
    second: '显示第二个画布',
    reset: '重置示例',
    canvas: '画布',
    undo: '撤销',
    redo: '重做',
    add: '添加矩形',
    color: '修改颜色',
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
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const canRedo = useCanvasSelector((state) => state.canRedo);
  const count = useCanvasSelector(
    (state) => state.nodes.filter((node) => !node.isDeleted).length,
  );
  const selected = useCanvasSelector(
    (state) => state.appState?.layersSelected.length ?? 0,
  );
  const nextId = useRef(2);
  const add = () => {
    if (!api) return;
    const index = nextId.current++;
    api.runAtNextTick(() => {
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
      api.record();
    });
  };
  const changeColor = () => {
    if (!api) return;
    api.runAtNextTick(() => {
      const selectedId = api.getAppState().layersSelected[0];
      const node = selectedId
        ? api.getNodeById(selectedId)
        : api.getNodes().find((candidate) => !candidate.isDeleted);
      if (!node || !('fills' in node)) return;
      const current = node.fills?.[0]?.value;
      const color = colors[(colors.indexOf(current ?? '') + 1) % colors.length];
      api.updateNode(node, { fills: [{ type: 'solid', value: color }] });
      api.record();
    });
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
      button('undo', text.undo, () => api?.undo(), !canUndo),
      button('redo', text.redo, () => api?.redo(), !canRedo),
      button('add', text.add, add),
      button('color', text.color, changeColor, !api || count === 0),
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
        h('output', { 'data-state': 'selected' }, selected),
      ),
    ),
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
        initialAppState: {
          penbarSelected: Pen.SELECT,
          topbarVisible: false,
          penbarVisible: false,
          taskbarVisible: false,
          contextBarVisible: false,
        },
        onReady: (api, { signal }) => {
          api.runAtNextTick(() => {
            if (signal.aborted) return;
            // Establish an empty baseline, publish the seeded scene, then start
            // the reader's history after initialization.
            api.record();
            api.updateNodes(initialNodes(id));
            api.record();
            api.clearHistory();
          });
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
