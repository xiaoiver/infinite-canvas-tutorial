'use client';

import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import Canvas from '@/components/canvas';
import {
  Pen,
  SerializedNode,
  Task,
} from '@infinite-canvas-tutorial/ecs';

const DEMO_IMAGE =
  'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: 'rain-effect',
    type: 'rect',
    name: 'rain()',
    x: 1100,
    y: 100,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fills: [{ type: 'image', value: DEMO_IMAGE, opacity: 1 }],
    zIndex: 0,
    version: 0,
    filter: 'blur() rain()',
  } as const,
  {
    id: 'rain-raw',
    type: 'rect',
    name: 'Original',
    x: 200,
    y: 100,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fills: [{ type: 'image', value: DEMO_IMAGE, opacity: 1 }],
    zIndex: 0,
    version: 0,
  } as const,
];

export function RainTool() {
  const tItem = useTranslations('tools.items.rain');

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar hideCenterContent />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tItem('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{tItem('description')}</p>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="h-[720px] w-full flex-1">
            <Canvas
              id="rain"
              initialData={DEFAULT_NODES}
              initialAppState={{
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
                  Pen.DRAW_ICONFONT,
                  Pen.IMAGE,
                  Pen.LASER_POINTER,
                  Pen.ERASER,
                ],
                taskbarSelected: [Task.SHOW_PROPERTIES_PANEL],
                penbarNameLabelVisible: true,
                propertiesPanelSectionsOpen: {
                  fillSection: false,
                  strokeSection: false,
                  typographySection: false,
                  shape: false,
                  transform: false,
                  layout: false,
                  flexItem: false,
                  effects: true,
                  multiSelectAlignment: false,
                  multiSelectEffects: false,
                  exportSection: true,
                  iconFont: false,
                },
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
