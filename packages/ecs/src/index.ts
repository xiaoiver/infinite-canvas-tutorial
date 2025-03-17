import {
  Plugin,
  HierarchyPlugin,
  RendererPlugin,
  TransformPlugin,
  CameraPlugin,
  EventPlugin,
  ScreenshotPlugin,
} from './plugins';

export * from './App';
export * from './commands/Commands';
export * from './components';
export * from './plugins';
export * from './systems';
export * from './environment';

export {
  co,
  component,
  system,
  field,
  Type,
  World,
  System,
  type Entity,
} from '@lastolivegames/becsy';

export const DefaultPlugins: Plugin[] = [
  HierarchyPlugin,
  TransformPlugin,
  CameraPlugin,
  EventPlugin,
  RendererPlugin,
  ScreenshotPlugin,
];
