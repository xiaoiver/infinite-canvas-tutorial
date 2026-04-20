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
  AnimationPlugin,
} from './plugins';

export * from './API';
export * from './App';
export * from './commands';
export * from './components';
export * from './plugins';
export * from './animation';
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
  formatNumber,
  parseGradient,
  computeLinearGradient,
  computeRadialGradient,
  computeConicGradient,
  parseEffect,
  formatFilter,
  filterStringUsesEngineTimeCrt,
  filterStringUsesEngineTimePost,
  filterStringUsesEngineTimeGlitch,
  ADJUSTMENT_DEFAULTS,
  parseColor,
  cssColorToHex,
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
  applyPathPreserveLayoutFromSnapshot,
  inferPointsWithFromIdAndToId,
  inferEdgePoints,
  edgeEndsResolvable,
  hasTerminalPoint,
  layoutTextAnchoredInParent,
  pointAlongPolylineByT,
  getSvgPathFromStroke,
  distanceBetweenPoints,
  filterUndefined,
  isSaturateOnlyAdjustment,
  FLUTED_GLASS_DEFAULTS,
  CRT_DEFAULTS,
  VIGNETTE_DEFAULTS,
  vignetteUniformValues,
  ASCII_DEFAULTS,
  asciiUniformValues,
  GLITCH_DEFAULTS,
  glitchUniformValues,
  DIRECTION_EAST,
  DIRECTION_NORTH,
  DIRECTION_SOUTH,
  DIRECTION_WEST,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
  EdgeStyle,
  type Gradient,
  type Effect,
  type FlutedGlassEffect,
  type CrtEffect,
  type VignetteEffect,
  type AsciiEffect,
  type GlitchEffect,
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
  AnimationPlugin,
];
