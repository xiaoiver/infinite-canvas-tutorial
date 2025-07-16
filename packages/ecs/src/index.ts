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

export * from './API';
export * from './App';
export * from './commands';
export * from './components';
export * from './plugins';
export * from './systems';
export * from './environment';
export * from './context';
export {
  svgSvgElementToComputedCamera,
  svgElementsToSerializedNodes,
  serializedNodesToEntities,
  randomInteger,
  isGradient,
  isPattern,
  parseGradient,
  serializePoints,
  deserializePoints,
  createSVGElement,
  exportFillGradientOrPattern,
  loadBitmapFont,
  parseClipboard,
  createPasteEvent,
  readSystemClipboard,
  isSupportedImageFileType,
  type Gradient,
  type SerializedNode,
  type OrderedSerializedNode,
  type EllipseSerializedNode,
  type RectSerializedNode,
  type PolylineSerializedNode,
  type PathSerializedNode,
  type TextSerializedNode,
} from './utils';
export { TexturePool } from './resources';

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
