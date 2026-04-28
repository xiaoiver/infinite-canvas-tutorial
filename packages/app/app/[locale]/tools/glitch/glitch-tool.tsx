'use client';

import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import { EdgeStyle, Pen, SerializedNode, TRANSFORMER_ANCHOR_STROKE_COLOR } from '@infinite-canvas-tutorial/ecs';
import Canvas from '@/components/canvas';
import { Task } from '@infinite-canvas-tutorial/ecs';

export function GlitchTool() {
  const t = useTranslations('tools');
  const tItem = useTranslations('tools.items.glitch');

  const DEFAULT_NODES: SerializedNode[] = [
    {
      id: 'glitch-1',
      type: 'rect',
      x: 900,
      y: 100,
      width: 1024,
      height: 1536,
      lockAspectRatio: true,
      fill: '/glitch.png',
      zIndex: 0,
      version: 0,
      filter: 'crt(1.85, 4, 0.4, 0.27, auto, 1) vignette(0.5, 0.5) glitch(0.29, 0.15, auto, 0.29)',
    } as const,
    {
      id: 'glitch-raw',
      type: 'rect',
      x: 180,
      y: 100,
      width: 512,
      height: 768,
      lockAspectRatio: true,
      fill: '/glitch.png',
      zIndex: 0,
      version: 0,
    } as const,
    {
      id: 'glitch-edge-1',
      type: 'path',
      fromId: 'glitch-raw',
      toId: 'glitch-1',
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 6,
      zIndex: 1,
      version: 0,
      markerEnd: 'line',
      markerFactor: 4,
      edgeStyle: EdgeStyle.ORTHOGONAL,
      curved: true,
      bezier: true,
    } as const,
    {
      id: 'glitch-title',
      type: 'text',
      anchorX: 50,
      anchorY: 1000,
      content: tItem('title'),
      fontFamily: 'system-ui',
      fontSize: 72,
      fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
      zIndex: 1,
    },
    {
      id: 'glitch-description',
      type: 'text',
      anchorX: 50,
      anchorY: 1100,
      content: tItem('description'),
      fontFamily: 'system-ui',
      fontSize: 48,
      fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
      zIndex: 1,
    },
    {
      id: 'glitch-icon',
      type: 'iconfont',
      x: 380,
      y: 920,
      width: 100,
      height: 100,
      iconFontName: 'tv',
      iconFontFamily: 'lucide',
      fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 10,
      zIndex: 1,
    }
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar hideCenterContent />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8">
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 h-[720px] w-full">
            <Canvas id="photo-colors" initialData={DEFAULT_NODES} initialAppState={{
              penbarAll: [
                Pen.HAND,
                Pen.SELECT,
                Pen.DRAW_RECT,
                Pen.DRAW_ELLIPSE,
                Pen.DRAW_LINE,
                Pen.DRAW_TRIANGLE,
                Pen.DRAW_PENTAGON,
                Pen.DRAW_HEXAGON,
                Pen.DRAW_ROUGH_RECT,
                Pen.DRAW_ROUGH_ELLIPSE,
                Pen.IMAGE,
                Pen.LASER_POINTER,
                Pen.ERASER
              ],
              taskbarSelected: [Task.SHOW_PROPERTIES_PANEL],
              contextBarVisible: true,
            }} />
          </div>
        </div>
      </main>
    </div>
  );
}
