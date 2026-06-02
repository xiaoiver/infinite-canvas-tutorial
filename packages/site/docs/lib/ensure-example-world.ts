import {
  App,
  DefaultPlugins,
  DefaultRendererPlugin,
  DefaultRenderer3DPlugin,
  RendererPlugin,
  type Plugin,
} from '@infinite-canvas-tutorial/ecs';
import { FilterPlugin } from '@infinite-canvas-tutorial/filter';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import {
  InitVello,
  VelloPipeline,
  registerFont,
} from '@infinite-canvas-tutorial/vello';

export type EnsureExampleWorldOptions = {
  vello?: boolean;
  velloFonts?: string[];
};

const DEFAULT_INTERACTION_PLUGINS: Plugin[] = [
  UIPlugin,
  EraserPlugin,
  LaserPointerPlugin,
  LassoPlugin,
  YogaPlugin,
];

let startPromise: Promise<void> | undefined;
let webComponentsRegistered = false;

async function registerExampleWebComponents() {
  if (webComponentsRegistered) {
    return;
  }
  webComponentsRegistered = true;

  await Promise.all([
    import('@infinite-canvas-tutorial/webcomponents/spectrum'),
    import('@infinite-canvas-tutorial/lasso/spectrum'),
    import('@infinite-canvas-tutorial/eraser/spectrum'),
    import('@infinite-canvas-tutorial/laser-pointer/spectrum'),
  ]);
}

function buildRendererPlugins(options?: EnsureExampleWorldOptions): Plugin[] {
  let plugins: Plugin[] = [...DefaultPlugins];

  if (options?.vello) {
    const velloRendererPlugin = RendererPlugin.configure({
      setupDeviceSystemCtor: InitVello,
      rendererSystemCtor: VelloPipeline,
    });
    const rendererIndex = plugins.indexOf(DefaultRendererPlugin);
    if (rendererIndex >= 0) {
      plugins = [
        ...plugins.slice(0, rendererIndex),
        velloRendererPlugin,
        ...plugins.slice(rendererIndex + 1),
      ];
    }
    for (const fontUrl of options.velloFonts ?? []) {
      registerFont(fontUrl);
    }
    // MeshPipeline3D attaches SetupDevice; FilterPlugin schedules before MeshPipeline.
    return plugins;
  }

  return [...plugins, DefaultRenderer3DPlugin, FilterPlugin];
}

export async function ensureExampleWorld(
  extraPlugins: Plugin[] = [],
  options?: EnsureExampleWorldOptions,
): Promise<void> {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    await registerExampleWebComponents();

    const rendererPlugins = buildRendererPlugins(options);
    const interaction =
      extraPlugins.length > 0 ? extraPlugins : DEFAULT_INTERACTION_PLUGINS;

    await new App()
      .addPlugins(...rendererPlugins, ...interaction)
      .run();
  })();

  return startPromise;
}
