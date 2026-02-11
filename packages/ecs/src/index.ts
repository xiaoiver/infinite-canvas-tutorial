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
  HTMLPlugin,
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
  serializeNodesToSVGElements,
  randomInteger,
  isGradient,
  isPattern,
  isDataUrl,
  isUrl,
  isBrowser,
  parseGradient,
  parseEffect,
  serializePoints,
  deserializePoints,
  createSVGElement,
  exportFillGradientOrPattern,
  exportFillImage,
  exportMarker,
  toSVG,
  toSVGDataURL,
  toDomPrecision,
  loadBitmapFont,
  parseClipboard,
  createPasteEvent,
  readSystemClipboard,
  isSupportedImageFileType,
  inferXYWidthHeight,
  getSvgPathFromStroke,
  distanceBetweenPoints,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
  type Gradient,
  type Effect,
  type SerializedNode,
  type OrderedSerializedNode,
  type EllipseSerializedNode,
  type RectSerializedNode,
  type LineSerializedNode,
  type PolylineSerializedNode,
  type PathSerializedNode,
  type TextSerializedNode,
  type RoughAttributes,
  type StrokeAttributes,
  type FillAttributes,
  type MarkerAttributes,
  type BindingAttributes,
  type BindedAttributes
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

export { type IPointData } from '@pixi/math';

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
  HTMLPlugin,
];
