import { Plugin } from '@infinite-canvas-tutorial/ecs';
import { DownloadScreenshotSystem, ZoomLevelSystem } from '../systems';
import { Container } from '../components';

export const UIPlugin: Plugin = () => {
  return [Container, ZoomLevelSystem];
};
