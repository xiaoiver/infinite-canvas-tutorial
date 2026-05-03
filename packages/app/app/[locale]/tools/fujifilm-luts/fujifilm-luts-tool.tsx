'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import Canvas from '@/components/canvas';
import {
  GPUResource,
  Pen,
  registerCubeLutFromText,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { Task } from '@infinite-canvas-tutorial/ecs';

const LUT_SOURCES = [
  { url: '/luts/classic_neg_sRGB.cube', key: 'fuji-classic-neg' },
  { url: '/luts/classic_chrome_sRGB.cube', key: 'fuji-classic-chrome' },
  { url: '/luts/velvia_sRGB.cube', key: 'fuji-velvia' },
  { url: '/luts/astia_sRGB.cube', key: 'fuji-astia' },
  { url: '/luts/eterna_sRGB.cube', key: 'fuji-eterna' },
  { url: '/luts/bleach bypass_sRGB.cube', key: 'fuji-bleach' },
] as const;

const DEMO_IMAGE =
  'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg';

const FUJIFILM_PROFILES_REPO_HREF =
  'https://github.com/abpy/FujifilmCameraProfiles';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: 'fuji-lut-classic-neg',
    type: 'rect',
    name: 'Classic Neg',
    x: 200,
    y: 100,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
    filter: 'lut(fuji-classic-neg)',
  } as const,
  {
    id: 'fuji-lut-raw',
    type: 'rect',
    name: 'Raw',
    x: 200,
    y: -800,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
  } as const,
  {
    id: 'fuji-lut-classic-chrome',
    type: 'rect',
    name: 'Classic Chrome',
    x: 1100,
    y: 100,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
    filter: 'lut(fuji-classic-chrome)',
  } as const,
  {
    id: 'fuji-lut-velvia',
    type: 'rect',
    name: 'Velvia',
    x: 200,
    y: 1000,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
    filter: 'lut(fuji-velvia)',
  } as const,
  {
    id: 'fuji-lut-astia',
    type: 'rect',
    name: 'Astia',
    x: 1100,
    y: 1000,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
    filter: 'lut(fuji-astia)',
  } as const,
  {
    id: 'fuji-lut-bleach',
    type: 'rect',
    name: 'Bleach Bypass',
    x: 200,
    y: 1900,
    width: 800,
    height: 800,
    lockAspectRatio: true,
    fill: DEMO_IMAGE,
    zIndex: 0,
    version: 0,
    filter: 'lut(fuji-bleach)',
  } as const,
];

async function registerFujiCubeLuts(api: ExtendedAPI) {
  const device = api.getCanvas().read(GPUResource).device;
  await Promise.all(
    LUT_SOURCES.map(async ({ url, key }) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`LUT ${key}: GET ${url} → ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      registerCubeLutFromText(device, key, text, { atlasFormat: 'f32' });
    }),
  );
}

export function FujifilmLutsTool() {
  const tItem = useTranslations('tools.items.fujifilmLuts');
  const prepareCanvas = useCallback(async (api: ExtendedAPI) => {
    await registerFujiCubeLuts(api);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar hideCenterContent />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tItem('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tItem.rich('description', {
              repo: (chunks) => (
                <a
                  href={FUJIFILM_PROFILES_REPO_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2 hover:text-primary"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="h-[720px] w-full flex-1">
            <Canvas
              id="fujifilm-luts"
              initialData={DEFAULT_NODES}
              prepareCanvas={prepareCanvas}
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
                  Pen.IMAGE,
                  Pen.LASER_POINTER,
                  Pen.ERASER,
                ],
                taskbarSelected: [Task.SHOW_PROPERTIES_PANEL],
                penbarNameLabelVisible: true,
                contextBarVisible: true
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
