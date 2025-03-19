import {
  App,
  Plugin,
  PreStartUp,
  system,
  System,
} from '@infinite-canvas-tutorial/ecs';
import {
  DownloadScreenshotSystem,
  InitCanvasSystem,
  ZoomLevelSystem,
} from '../systems';

export const UIPlugin: Plugin = (app: App, props) => {
  const group = System.group(
    InitCanvasSystem,
    props,
    ZoomLevelSystem,
    props,
    DownloadScreenshotSystem,
    props,
  );

  group.schedule((s) => s.before(PreStartUp));

  system((s) => s.after(InitCanvasSystem))(ZoomLevelSystem);

  app.addGroup(group);
};
