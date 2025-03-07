import {
  Plugin,
  HierarchyPlugin,
  RendererPlugin,
  TransformPlugin,
  CameraPlugin,
} from './plugins';

export * from './App';
export * from './commands/Commands';
export * from './components';
export * from './plugins';
export * from './systems';

export {
  component,
  field,
  Type,
  World,
  System,
  system,
  type Entity,
} from '@lastolivegames/becsy';

export const DefaultPlugins: Plugin[] = [
  HierarchyPlugin,
  TransformPlugin,
  RendererPlugin,
  CameraPlugin,
];
