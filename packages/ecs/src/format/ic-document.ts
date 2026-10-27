/** Browser/ECS integration for `.ic`; pure format helpers live in ic-document-core. */
import type { API } from '../API';
import { getDefaultAppState, type AppState } from '../context';
import { Parent } from '../components';
import { ThemeMode } from './modes';
import { mergeThemeState } from '../components/Theme';
import type { SerializedNode } from '../types/serialized-node';
import { DOMAdapter } from '../environment';
import {
  IC_FILE_SUFFIX,
  stringifyIcDocument,
  type ICDocumentV1,
} from './ic-document-core';
export {
  IC_DOCUMENT_TYPE,
  IC_SCHEMA_VERSION,
  IC_FILE_SUFFIX,
  buildIcDocumentFromState,
  stringifyIcDocument,
  parseIcDocumentJson,
  type ICDocumentV1,
} from './ic-document-core';

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
 * 在 api.edit() 的同步回调中替换文档，与外层编辑共享一次提交。
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

  const validIds = new Set(
    doc.elements.filter((node) => !node.isDeleted).map((e) => e.id),
  );
  const selected = filterIdsByElementSet(slice.layersSelected, validIds);
  const nextAppState = {
    ...slice,
    variables: doc.variables ?? {},
    theme: {
      mode: mergedTheme.mode,
      colors: mergedTheme.colors,
    },
    themeMode: mergedTheme.mode,
    layersSelected: [],
    layersHighlighted: filterIdsByElementSet(slice.layersHighlighted, validIds),
    layersExpanded: filterIdsByElementSet(slice.layersExpanded, validIds),
    propertiesOpened: filterIdsByElementSet(slice.propertiesOpened, validIds),
    layersCropping: filterIdsByElementSet(slice.layersCropping, validIds),
    layersLassoing: filterIdsByElementSet(slice.layersLassoing, validIds),
  };
  // Validate and rebuild the document in the Edit phase. Retiring entities can
  // coexist with their replacements until Deleter without a second frame/task.
  api.replaceDocument(doc.elements);
  api.selectNodes([]);
  api.setAppState(nextAppState, {
    replaceVariables: true,
    recordDesignVariableUndo: false,
  });

  api.selectNodes(selected.map((id) => api.getNodeById(id)));
  api.record(recordHistory ? 'IMMEDIATELY' : 'NEVER');
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
  const name = filename.endsWith(IC_FILE_SUFFIX)
    ? filename
    : `${filename}${IC_FILE_SUFFIX}`;
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
