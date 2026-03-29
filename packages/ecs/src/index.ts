import {
  type Plugin,
  HierarchyPlugin,
  DefaultRendererPlugin,
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
  safeAddComponent,
  safeRemoveComponent,
} from './history';
export {
  svgSvgElementToComputedCamera,
  svgElementsToSerializedNodes,
  serializedNodesToEntities,
  serializeNodesToSVGElements,
  applySvgDataAttributesToElement,
  imageToCanvas,
  randomInteger,
  isGradient,
  isPattern,
  isDataUrl,
  isUrl,
  isBrowser,
  parseGradient,
  computeLinearGradient,
  computeRadialGradient,
  computeConicGradient,
  parseEffect,
  parseColor,
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
  cloneSerializedNodes,
  createPasteEvent,
  readSystemClipboard,
  isSupportedImageFileType,
  inferXYWidthHeight,
  inferPointsWithFromIdAndToId,
  layoutTextAnchoredInParent,
  pointAlongPolylineByT,
  getSvgPathFromStroke,
  distanceBetweenPoints,
  filterUndefined,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
  EdgeStyle,
  type Gradient,
  type Effect,
} from './utils';
export * from './types/serialized-node';
export type { EdgeState } from './utils/binding/connection';
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
  DefaultRendererPlugin,
  ScreenshotPlugin,
  PenPlugin,
  HTMLPlugin,
];
