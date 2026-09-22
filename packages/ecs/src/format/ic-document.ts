/**
 * Infinite Canvas 场景互换格式（`.ic`），结构参考
 * [Excalidraw JSON Schema](https://docs.excalidraw.com/docs/codebase/json-schema)，
 * 并拆分出与 [Pencil variables / themes](https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes) 对齐的字段。
 */

import type { API } from '../API';
import { AppState, getDefaultAppState } from '../context';
import { Parent } from '../components';
import { ThemeMode, mergeThemeState, type ThemeStateLike } from '../components/Theme';
import type { SerializedNode } from '../types/serialized-node';
import type { DesignVariablesMap } from '../utils/design-variables';
import { DOMAdapter } from '../environment';

export const IC_DOCUMENT_TYPE = 'infinite-canvas' as const;

/** 当前 JSON schema 版本；不兼容升级时递增。 */
export const IC_SCHEMA_VERSION = 1;

export const IC_FILE_SUFFIX = '.ic';

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
  const data =
    typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (!isPlainObject(data)) {
    throw new Error('IC document must be a JSON object');
  }
  if (data.type !== IC_DOCUMENT_TYPE) {
    throw new Error(
      `Invalid IC document type: expected "${IC_DOCUMENT_TYPE}", got ${JSON.stringify(data.type)}`,
    );
  }
  if (data.version !== IC_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported IC schema version: ${String(data.version)} (supported: ${IC_SCHEMA_VERSION})`,
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
  return data as unknown as ICDocumentV1;
}

export function collectSceneRootNodeIds(api: API): string[] {
  const camera = api.getCamera();
  if (!camera.has(Parent)) {
    return [];
  }
  const out: string[] = [];
  for (const child of camera.read(Parent).children) {
    const node = api.getNodeByEntity(child);
    if (node) {
      out.push(node.id);
    }
  }
  return out;
}

function filterIdsByElementSet(
  ids: SerializedNode['id'][] | undefined,
  valid: Set<string>,
): SerializedNode['id'][] {
  return (ids ?? []).filter((id) => valid.has(id));
}

/**
 * 用文档内容替换当前场景：删除所有场景根节点，再写入 `appState` / `elements`。
 */
export function applyIcDocumentToApi(
  api: API,
  doc: ICDocumentV1,
  options?: { recordHistory?: boolean },
): void {
  const recordHistory = options?.recordHistory ?? true;
  const defaults = getDefaultAppState();
  const slice = {
    ...defaults,
    ...(doc.appState as Partial<Omit<AppState, 'variables' | 'theme'>>),
  };

  const mergedTheme = mergeThemeState(
    {
      mode: slice.themeMode ?? defaults.themeMode,
      colors: {
        [ThemeMode.LIGHT]: defaults.theme.colors[ThemeMode.LIGHT],
        [ThemeMode.DARK]: defaults.theme.colors[ThemeMode.DARK],
      },
    },
    doc.themes,
  );

  const validIds = new Set(doc.elements.map((e) => e.id));

  const rootIds = collectSceneRootNodeIds(api);
  if (rootIds.length > 0) {
    api.deleteNodesById(rootIds);
  }

  api.setAppState(
    {
      ...slice,
      variables: doc.variables ?? {},
      theme: {
        mode: mergedTheme.mode,
        colors: mergedTheme.colors,
      },
      themeMode: mergedTheme.mode,
      layersSelected: filterIdsByElementSet(slice.layersSelected, validIds),
      layersHighlighted: filterIdsByElementSet(slice.layersHighlighted, validIds),
      layersExpanded: filterIdsByElementSet(slice.layersExpanded, validIds),
      propertiesOpened: filterIdsByElementSet(slice.propertiesOpened, validIds),
      layersCropping: filterIdsByElementSet(slice.layersCropping, validIds),
      layersLassoing: filterIdsByElementSet(slice.layersLassoing, validIds),
    },
    { replaceVariables: true, recordDesignVariableUndo: false },
  );

  api.runAfterDeletedEntities(() => {
    if (doc.elements.length > 0) {
      api.updateNodes(doc.elements);
    }
    if (recordHistory) {
      api.record();
    }
  });
}

/** 在浏览器中触发下载（需 `DOMAdapter` 的 `document` 可用）。 */
export function downloadIcDocument(
  doc: ICDocumentV1,
  filename = `canvas${IC_FILE_SUFFIX}`,
): void {
  const json = stringifyIcDocument(doc);
  const win = DOMAdapter.get().getWindow();
  const docRef = DOMAdapter.get().getDocument();
  if (!win?.URL?.createObjectURL || !docRef?.createElement) {
    return;
  }
  const name = filename.endsWith(IC_FILE_SUFFIX) ? filename : `${filename}${IC_FILE_SUFFIX}`;
  const blob = new Blob([json], { type: 'application/json' });
  const url = win.URL.createObjectURL(blob);
  const a = docRef.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  docRef.body.appendChild(a);
  a.click();
  docRef.body.removeChild(a);
  win.URL.revokeObjectURL(url);
}
