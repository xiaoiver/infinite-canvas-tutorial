import {
  documentValueEqual,
  migrateLegacyFillWireInPlace,
  migrateLegacyStrokeWireInPlace,
  type AppState,
  type SerializedFillLayerItem,
} from '@infinite-canvas-tutorial/ecs';
import type { LitElement } from 'lit';
import type { ExtendedAPI } from '../API';

type PreferenceKey = Extract<
  keyof AppState,
  `penbarDraw${string}` | 'penbarPencil' | 'penbarBrush' | 'penbarText'
>;
type DrawingKey = Exclude<PreferenceKey, 'penbarDrawSizeLabelVisible'>;
type DrawingSettings = AppState[DrawingKey];
type SettingsHost = LitElement & { api: ExtendedAPI; appState: AppState };

const numberRanges = {
  strokeWidth: [0, Infinity],
  fontSize: [0, Infinity],
  roughBowing: [0, 10],
  roughRoughness: [0, 10],
  stampInterval: [0.1, 1],
  stampNoiseFactor: [0, 1],
  stampRotationFactor: [0, 1],
} as const;

const choices = {
  roughFillStyle: [
    'hachure',
    'solid',
    'zigzag',
    'cross-hatch',
    'dots',
    'dashed',
    'watercolor',
  ],
  markerStart: ['none', 'line', 'triangle', 'diamond'],
  markerEnd: ['none', 'line', 'triangle', 'diamond'],
  fontStyle: ['normal', 'italic'],
} as const;

type PreferenceChange =
  | { kind: 'number'; field: keyof typeof numberRanges; value: unknown }
  | { kind: 'choice'; field: keyof typeof choices; value: unknown }
  | {
      kind: 'paint';
      field: 'fills' | 'strokes';
      color?: unknown;
      opacity?: unknown;
    }
  | { kind: 'freehand' | 'stamp' | 'fontFamily'; value: unknown }
  | {
      kind: 'icon';
      value: { iconFontFamily?: unknown; iconFontName?: unknown };
    };

function finiteNumber(value: unknown, min: number, max: number) {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Read old saved preferences without mutating them while rendering. */
export function drawingPaint(
  settings: DrawingSettings,
  field: 'fills' | 'strokes',
) {
  const wire = { ...settings } as Record<string, unknown>;
  if (field === 'fills') migrateLegacyFillWireInPlace(wire);
  else migrateLegacyStrokeWireInPlace(wire);
  return (wire[field] as SerializedFillLayerItem[] | undefined) ?? [];
}

function resolveSettings(current: DrawingSettings, change: PreferenceChange) {
  if (change.kind === 'number') {
    const [min, max] = numberRanges[change.field];
    const value = finiteNumber(change.value, min, max);
    if (value !== undefined) return { ...current, [change.field]: value };
  } else if (change.kind === 'choice') {
    const allowed: readonly string[] = choices[change.field];
    if (typeof change.value === 'string' && allowed.includes(change.value)) {
      return { ...current, [change.field]: change.value };
    }
  } else if (change.kind === 'paint') {
    const next = { ...current } as Record<string, unknown>;
    if (change.field === 'fills') migrateLegacyFillWireInPlace(next);
    else migrateLegacyStrokeWireInPlace(next);
    const layers =
      (next[change.field] as SerializedFillLayerItem[] | undefined) ?? [];
    const layer = layers[0] ?? { type: 'solid', value: '#000000', opacity: 1 };
    let updated: SerializedFillLayerItem;
    if ('color' in change) {
      if (typeof change.color !== 'string' || !change.color.trim()) return;
      const color = change.color.trim();
      if (color !== 'none' && !CSS.supports('color', color)) return;
      updated = {
        ...layer,
        type: 'solid',
        value: color,
        opacity: layer.opacity ?? 1,
      };
    } else {
      const opacity = finiteNumber(change.opacity, 0, 1);
      if (opacity === undefined) return;
      updated = { ...layer, opacity };
    }
    return { ...next, [change.field]: [updated, ...layers.slice(1)] };
  } else if (change.kind === 'freehand') {
    if (typeof change.value === 'boolean')
      return { ...current, freehand: change.value };
  } else if (change.kind === 'stamp') {
    const { stamps } = current as AppState['penbarBrush'];
    if (!stamps?.some((stamp) => stamp.src === change.value)) return;
    return {
      ...current,
      stamps: stamps.map((stamp) => ({
        ...stamp,
        active: stamp.src === change.value,
      })),
    };
  } else if (change.kind === 'fontFamily') {
    const { fontFamilies } = current as AppState['penbarText'];
    if (
      typeof change.value === 'string' &&
      fontFamilies?.includes(change.value)
    ) {
      return { ...current, fontFamily: change.value };
    }
  } else if (change.kind === 'icon') {
    const patch: AppState['penbarDrawIconfont'] = {};
    for (const key of ['iconFontFamily', 'iconFontName'] as const) {
      if (!(key in change.value)) continue;
      const value = change.value[key];
      if (typeof value !== 'string' || !value.trim()) return;
      patch[key] = value;
    }
    if (Object.keys(patch).length) return { ...current, ...patch };
  }
}

/**
 * Tool defaults are synchronous UI state, outside the document history.
 * Even edit({ capture: 'NEVER' }) would advance the baseline of pending node
 * changes. Do not queue or record preferences through that document boundary.
 */
export function updateDrawingPreference(
  host: SettingsHost,
  key: DrawingKey,
  change: PreferenceChange,
) {
  const { api } = host;
  if (!host.isConnected || !api) return;
  let alive = true;
  const dispose = api.onDestroy(() => {
    alive = false;
  });
  try {
    if (!alive) return;
    const current = api.getAppState()[key];
    const next = resolveSettings(current, change);
    if (next && !documentValueEqual(current, next))
      api.setAppState({ [key]: next });
  } catch (error) {
    console.error('Failed to update drawing preferences', error);
  } finally {
    if (alive) {
      host.appState = api.getAppState();
      host.requestUpdate();
    }
    dispose();
  }
}
