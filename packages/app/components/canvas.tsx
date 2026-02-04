'use client';

import { throttle } from 'lodash-es';
import { upload } from '@vercel/blob/client';
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
// import { SAMPlugin } from '@infinite-canvas-tutorial/sam';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
//@ts-ignore
import deepEqual from 'deep-equal';
import { useTheme } from 'next-themes';
import { useParams } from 'next/navigation';
import { useAtom, useSetAtom } from 'jotai';
import { selectedNodesAtom, canvasApiAtom } from '@/atoms/canvas-selection';
import ZoomToolbar from './zoom-toolbar';

// 定义暴露给父组件的 API 接口
export interface CanvasAPI {
  insertImages: (imageUrls: string[], position?: { x: number; y: number }) => Promise<void>;
}

let appRunning = false;

// 用于标识本地操作的唯一标识符
const local = Math.random().toString();
// TODO: delete indexedb when project is deleted

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

interface CanvasProps {
  id?: string;
  initialData?: SerializedNode[];
}

const Canvas = forwardRef<CanvasAPI, CanvasProps>(({ id = 'default', initialData }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const projectIdRef = useRef<string>(id);
  const { resolvedTheme } = useTheme();
  const params = useParams();
  const locale = params.locale as string;

  const setSelectedNodes = useSetAtom(selectedNodesAtom);
  const [canvasApi, setCanvasApi] = useAtom(canvasApiAtom);

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
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canvasData: nodes,
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
    setCanvasApi(api);

    api.setLocale(locale);
    api.setThemeMode(resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT);
    api.upload = async (file: File) => {
      // TODO: if already uploaded, return the url directly
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/assets/upload',
      });
      return blob.url;
    };

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
    const nodes: SerializedNode[] = initialData || savedNodes;

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
      snapToObjectsEnabled: false,
      snapToObjectsDistance: 8,
      contextBarVisible: false,
      rotateEnabled: false,
      flipEnabled: false,
    });

    api.runAtNextTick(() => {
      api.updateNodes(nodes);
      if (nodes.length > 0) {
        api.selectNodes([nodes[0]]);
      }
      api.record();
    });
  };

  // 插入图片的方法
  const insertImages = useCallback(async (imageUrls: string[], position?: { x: number; y: number }) => {
    if (!canvasApi) {
      console.warn('Canvas API is not ready yet');
      return;
    }

    try {
      await Promise.all(imageUrls.map(async (imageUrl) => {
        await canvasApi.createImageFromFile(imageUrl, { position });
      }));
    } catch (error) {
      console.error('Failed to insert images:', error);
    }
  }, [canvasApi]);

  // 使用 useImperativeHandle 暴露 API 给父组件
  useImperativeHandle(ref, () => ({
    insertImages,
  }), [insertImages]);

  const onSelectedNodesChanged = async (e: CustomEvent<any>) => {
    setSelectedNodes(e.detail.selected);
  };

  useEffect(() => {
    if (!appRunning) {
      new App().addPlugins(...DefaultPlugins, UIPlugin
        , LaserPointerPlugin, LassoPlugin, EraserPlugin, 
        // SAMPlugin
    ).run();
      appRunning = true;
    }
  }, []);

  useEffect(() => {
    canvasRef.current?.addEventListener(Event.READY, onReady);
    canvasRef.current?.addEventListener(Event.SELECTED_NODES_CHANGED, onSelectedNodesChanged);

    return () => {
      if (canvasApi) {
        canvasApi.destroy();
        setCanvasApi(null);
      }
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
    if (canvasApi && resolvedTheme) {
      canvasApi.setThemeMode(resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    import('@infinite-canvas-tutorial/webcomponents/spectrum');
    import('@infinite-canvas-tutorial/lasso/spectrum');
    import('@infinite-canvas-tutorial/eraser/spectrum');
    import('@infinite-canvas-tutorial/laser-pointer/spectrum');
  }, []);

  return ( 
    <div className="relative w-full h-full">
      <ic-spectrum-canvas ref={canvasRef} className="w-full h-full" app-state='{"topbarVisible":false}'>
        <ic-spectrum-penbar-laser-pointer slot="penbar-item" />
        <ic-spectrum-penbar-eraser slot="penbar-item" />
      </ic-spectrum-canvas>
      <ZoomToolbar 
        canvasApi={canvasApi} 
        canvasRef={canvasRef}
      />
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;