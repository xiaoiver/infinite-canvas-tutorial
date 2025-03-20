import { Plugin } from '@infinite-canvas-tutorial/ecs';
import {
  DownloadScreenshotSystem,
  InitCanvasSystem,
  ZoomLevelSystem,
} from '../systems';

export const UIPlugin: Plugin = (props) => {
  return [
    InitCanvasSystem,
    props,
    ZoomLevelSystem,
    props,
    DownloadScreenshotSystem,
    props,
  ];
};
