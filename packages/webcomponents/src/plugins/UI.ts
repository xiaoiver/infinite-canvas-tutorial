import {
  Camera,
  Canvas,
  component,
  Plugin,
  PreStartUp,
  PropagateTransforms,
  SetupDevice,
  SyncSimpleTransforms,
  system,
} from '@infinite-canvas-tutorial/ecs';
import {
  DownloadScreenshotSystem,
  InitCanvasSystem,
  ZoomLevelSystem,
} from '../systems';
import { Container } from '../components';

export const UIPlugin: Plugin = () => {
  component(Container);

  /**
   * Solve the following error:
   * Uncaught (in promise) p: Multiple component types named o; names must be unique at eG.createSystems
   *
   * Usually, this error is caused when the code is bundled.
   */
  Object.defineProperty(InitCanvasSystem, 'name', {
    value: 'InitCanvasSystem',
  });
  Object.defineProperty(ZoomLevelSystem, 'name', {
    value: 'ZoomLevelSystem',
  });
  Object.defineProperty(DownloadScreenshotSystem, 'name', {
    value: 'DownloadScreenshotSystem',
  });

  system((s) =>
    s.after(PreStartUp).before(ZoomLevelSystem).beforeWritersOf(Canvas),
  )(InitCanvasSystem);
  system((s) =>
    s
      .inAnyOrderWithWritersOf(Camera)
      .after(SetupDevice, SyncSimpleTransforms, PropagateTransforms),
  )(ZoomLevelSystem);
  system((s) => s.before(PreStartUp))(DownloadScreenshotSystem);
};
