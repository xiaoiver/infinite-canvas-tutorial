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
  '/glitch.png';

/** raindrop-fx demo defaults */
const RAINDROP_FX_FILTER = 'rain(url("/raindrop.png"))';

/**
 * Heavy wind + storm preset (raindrop-fx): dense spawn, strong gravity, wind drift,
 * thicker mist, more droplets/sec.
 */
const RAINDROP_FX_STORM_FILTER =
  'rain(url("/raindrop.png"), 4, 1, 5, 5, 1200, 8, 25, 0.95, 0.99, 0.45, 0.65, 0, 1, 0, 0.02, 0.02, 0.03, 0.95, 0.93, 1, -1, 1, 2, 0, 0.2, 0.2, 0.2, 0.8, 0, 0, 0, 256, 1, 12, 22, 3200, 4000, 0.35, 0.75, 0.06, 0.34, 0.25, 0.02, 0.06, 35, 120, 0.05, 0.25)';

function buildDefaultNodes(
  tItem: (key: string) => string,
): SerializedNode[] {
  return [
    {
      id: 'rain-gentle',
      type: 'rect',
      name: tItem('gentleLabel'),
      x: 780,
      y: 160,
      width: 512,
      height: 768,
      lockAspectRatio: true,
      fills: [{ type: 'image', value: DEMO_IMAGE, opacity: 1 }],
      zIndex: 0,
      version: 0,
      filter: RAINDROP_FX_FILTER,
    } as const,
    {
      id: 'rain-raw',
      type: 'rect',
      name: tItem('originalLabel'),
      x: 180,
      y: 160,
      width: 512,
      height: 768,
      lockAspectRatio: true,
      fills: [{ type: 'image', value: DEMO_IMAGE, opacity: 1 }],
      zIndex: 0,
      version: 0,
    } as const,
    {
      id: 'rain-storm',
      type: 'rect',
      name: tItem('stormLabel'),
      x: 780,
      y: 960,
      width: 512,
      height: 768,
      lockAspectRatio: true,
      fills: [{ type: 'image', value: DEMO_IMAGE, opacity: 1 }],
      zIndex: 0,
      version: 0,
      filter: RAINDROP_FX_STORM_FILTER,
    } as const,
  ];
}

export function RainTool() {
  const tItem = useTranslations('tools.items.rain');
  const defaultNodes = buildDefaultNodes(tItem);

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
              initialData={defaultNodes}
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
