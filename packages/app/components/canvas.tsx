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
import { useEffect, useRef, useCallback } from 'react';
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

// Throttle 函数：限制函数执行频率
function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    const currentTime = Date.now();

    // 保存最新的参数
    lastArgs = args;

    // 如果距离上次执行已经超过 delay，立即执行
    if (currentTime - lastExecTime >= delay) {
      func(...args);
      lastExecTime = currentTime;
      lastArgs = null;
    } else {
      // 否则，设置定时器在剩余时间后执行
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const remainingTime = delay - (currentTime - lastExecTime);
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func(...lastArgs);
          lastExecTime = Date.now();
          lastArgs = null;
        }
        timeoutId = null;
      }, remainingTime);
    }
  };
}

export default function Canvas({ id = 'default', initialData }: { id?: string, initialData?: SerializedNode[] }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExtendedAPI | null>(null);
  const projectIdRef = useRef<string>(id);
  const { resolvedTheme } = useTheme();
  const params = useParams();
  const locale = params.locale as string;

  const attachments = usePromptInputAttachments();

  // 更新 projectIdRef 当 id 改变时
  useEffect(() => {
    projectIdRef.current = id;
  }, [id]);

  // 保存画布数据到数据库的函数
  const saveCanvasData = useCallback(async (nodes: SerializedNode[]) => {
    const projectId = projectIdRef.current;
    // 如果 id 是 'default'，说明不是项目页面，不需要保存
    if (projectId === 'default') {
      return;
    }

    try {
      const canvasData = JSON.stringify(nodes);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canvasData,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save canvas data:', await response.text());
      }
    } catch (error) {
      console.error('Error saving canvas data:', error);
    }
  }, []);

  // 创建 throttle 版本的保存函数，每 1 秒最多执行一次
  const throttledSaveCanvasData = useRef(
    throttle(saveCanvasData, 1000)
  ).current;

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
      indexeddbProvider = new IndexeddbPersistence(`infinite-canvas-data-${id}`, doc);
      
      // 等待 IndexedDB 加载完成
      await new Promise<void>((resolve) => {
        indexeddbProvider!.on('synced', () => {
          resolve();
        });
      });

      // 设置 API 的 onchange 回调，将画布变化同步到 Yjs 并保存到数据库
      api.onchange = (snapshot) => {
        const { nodes } = snapshot;
        if (yArray) {
          recordLocalOps(yArray, nodes);
        }
        // 将 nodes 转换为 SerializedNode[] 并保存到数据库（使用 throttle 限制频率）
        const serializedNodes = nodes.filter((node) => !node.isDeleted) as SerializedNode[];
        throttledSaveCanvasData(serializedNodes);
      };
    }

    // 从 Yjs 加载已保存的节点（如果有）
    let savedNodes: SerializedNode[] = [];
    if (yArray && yArray.length > 0) {
      savedNodes = yArray.toArray().map((map: Y.Map<any>) => map.toJSON()) as SerializedNode[];
    }

    // 如果没有保存的节点，使用默认节点
    const nodes: SerializedNode[] = savedNodes.length > 0 ? savedNodes : initialData || [];

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