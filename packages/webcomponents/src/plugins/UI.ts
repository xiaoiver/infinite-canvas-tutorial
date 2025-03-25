import {
  Camera,
  Canvas,
  component,
  Plugin,
  PreStartUp,
  SetupDevice,
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

  system((s) =>
    s.after(PreStartUp).before(ZoomLevelSystem).beforeWritersOf(Canvas),
  )(InitCanvasSystem);
  system((s) => s.inAnyOrderWithWritersOf(Camera).after(SetupDevice))(
    ZoomLevelSystem,
  );
  system((s) => s.before(PreStartUp))(DownloadScreenshotSystem);
};
