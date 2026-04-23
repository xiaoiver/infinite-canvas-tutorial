import {
  Pen,
  CheckboardStyle,
  Theme,
  ThemeMode,
  ThemePreference,
  resolveThemeModeFromPreference,
  DEFAULT_THEME_COLORS,
  BrushType,
  StampMode,
} from './components';
import {
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
} from './systems/RenderTransformer';
import type {
  BrushAttributes,
  FillAttributes,
  MarkerAttributes,
  RoughAttributes,
  SerializedNode,
  StrokeAttributes,
  TextSerializedNode,
} from './types/serialized-node';
import type { DesignVariablesMap } from './utils/design-variables';

export enum Task {
  SHOW_LAYERS_PANEL = 'show-layers-panel',
  SHOW_PROPERTIES_PANEL = 'show-properties-panel',
  SHOW_CHAT_PANEL = 'show-chat-panel',
}

/**
 * 属性面板各分区（accordion）的初始展开状态；`true` 为展开。
 * 可通过 `api.setAppState({ propertiesPanelSectionsOpen: { ... } })` 配置。
 */
export interface PropertiesPanelSectionsOpen {
  shape: boolean;
  transform: boolean;
  layout: boolean;
  /** 父级为 flex 容器时，子项的 flex 属性（align-self、flex-grow 等） */
  flexItem: boolean;
  effects: boolean;
  /** 多选时「对齐」手风琴 */
  multiSelectAlignment: boolean;
  /** 多选时「效果」手风琴 */
  multiSelectEffects: boolean;
}

/**
 * Prefer flat objects.
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata
 */
export interface AppState {
  language: string;
  /**
   * 文档级设计变量（Pencil 式 token）；节点属性可用 `$token.name` 引用。
   */
  variables: DesignVariablesMap;
  theme: Theme;
  themeMode: ThemeMode;
  /**
   * 用户选择的亮/暗/跟随系统；`themeMode` 为解析后的当前生效模式。
   */
  themePreference: ThemePreference;
  checkboardStyle: CheckboardStyle;
  cameraZoom: number;
  cameraX: number;
  cameraY: number;
  cameraRotation: number;
  cameraZoomFactor: number;
  contextBarVisible: boolean;
  contextMenuVisible: boolean;
  topbarVisible: boolean;
  penbarVisible: boolean;
  penbarAll: Pen[];
  penbarSelected: Pen;
  penbarDrawSizeLabelVisible: boolean;
  penbarDrawRect: Partial<StrokeAttributes & FillAttributes>;
  penbarDrawTriangle: Partial<StrokeAttributes & FillAttributes>;
  penbarDrawPentagon: Partial<StrokeAttributes & FillAttributes>;
  penbarDrawHexagon: Partial<StrokeAttributes & FillAttributes>;
  penbarDrawEllipse: Partial<StrokeAttributes & FillAttributes>;
  penbarDrawLine: Partial<StrokeAttributes>;
  penbarDrawArrow: Partial<StrokeAttributes & MarkerAttributes>;
  penbarDrawRoughRect: Partial<
    RoughAttributes & StrokeAttributes & FillAttributes
  >;
  penbarDrawRoughEllipse: Partial<
    RoughAttributes & StrokeAttributes & FillAttributes
  >;
  penbarDrawRoughLine: Partial<RoughAttributes & StrokeAttributes>;
  penbarPencil: Partial<
    StrokeAttributes & {
      freehand: boolean;
    }
  >;
  penbarBrush: Partial<
    BrushAttributes &
    StrokeAttributes & {
      stamps: { src: string; name: string; preview: string; active?: boolean }[];
    }
  >;
  penbarText: Partial<
    TextSerializedNode & {
      fontFamilies: string[];
    }
  >;
  penbarLasso: Partial<
    FillAttributes & StrokeAttributes & {
      mode: 'draw' | 'select';
      trailStroke: string;
      trailFill: string;
      trailFillOpacity: number;
      trailStrokeDasharray: string;
      trailStrokeDashoffset: string;
    }
  >;
  taskbarVisible: boolean;
  taskbarAll: Task[];
  taskbarSelected: Task[];
  taskbarChatMessages: Message[];
  layersSelected: SerializedNode['id'][];
  layersHighlighted: SerializedNode['id'][];
  layersExpanded: SerializedNode['id'][];
  propertiesOpened: SerializedNode['id'][];
  /**
   * 属性面板 Shape / Transform / Layout / Effects / 多选对齐与效果 分区的默认展开状态
   */
  propertiesPanelSectionsOpen: PropertiesPanelSectionsOpen;
  /**
   * Like croppingElementId in Excalidraw
   * @see https://github.com/excalidraw/excalidraw/pull/8613
   */
  layersCropping: SerializedNode['id'][];
  layersLassoing: SerializedNode['id'][];
  /**
   * Allow rotate in transformer
   */
  rotateEnabled: boolean;
  /**
   * Allow flip in transformer
   */
  flipEnabled: boolean;

  /**
   * Allow snap to pixel grid
   */
  snapToPixelGridEnabled: boolean;
  snapToPixelGridSize: number;

  /**
   * Allow snap to objects
   */
  snapToObjectsEnabled: boolean;

  /**
   * Snip distance for objects
   */
  snapToObjectsDistance: number;
  snapLineStroke: string;
  snapLineStrokeWith: number;

  /**
   * Points in editing mode.
   */
  editingPoints: [number, number][];

  /**
   * loading state
   */
  loading: boolean;
  loadingMessage: string;

  /**
   * Global effects
   */
  filter: string;

  /**
   * Global illumination with radiance cascades
   */
  giEnabled: boolean;
  /**
   * Global illumination strength
   */
  giStrength: number;
}

export const getDefaultAppState: () => AppState = () => {
  const themePreference: ThemePreference = 'system';
  const themeMode = resolveThemeModeFromPreference(themePreference);
  return {
    language: 'en',
    variables: {},
    themePreference,
    themeMode,
    theme: {
      mode: themeMode,
      colors: {
        [ThemeMode.LIGHT]: {
          ...DEFAULT_THEME_COLORS[ThemeMode.LIGHT],
          swatches: [
            TRANSFORMER_ANCHOR_STROKE_COLOR,
            TRANSFORMER_MASK_FILL_COLOR,
            'black',
            'white',
            'red',
            'green',
            'yellow',
          ],
        },
        [ThemeMode.DARK]: {
          ...DEFAULT_THEME_COLORS[ThemeMode.DARK],
          swatches: [
            TRANSFORMER_ANCHOR_STROKE_COLOR,
            TRANSFORMER_MASK_FILL_COLOR,
            'black',
            'white',
            'red',
            'green',
            'yellow',
          ],
        },
      },
    },
    checkboardStyle: CheckboardStyle.GRID,
    cameraZoom: 1,
    cameraX: 0,
    cameraY: 0,
    cameraRotation: 0,
    cameraZoomFactor: 0.02,
    contextBarVisible: true,
    contextMenuVisible: true,
    topbarVisible: true,
    penbarVisible: true,
    penbarAll: [
      Pen.HAND,
      Pen.SELECT,
      Pen.DRAW_RECT,
      Pen.DRAW_TRIANGLE,
      Pen.DRAW_PENTAGON,
      Pen.DRAW_HEXAGON,
      Pen.DRAW_ELLIPSE,
      Pen.DRAW_LINE,
      Pen.DRAW_ARROW,
      Pen.DRAW_ROUGH_RECT,
      Pen.DRAW_ROUGH_ELLIPSE,
      Pen.DRAW_ROUGH_LINE,
      Pen.IMAGE,
      Pen.TEXT,
      Pen.PENCIL,
      Pen.BRUSH,
      Pen.ERASER,
      // Pen.VECTOR_NETWORK,
      Pen.COMMENT,
      Pen.LASER_POINTER,
    ],
    penbarSelected: Pen.HAND,
    penbarDrawSizeLabelVisible: true,
    penbarDrawRect: {
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawTriangle: {
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawPentagon: {
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawHexagon: {
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawEllipse: {
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawLine: {
      fill: 'none',
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    penbarDrawArrow: {
      fill: 'none',
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
      markerStart: 'none',
      markerEnd: 'line',
      markerFactor: 3,
    },
    penbarDrawRoughRect: {
      fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
      fillOpacity: 1,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 4,
      strokeOpacity: 1,
      roughBowing: 1,
      roughRoughness: 1,
      roughFillStyle: 'hachure',
    },
    penbarDrawRoughEllipse: {
      fill: TRANSFORMER_ANCHOR_STROKE_COLOR,
      fillOpacity: 1,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 4,
      strokeOpacity: 1,
      roughBowing: 1,
      roughRoughness: 1,
      roughFillStyle: 'hachure',
    },
    penbarDrawRoughLine: {
      fill: 'none',
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
      roughBowing: 1,
      roughRoughness: 4,
    },
    penbarPencil: {
      fill: 'none',
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    penbarBrush: {
      stamps: [
        {
          src: '/stamp1.png',
          name: 'Stamp 1',
          preview: '/stamp1.png',
          active: true,
        },
        {
          src: '/stamp2.png',
          name: 'Stamp 2',
          preview: '/stamp2.png',
        },
      ],
      brushType: BrushType.STAMP,
      stampInterval: 0.4,
      stampMode: StampMode.RATIO_DISTANCE,
      stampNoiseFactor: 0.4,
      stampRotationFactor: 0.75,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 20,
      strokeOpacity: 1,
    },
    penbarText: {
      fontFamily: 'system-ui',
      fontFamilies: ['system-ui', 'serif', 'monospace'],
      fontSize: 16,
      fontStyle: 'normal',
      fill: '#000',
    },
    penbarLasso: {
      mode: 'select',
      trailFill: TRANSFORMER_MASK_FILL_COLOR,
      trailFillOpacity: 0.5,
      trailStroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      fill: TRANSFORMER_MASK_FILL_COLOR,
      fillOpacity: 0.5,
      stroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
      strokeWidth: 1,
      strokeOpacity: 1,
    },
    taskbarVisible: true,
    taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    taskbarSelected: [],
    taskbarChatMessages: [],
    layersSelected: [],
    layersHighlighted: [],
    layersCropping: [],
    layersLassoing: [],
    propertiesOpened: [],
    propertiesPanelSectionsOpen: {
      shape: true,
      transform: true,
      layout: true,
      flexItem: true,
      effects: true,
      multiSelectAlignment: true,
      multiSelectEffects: true,
    },
    layersExpanded: [],
    rotateEnabled: true,
    flipEnabled: false,
    snapToPixelGridEnabled: false,
    snapToPixelGridSize: 10,
    snapToObjectsEnabled: false,
    snapToObjectsDistance: 8,
    snapLineStroke: 'orange',
    snapLineStrokeWith: 1,
    editingPoints: [],
    loading: false,
    loadingMessage: '',
    filter: '',
    giEnabled: false,
    giStrength: 0.1,
  };
};

export const SIBLINGS_MAX_Z_INDEX = 1000000;
export const SIBLINGS_MIN_Z_INDEX = -1000000;
export const TRANSFORMER_Z_INDEX = SIBLINGS_MAX_Z_INDEX * 10;
export const HIGHLIGHTER_Z_INDEX = TRANSFORMER_Z_INDEX - 1;
export const DRAW_RECT_Z_INDEX = HIGHLIGHTER_Z_INDEX - 10;
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  references?: {
    id: string;
  }[];
  images?: {
    url: string;
  }[];
  suggestions?: {
    text: string;
  }[];
}
