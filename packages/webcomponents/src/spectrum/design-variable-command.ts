import {
  API,
  ThemeMode,
  documentValueEqual,
  getDesignVariableLightDarkValues,
  setDesignVariableLightDarkColumn,
  type DesignVariable,
  type DesignVariableType,
} from '@infinite-canvas-tutorial/ecs';
import { normalizeSolidCssValue } from './normalize-solid-css';

export type DesignVariableCommand =
  | { kind: 'add'; key: string; type: DesignVariableType; value: unknown }
  | {
      kind: 'value';
      type: DesignVariableType;
      mode: ThemeMode;
      value: unknown;
    }
  | { kind: 'rename'; key: string }
  | { kind: 'remove' };

// Follow a row through our own value changes and renames. External replacement,
// deletion, import and history restoration invalidate an old row's commands.
// Identity is local to the canvas and never becomes document metadata.
const identities = new WeakMap<API, WeakMap<DesignVariable, object>>();
function identityFor(api: API, variable: DesignVariable) {
  let variables = identities.get(api);
  if (!variables) identities.set(api, (variables = new WeakMap()));
  let identity = variables.get(variable);
  if (!identity) variables.set(variable, (identity = {}));
  return identity;
}

function variableValue(type: DesignVariableType, raw: unknown) {
  if (type === 'number') {
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim()
        ? Number(raw)
        : NaN;
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof raw !== 'string') return;
  if (type === 'string') return raw;
  if (type === 'color') {
    const value = normalizeSolidCssValue(raw);
    if (value === 'none' || CSS.supports('color', value)) return value;
  }
}

/** Each valid variable event updates the live table and commits exactly once. */
export async function editDesignVariable(
  api: API,
  input: DesignVariableCommand,
  target?: DesignVariable,
) {
  const command = { ...input };
  const identity = target && identityFor(api, target);
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    return await api.edit(
      (editor) => {
        const variables = editor.getAppState().variables ?? {};
        const cancel = () => controller.abort();
        if (command.kind === 'add') {
          const key = command.key.trim();
          if (!key || Object.prototype.hasOwnProperty.call(variables, key))
            return cancel();
          const raw =
            command.type === 'color' &&
            typeof command.value === 'string' &&
            !command.value.trim()
              ? '#808080'
              : command.value;
          const value = variableValue(command.type, raw);
          if (value === undefined) return cancel();
          editor.setAppState(
            {
              variables: {
                [key]: {
                  type: command.type,
                  value: [
                    { value, theme: { Mode: 'Light' } },
                    { value, theme: { Mode: 'Dark' } },
                  ],
                },
              },
            },
            { recordDesignVariableUndo: false },
          );
          return;
        }

        if (!identity) return cancel();
        const matches = Object.entries(variables).filter(
          ([, variable]) => identityFor(api, variable) === identity,
        );
        if (matches.length !== 1) return cancel();
        const [key, current] = matches[0];
        let next = { ...variables };
        if (command.kind === 'remove') {
          delete next[key];
        } else if (command.kind === 'rename') {
          const newKey = command.key.trim();
          if (
            !newKey ||
            newKey === key ||
            Object.prototype.hasOwnProperty.call(variables, newKey)
          )
            return cancel();
          delete next[key];
          // Preserve the existing key-only rename semantics; node references
          // remain explicit strings and are not rewritten by this panel.
          next = { ...next, [newKey]: current };
        } else {
          if (
            current.type !== command.type ||
            ![ThemeMode.LIGHT, ThemeMode.DARK].includes(command.mode)
          )
            return cancel();
          const value = variableValue(command.type, command.value);
          const previous = getDesignVariableLightDarkValues(current);
          if (
            value === undefined ||
            documentValueEqual(previous[command.mode], value)
          )
            return cancel();
          const updated = setDesignVariableLightDarkColumn(
            current,
            command.mode,
            value,
          );
          identities.get(api)!.set(updated, identity);
          next[key] = updated;
        }
        editor.setAppState(
          { variables: next },
          { replaceVariables: true, recordDesignVariableUndo: false },
        );
      },
      { signal: controller.signal },
    );
  } catch (error) {
    if (!controller.signal.aborted)
      console.error('Failed to edit design variables', error);
    return false;
  } finally {
    dispose();
  }
}
