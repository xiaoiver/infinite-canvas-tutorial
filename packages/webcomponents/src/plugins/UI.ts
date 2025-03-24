import {
  Camera,
  component,
  Plugin,
  PreStartUp,
  SetupDevice,
  system,
} from '@infinite-canvas-tutorial/ecs';
import { DownloadScreenshotSystem, ZoomLevelSystem } from '../systems';
import { Container } from '../components';

export const UIPlugin: Plugin = () => {
  component(Container);

  system((s) => s.inAnyOrderWithWritersOf(Camera).after(SetupDevice))(
    ZoomLevelSystem,
  );
  system((s) => s.before(PreStartUp))(DownloadScreenshotSystem);
};
