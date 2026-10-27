/** Node-safe `.ic` document format, validation, and serialization. */
import type { AppState } from '../context';
import type { ThemeStateLike } from '../components/Theme';
import type { SerializedNode } from '../types/serialized-node';
import type { DesignVariablesMap } from '../utils/design-variables';
import { ThemeMode, CheckboardStyle } from './modes';
import { validateDocument } from '../document';

export const IC_DOCUMENT_TYPE = 'infinite-canvas' as const;

/** 当前 JSON schema 版本；不兼容升级时递增。 */
export const IC_SCHEMA_VERSION = 1;

export const IC_FILE_SUFFIX = '.ic';

const nodeTypes = new Set<SerializedNode['type']>([
  'g',
  'rect',
  'ellipse',
  'line',
  'polyline',
  'path',
  'text',
  'brush',
  'rough-rect',
  'rough-ellipse',
  'rough-line',
  'rough-polyline',
  'rough-path',
  'vector-network',
  'html',
  'embed',
  'iconfont',
  'mesh3d',
  'light3d',
  'ref',
]);

/**
 * 与 Excalidraw 文件类似的顶层结构：`type` / `version` / `source` + 场景负载。
 * - `variables`：设计变量表（`$token` 引用源）
 * - `themes`：文档主题（亮/暗色板），对应运行时 `AppState.theme`
 * - `elements`：场景图节点（与 `API.getNodes()` 一致）
 * - `appState`：其余应用状态（不含 `variables` / `theme`，避免与上两项重复）
 */
export interface ICDocumentV1 {
  type: typeof IC_DOCUMENT_TYPE;
  version: typeof IC_SCHEMA_VERSION;
  source?: string;
  variables: DesignVariablesMap;
  themes: Partial<ThemeStateLike>;
  elements: SerializedNode[];
  appState: Partial<Omit<AppState, 'variables' | 'theme'>>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function buildIcDocumentFromState(
  appState: AppState,
  elements: SerializedNode[],
  source?: string,
): ICDocumentV1 {
  const { variables, theme, ...rest } = appState;
  return {
    type: IC_DOCUMENT_TYPE,
    version: IC_SCHEMA_VERSION,
    source: source ?? 'https://infinitecanvas.cc',
    variables: { ...variables },
    themes: {
      mode: theme.mode,
      colors: {
        [ThemeMode.LIGHT]: { ...theme.colors[ThemeMode.LIGHT] },
        [ThemeMode.DARK]: { ...theme.colors[ThemeMode.DARK] },
      },
    },
    elements: elements.map((n) => ({ ...n })),
    appState: { ...rest },
  };
}

export function stringifyIcDocument(doc: ICDocumentV1, space = 2): string {
  return JSON.stringify(doc, null, space);
}

export function parseIcDocumentJson(raw: unknown): ICDocumentV1 {
  const data = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (!isPlainObject(data)) {
    throw new Error('IC document must be a JSON object');
  }
  if (data.type !== IC_DOCUMENT_TYPE) {
    throw new Error(
      `Invalid IC document type: expected "${IC_DOCUMENT_TYPE}", got ${JSON.stringify(
        data.type,
      )}`,
    );
  }
  if (data.version !== IC_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported IC schema version: ${String(
        data.version,
      )} (supported: ${IC_SCHEMA_VERSION})`,
    );
  }
  if (!isPlainObject(data.variables)) {
    throw new Error('IC document "variables" must be an object');
  }
  if (!isPlainObject(data.themes)) {
    throw new Error('IC document "themes" must be an object');
  }
  if (!Array.isArray(data.elements)) {
    throw new Error('IC document "elements" must be an array');
  }
  if (!isPlainObject(data.appState)) {
    throw new Error('IC document "appState" must be an object');
  }
  for (const key of [
    'layersSelected',
    'layersHighlighted',
    'layersExpanded',
    'propertiesOpened',
    'layersCropping',
    'layersLassoing',
  ]) {
    const ids = data.appState[key];
    if (
      ids !== undefined &&
      (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string'))
    ) {
      throw new Error(`IC document appState.${key} must be an array of IDs`);
    }
  }
  for (const key of ['cameraX', 'cameraY', 'cameraZoom', 'cameraRotation']) {
    const value = data.appState[key];
    if (
      value !== undefined &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (key === 'cameraZoom' && value <= 0))
    ) {
      throw new Error(`Invalid IC document appState.${key}`);
    }
  }
  for (const mode of [data.themes.mode, data.appState.themeMode]) {
    if (
      mode !== undefined &&
      mode !== ThemeMode.LIGHT &&
      mode !== ThemeMode.DARK
    ) {
      throw new Error('IC document theme mode must be light or dark');
    }
  }
  const grid = data.appState.checkboardStyle;
  if (
    grid !== undefined &&
    !Object.values(CheckboardStyle).includes(grid as CheckboardStyle)
  ) {
    throw new Error('Invalid IC document appState.checkboardStyle');
  }
  for (const node of data.elements) {
    if (!isPlainObject(node) || typeof node.id !== 'string' || !node.id) {
      throw new Error('IC document elements must have non-empty string IDs');
    }
    if (!nodeTypes.has(node.type as SerializedNode['type'])) {
      throw new Error(`Unsupported IC element type: ${String(node.type)}`);
    }
    if (node.parentId != null && typeof node.parentId !== 'string') {
      throw new Error(`Invalid parent ID for IC element ${node.id}`);
    }
  }
  validateDocument(
    (data.elements as SerializedNode[]).filter((node) => !node.isDeleted),
  );
  return data as unknown as ICDocumentV1;
}
