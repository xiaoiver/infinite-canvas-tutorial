import { App, Plugin, PreStartUp, System } from '@infinite-canvas-tutorial/ecs';
import { DownloadScreenshotSystem, InitCanvasSystem } from '../systems';

export const UIPlugin: Plugin = (app: App, props) => {
  const group = System.group(
    InitCanvasSystem,
    props,
    DownloadScreenshotSystem,
    props,
  );

  group.schedule((s) => s.before(PreStartUp));

  app.addGroup(group);
};
