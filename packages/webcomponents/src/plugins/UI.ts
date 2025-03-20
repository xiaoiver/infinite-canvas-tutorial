import { Plugin } from '@infinite-canvas-tutorial/ecs';
import {
  DownloadScreenshotSystem,
  InitCanvasSystem,
  ZoomLevelSystem,
} from '../systems';

let worldCounter = 0;

export const UIPlugin: Plugin = (props) => {
  const defs = [InitCanvasSystem, ZoomLevelSystem, DownloadScreenshotSystem];
  defs.forEach((def, i) => {
    Object.defineProperty(def, 'name', {
      value: `${def.name}-${worldCounter++}`,
    });
  });

  return [
    InitCanvasSystem,
    props,
    ZoomLevelSystem,
    props,
    DownloadScreenshotSystem,
    props,
  ];
};
