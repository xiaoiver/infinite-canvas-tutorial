'use client';

import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import Canvas from '@/components/canvas';
import { Pen, SerializedNode } from '@infinite-canvas-tutorial/ecs';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: 'photo-colors-1',
    type: 'rect',
    x: 200,
    y: 100,
    width: 1024,
    height: 1536,
    lockAspectRatio: true,
    fill: '/photo-colors-1.png',
    zIndex: 0,
    version: 0,
    filter: 'liquid-glass(4, 3, 0.1, 0.3, 0, 0.06, 0, 0.7, 2.3, 5.2, 6.9, 0.5, 0.75, 1, 1, 1, 0.5)'
  } as const,
];

export function PhotoColorsTool() {
  const t = useTranslations('tools');
  const tItem = useTranslations('tools.items.photoColors');

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar hideCenterContent />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{tItem('title')}</h1>
        </header>
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
              ]
            }} />
          </div>
        </div>
      </main>
    </div>
  );
}
