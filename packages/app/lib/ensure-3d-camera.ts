import { Camera3D, type API } from '@infinite-canvas-tutorial/ecs';

const installations = new WeakMap<API, Promise<boolean>>();

/** Give each App canvas one linked 3D camera before its vector layers load. */
export function ensure3DCamera(api: API, signal?: AbortSignal): Promise<boolean> {
  const existing = installations.get(api);
  if (existing) return existing;
  const installation = api.edit(
    (editor) => {
      editor.spawn3D(new Camera3D({ linked: true, clearColor: false }));
      editor.getCommands().execute();
    },
    { capture: 'NEVER', signal },
  );
  installations.set(api, installation);
  void installation.then(
    (committed) => {
      if (!committed) installations.delete(api);
    },
    () => installations.delete(api),
  );
  return installation;
}
