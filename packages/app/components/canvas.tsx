'use client';

import {
  App,
  Pen,
  DefaultPlugins,
  Task,
  CheckboardStyle,
  SerializedNode,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import { Event, UIPlugin, ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';
import { useEffect, useRef } from 'react';
import '@infinite-canvas-tutorial/webcomponents/spectrum';
import '@infinite-canvas-tutorial/lasso/spectrum';
import '@infinite-canvas-tutorial/eraser/spectrum';
import '@infinite-canvas-tutorial/laser-pointer/spectrum';
import { usePromptInputAttachments } from './ai-elements/prompt-input';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
//@ts-ignore
import deepEqual from 'deep-equal';
import { useTheme } from 'next-themes';
import { useParams } from 'next/navigation';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: '1',
    name: 'A swimming dog',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    x: 200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '2',
    name: 'A swimming cat',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
    x: 200 + 1200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '3',
    name: 'A swimming dog without background',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
    x: 200 + 2400,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '4',
    type: 'text',
    name: 'Enter your desired modifications in Chat.',
    fill: 'black',
    content: 'Enter your desired modifications in Chat.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 100,
    version: 0,
  } as const,
  {
    id: '5',
    type: 'text',
    name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fill: 'black',
    content:
      'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 1300,
    version: 0,
  } as const,
  {
    id: '6',
    type: 'polyline', 
    points:
      '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
    stroke: '#147af3',
    strokeWidth: 18,
    version: 0,
  } as const,
  {
    id: '7',
    type: 'rect',
    name: 'A dog with a hand-drawn fish',
    fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
    x: 1400,
    y: 1400,
    width: 1408,
    height: 736,
    version: 0,
  } as const,
  {
    id: '8',
    type: 'polyline',
    points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
    stroke: '#147af3',
    strokeWidth: 18,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    markerEnd: 'line',
    version: 0,
  },
  {
    id: '9',
    type: 'text',
    name: 'Smart inpainting & outpainting are on the way.',
    fill: 'black',
    content:
      "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 2300,
    version: 0,
  } as const,
];

let appRunning = false;

// 用于标识本地操作的唯一标识符
const local = Math.random().toString();


// 全局 Yjs 文档和数组引用
let doc: Y.Doc | null = null;
let yArray: Y.Array<Y.Map<any>> | null = null;
let indexeddbProvider: IndexeddbPersistence | null = null;

// 同步本地节点到 Yjs 数组
function recordLocalOps(
  yArray: Y.Array<Y.Map<any>>,
  nodes: readonly { version?: number; isDeleted?: boolean }[],
): void {
  doc?.transact(() => {
    nodes = nodes.filter((e) => !e.isDeleted);

    // 同步数组长度
    while (yArray.length < nodes.length) {
      const map = new Y.Map();
      yArray.push([map]);
    }

    while (yArray.length > nodes.length) {
      yArray.delete(yArray.length - 1, 1);
    }

    // 同步每个节点的属性
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const map = yArray.get(i) as Y.Map<any> | undefined;
      if (!map) {
        break;
      }

      const elem = nodes[i];
      const currentVersion = map.get("version");

      if (currentVersion === elem.version) {
        continue;
      }

      // 更新所有属性
      for (const [key, value] of Object.entries(elem)) {
        const src = map.get(key);
        if (
          (typeof src === 'object' && !deepEqual(src, value)) ||
          src !== value
        ) {
          map.set(key, value);
        }
      }
    }
  }, local);
}

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExtendedAPI | null>(null);
  const { resolvedTheme } = useTheme();
  const params = useParams();
  const locale = params.locale as string;

  const attachments = usePromptInputAttachments();

  const onReady = async (e: CustomEvent<any>) => {
    const api = e.detail as ExtendedAPI;
    apiRef.current = api;

    apiRef.current.setLocale(locale);
    apiRef.current.setThemeMode(resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT);

    // 初始化 Yjs 文档和 IndexedDB 持久化
    if (!doc) {
      doc = new Y.Doc();
      yArray = doc.getArray("nodes");
      
      // 创建 IndexedDB provider 用于本地持久化
      indexeddbProvider = new IndexeddbPersistence('infinite-canvas-scene', doc);
      
      // 等待 IndexedDB 加载完成
      await new Promise<void>((resolve) => {
        indexeddbProvider!.on('synced', () => {
          resolve();
        });
      });

      // 设置 API 的 onchange 回调，将画布变化同步到 Yjs
      api.onchange = (snapshot) => {
        const { nodes } = snapshot;
        if (yArray) {
          recordLocalOps(yArray, nodes);
        }
      };
    }

    // 从 Yjs 加载已保存的节点（如果有）
    let savedNodes: SerializedNode[] = [];
    if (yArray && yArray.length > 0) {
      savedNodes = yArray.toArray().map((map: Y.Map<any>) => map.toJSON()) as SerializedNode[];
    }

    // 如果没有保存的节点，使用默认节点
    const nodes: SerializedNode[] = savedNodes.length > 0 ? savedNodes : DEFAULT_NODES;

    api.setAppState({
      language: locale,
      themeMode: resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT,
      cameraZoom: 0.35,
      topbarVisible: false,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT, Pen.DRAW_ELLIPSE, Pen.DRAW_LINE, Pen.DRAW_ARROW, Pen.DRAW_ROUGH_RECT, Pen.DRAW_ROUGH_ELLIPSE, Pen.IMAGE, Pen.TEXT, Pen.PENCIL, Pen.BRUSH, Pen.ERASER, Pen.LASER_POINTER],
      penbarText: {
        ...api.getAppState().penbarText,
        fontFamily: 'system-ui',
        fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
      },
      taskbarAll: [
        Task.SHOW_LAYERS_PANEL,
        Task.SHOW_PROPERTIES_PANEL,
      ],
      taskbarSelected: [ Task.SHOW_LAYERS_PANEL],
      checkboardStyle: CheckboardStyle.GRID,
      snapToPixelGridEnabled: true,
      snapToPixelGridSize: 1,
      snapToObjectsEnabled: true,
      snapToObjectsDistance: 8,
      // contextBarVisible: false,
      rotateEnabled: false,
      flipEnabled: false,
    });

    api.runAtNextTick(() => {
      // 只有在没有保存的节点时才更新（避免覆盖从 IndexedDB 加载的数据）
      if (savedNodes.length === 0) {
        api.updateNodes(nodes);
        api.selectNodes([nodes[0]]);
      } else {
        // 如果有保存的节点，确保它们被正确加载
        api.updateNodes(savedNodes);
      }
      api.record();
    });
  };

  const onSelectedNodesChanged = async (e: CustomEvent<any>) => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }

    const selectedNodes = currentApi.getAppState().layersSelected.map(id => currentApi.getNodeById(id));

    try {
      attachments.clear();
      const files = await Promise.all(selectedNodes.map(async node => {
        const base64 = (node as any).fill as string;

        try {
          // 将 base64 字符串转换为 Blob
          const base64Data = base64.includes(',') 
            ? base64.split(',')[1] 
            : base64;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          
          // 从 data URL 中提取 MIME 类型，默认为 image/png
          const mimeType = base64.match(/data:([^;]+);/)?.[1] || 'image/png';
          const blob = new Blob([byteArray], { type: mimeType });
          
          // 从 Blob 创建 File 对象，使用 node.id 作为文件名
          return new File([blob], node.id, { type: mimeType });
        } catch (error) {
          return new File([], node.id, { type: 'application/octet-stream' });
        }
      }));

      if (files.length > 0) {
        attachments.add(files.filter(Boolean) as File[]);
      }
    } catch (error) {
      console.error('Failed to convert base64 to File:', error);
    }
  };

  useEffect(() => {
    if (!appRunning) {
      new App().addPlugins(...DefaultPlugins, UIPlugin
        , LaserPointerPlugin, LassoPlugin, EraserPlugin, FalAIPlugin.configure({
        credentials: 'your-fal-ai-credentials-here',
      })
    ).run();
      appRunning = true;
    }
  }, []);

  useEffect(() => {
    canvasRef.current?.addEventListener(Event.READY, onReady);
    canvasRef.current?.addEventListener(Event.SELECTED_NODES_CHANGED, onSelectedNodesChanged);

    return () => {
      // 清理资源
      if (indexeddbProvider) {
        indexeddbProvider.destroy();
        indexeddbProvider = null;
      }
      if (doc) {
        doc.destroy();
        doc = null;
        yArray = null;
      }
      canvasRef.current?.removeEventListener(Event.READY, onReady);
      canvasRef.current?.removeEventListener(Event.SELECTED_NODES_CHANGED, onSelectedNodesChanged);
    }
  }, []);

  useEffect(() => {
    if (apiRef.current && resolvedTheme) {
      apiRef.current.setThemeMode(resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT);
    }
  }, [resolvedTheme]);

  return ( 
      <ic-spectrum-canvas ref={canvasRef} className="w-full h-full" app-state='{"topbarVisible":false}'>
        <ic-spectrum-penbar-laser-pointer slot="penbar-item" />
        <ic-spectrum-penbar-eraser slot="penbar-item" />
        {/* <ic-spectrum-taskbar-chat slot="taskbar-item" />
        <ic-spectrum-taskbar-chat-panel slot="taskbar-panel" /> */}
      </ic-spectrum-canvas>
  );
}