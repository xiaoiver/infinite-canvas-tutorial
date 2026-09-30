'use client';

import { throttle } from 'lodash-es';
import { upload } from '@vercel/blob/client';
import {
  Pen,
  Task,
  CheckboardStyle,
  SerializedNode,
  ThemeMode,
  AppState,
  registerIconifyIconSet,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import {
  InfiniteCanvas,
  createCanvasRuntime,
} from '@infinite-canvas-tutorial/react/spectrum';
// import { SAMPlugin } from '@infinite-canvas-tutorial/sam';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { FilterPlugin } from '@infinite-canvas-tutorial/filter';
import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useParams } from 'next/navigation';
import { useAtom } from 'jotai';
import { selectedNodesAtom, canvasApiAtom } from '@/atoms/canvas-selection';
import { CanvasYjsManager } from '@/lib/yjs/canvas-yjs-manager';
import ZoomToolbar from './zoom-toolbar';
import lucide from '@iconify/json/json/lucide.json';
import materialIconTheme from '@iconify/json/json/material-icon-theme.json';

const canvasRuntime = createCanvasRuntime({
  plugins: [
    FilterPlugin,
    LaserPointerPlugin,
    LassoPlugin,
    EraserPlugin,
    YogaPlugin,
  ],
  loadUI: () =>
    Promise.all([
      import('@infinite-canvas-tutorial/lasso/spectrum'),
      import('@infinite-canvas-tutorial/eraser/spectrum'),
      import('@infinite-canvas-tutorial/laser-pointer/spectrum'),
    ]),
});

interface CanvasProps {
  id?: string;
  initialData?: SerializedNode[];
  initialAppState?: Partial<AppState>;
  /** 在首帧写入节点之前执行（例如注册 LUT），须在此完成异步准备 */
  prepareCanvas?: (api: ExtendedAPI) => void | Promise<void>;
}

const Canvas = ({
  id = 'default',
  initialData,
  initialAppState,
  prepareCanvas,
}: CanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const projectIdRef = useRef<string>(id);
  const yjsManagerRef = useRef<CanvasYjsManager | null>(null);
  const canvasInitializedRef = useRef(false);
  const prepareCanvasRef = useRef(prepareCanvas);
  useEffect(() => {
    prepareCanvasRef.current = prepareCanvas;
  }, [prepareCanvas]);
  const { resolvedTheme } = useTheme();
  const params = useParams();
  const locale = params.locale as string;

  const [, setSelectedNodes] = useAtom(selectedNodesAtom);
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
    throttle(saveCanvasData, 1000),
  ).current;

  const onReady = async (
    api: ExtendedAPI,
    { signal }: { signal: AbortSignal },
  ) => {
    api.upload = async (file: File) => {
      // TODO: if already uploaded, return the url directly
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/assets/upload',
      });
      return blob.url;
    };

    // 初始化 Yjs 管理器
    const manager = new CanvasYjsManager(id);
    yjsManagerRef.current = manager;
    signal.addEventListener(
      'abort',
      () => {
        canvasInitializedRef.current = false;
        manager.destroy();
        if (yjsManagerRef.current === manager) yjsManagerRef.current = null;
        throttledSaveCanvasData.cancel();
      },
      { once: true },
    );
    await manager.waitForSync();
    if (signal.aborted) return;

    // 从 Yjs 加载已保存的节点（如果有）
    const savedNodes = manager.loadNodes();
    const nodes: SerializedNode[] = initialData || savedNodes;

    api.setAppState({
      language: locale,
      themeMode: resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT,
      // variables: {
      //   // 避免用 #FFFFFF：默认画布背景为浅色（如 #fbfbfb），白填充/白描边会几乎看不见
      //   '--primary': { type: 'color', value: '#FF8400' },
      //   '--primary-foreground': { type: 'color', value: '#111111' },
      //   '--radius-pill': { type: 'number', value: 999 },
      // },
      cameraZoom: 0.35,
      topbarVisible: false,
      penbarSelected: Pen.SELECT,
      penbarAll: [
        Pen.HAND,
        Pen.SELECT,
        Pen.DRAW_RECT,
        Pen.DRAW_ELLIPSE,
        Pen.DRAW_LINE,
        Pen.DRAW_ARROW,
        Pen.DRAW_TRIANGLE,
        Pen.DRAW_PENTAGON,
        Pen.DRAW_HEXAGON,
        Pen.DRAW_ROUGH_RECT,
        Pen.DRAW_ROUGH_ELLIPSE,
        Pen.DRAW_ICONFONT,
        Pen.IMAGE,
        Pen.TEXT,
        Pen.PENCIL,
        Pen.BRUSH,
        Pen.ERASER,
        Pen.LASER_POINTER,
      ],
      penbarText: {
        ...api.getAppState().penbarText,
        fontFamily: 'system-ui',
        fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
      },
      taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
      taskbarSelected: [],
      checkboardStyle: CheckboardStyle.GRID,
      snapToPixelGridEnabled: true,
      snapToPixelGridSize: 1,
      snapToObjectsEnabled: false,
      snapToObjectsDistance: 8,
      taskbarVisible: true,
      contextBarVisible: false,
      rotateEnabled: true,
      flipEnabled: false,
      propertiesPanelSectionsOpen: {
        fillSection: true,
        strokeSection: true,
        typographySection: true,
        shape: false,
        transform: false,
        layout: false,
        flexItem: true,
        effects: true,
        multiSelectAlignment: true,
        multiSelectEffects: true,
        exportSection: true,
        iconFont: true,
      },
      ...initialAppState,
    });

    registerIconifyIconSet('lucide', lucide);
    registerIconifyIconSet('material-icon-theme', materialIconTheme);

    await prepareCanvasRef.current?.(api);
    if (signal.aborted) return;

    api.runAtNextTick(() => {
      if (signal.aborted) return;
      canvasInitializedRef.current = true;
      api.updateNodes(nodes);
      if (nodes.length > 0) {
        api.selectNodes([nodes[0]]);
      }
      api.record();
    });
  };

  const onNodesChange = (nodes: SerializedNode[]) => {
    const manager = yjsManagerRef.current;
    if (!manager || !canvasInitializedRef.current) return;
    manager.recordLocalOps(nodes);
    throttledSaveCanvasData(nodes.filter((node) => !node.isDeleted));
  };

  useEffect(() => {
    if (canvasApi && resolvedTheme) {
      canvasApi.setAppState({
        themeMode: resolvedTheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT,
      });
    }
  }, [canvasApi, resolvedTheme]);

  return (
    <div ref={canvasRef} className="relative w-full h-full">
      <InfiniteCanvas
        key={id}
        runtime={canvasRuntime}
        className="w-full h-full"
        initialAppState={{ topbarVisible: false }}
        locale={locale}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        onReady={onReady}
        onAPIChange={(api) => {
          setCanvasApi(api);
          if (!api) setSelectedNodes([]);
        }}
        onNodesChange={onNodesChange}
        onSelectedNodesChange={setSelectedNodes}
      >
        <ic-spectrum-penbar-laser-pointer slot="penbar-item" />
        <ic-spectrum-penbar-eraser slot="penbar-item" />
      </InfiniteCanvas>
      <ZoomToolbar canvasApi={canvasApi} canvasRef={canvasRef} />
    </div>
  );
};

export default Canvas;
