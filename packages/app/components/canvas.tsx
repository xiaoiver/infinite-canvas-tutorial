'use client';

import {
  App,
  Pen,
  DefaultPlugins,
  Task,
  CheckboardStyle,
  SerializedNode,
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

let appRunning = false;

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExtendedAPI | null>(null);

  const attachments = usePromptInputAttachments();

  const onReady = (e: CustomEvent<any>) => {
    const api = e.detail as ExtendedAPI;
    apiRef.current = api;

    const nodes: SerializedNode[] = [
      // {
      //   id: '1',
      //   name: 'A swimming dog',
      //   type: 'rect',
      //   fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
      //   x: 200,
      //   y: 150,
      //   width: 1024,
      //   height: 1024,
      //   lockAspectRatio: true,
      // } as const,
      // {
      //   id: '2',
      //   name: 'A swimming cat',
      //   type: 'rect',
      //   fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
      //   x: 200 + 1200,
      //   y: 150,
      //   width: 1024,
      //   height: 1024,
      //   lockAspectRatio: true,
      // } as const,
      // {
      //   id: '3',
      //   name: 'A swimming dog without background',
      //   type: 'rect',
      //   fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
      //   x: 200 + 2400,
      //   y: 150,
      //   width: 1024,
      //   height: 1024,
      //   lockAspectRatio: true,
      // } as const,
      // {
      //   id: '4',
      //   type: 'text',
      //   name: 'Enter your desired modifications in Chat.',
      //   fill: 'black',
      //   content: 'Enter your desired modifications in Chat.',
      //   fontSize: 66,
      //   fontFamily: 'Gaegu',
      //   anchorX: 200,
      //   anchorY: 100,
      // } as const,
      // {
      //   id: '5',
      //   type: 'text',
      //   name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
      //   fill: 'black',
      //   content:
      //     'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
      //   fontSize: 66,
      //   fontFamily: 'Gaegu',
      //   anchorX: 200,
      //   anchorY: 1300,
      // } as const,
      {
        id: '6',
        type: 'polyline', 
        points:
          '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
        stroke: '#147af3',
        strokeWidth: 18,
      } as const,
      // {
      //   id: '7',
      //   type: 'rect',
      //   name: 'A dog with a hand-drawn fish',
      //   fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
      //   x: 1400,
      //   y: 1400,
      //   width: 1408,
      //   height: 736,
      // } as const,
      // {
      //   id: '8',
      //   type: 'polyline',
      //   points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
      //   stroke: '#147af3',
      //   strokeWidth: 18,
      //   strokeLinecap: 'round',
      //   strokeLinejoin: 'round',
      //   markerEnd: 'line',
      // },
      // {
      //   id: '9',
      //   type: 'text',
      //   name: 'Smart inpainting & outpainting are on the way.',
      //   fill: 'black',
      //   content:
      //     "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
      //   fontSize: 66,
      //   fontFamily: 'Gaegu',
      //   anchorX: 200,
      //   anchorY: 2300,
      // } as const,
    ];

    api.setAppState({
      cameraX: 0,
      cameraZoom: 0.35,
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
      // checkboardStyle: CheckboardStyle.NONE,
      // penbarSelected: Pen.SELECT,
      // topbarVisible: false,
      // contextBarVisible: false,
      // penbarVisible: false,
      // taskbarVisible: false,
      // rotateEnabled: false,
      // flipEnabled: false,
    });

    api.updateNodes(nodes);
    api.selectNodes([nodes[0]]);

    api.record();
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

        if (!base64) {
          return null;
        }
        
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
        
        // 从 Blob 创建 File 对象
        return new File([blob], `image-${node.id}.png`, { type: mimeType });
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
      apiRef.current?.destroy();
      canvasRef.current?.removeEventListener(Event.READY, onReady);
      canvasRef.current?.removeEventListener(Event.SELECTED_NODES_CHANGED, onSelectedNodesChanged);
    }
  }, []);

  return ( 
      <ic-spectrum-canvas ref={canvasRef} className="w-full h-full">
        <ic-spectrum-penbar-laser-pointer slot="penbar-item" />
        <ic-spectrum-penbar-eraser slot="penbar-item" />
        {/* <ic-spectrum-taskbar-chat slot="taskbar-item" />
        <ic-spectrum-taskbar-chat-panel slot="taskbar-panel" /> */}
      </ic-spectrum-canvas>
  );
}