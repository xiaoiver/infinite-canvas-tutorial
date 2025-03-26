import {
  Plugin,
  HierarchyPlugin,
  RendererPlugin,
  TransformPlugin,
  CanvasPlugin,
  CameraPlugin,
  EventPlugin,
  ScreenshotPlugin,
  PenPlugin,
} from './plugins';

export * from './App';
export * from './commands';
export * from './components';
export * from './plugins';
export * from './systems';
export * from './environment';
export {
  svgElementsToSerializedNodes,
  serializedNodesToEntities,
  randomInteger,
  type SerializedNode,
} from './utils';

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
  CanvasPlugin,
  CameraPlugin,
  EventPlugin,
  RendererPlugin,
  ScreenshotPlugin,
  PenPlugin,
];
