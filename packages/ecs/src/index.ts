import {
  type Plugin,
  HierarchyPlugin,
  RendererPlugin,
  TransformPlugin,
  CanvasPlugin,
  CameraPlugin,
  EventPlugin,
  ScreenshotPlugin,
  PenPlugin,
  CullingPlugin,
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
  type OrderedSerializedNode,
  type CircleSerializedNode,
  type EllipseSerializedNode,
  type RectSerializedNode,
  type PolylineSerializedNode,
  type PathSerializedNode,
  type TextSerializedNode,
} from './utils';

export {
  co,
  component,
  system,
  field,
  Type,
  World,
  System,
  type ComponentType,
  type Entity,
} from '@lastolivegames/becsy';

export const DefaultPlugins: Plugin[] = [
  HierarchyPlugin,
  TransformPlugin,
  CanvasPlugin,
  CameraPlugin,
  EventPlugin,
  CullingPlugin,
  RendererPlugin,
  ScreenshotPlugin,
  PenPlugin,
];
