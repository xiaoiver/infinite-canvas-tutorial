import {
  Plugin,
  HierarchyPlugin,
  RendererPlugin,
  TransformPlugin,
  CameraPlugin,
  EventPlugin,
} from './plugins';

export * from './App';
export * from './commands/Commands';
export * from './components';
export * from './plugins';
export * from './systems';

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
  RendererPlugin,
  CameraPlugin,
  EventPlugin,
];
