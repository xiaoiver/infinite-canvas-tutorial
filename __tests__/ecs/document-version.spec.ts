import { createDocumentWorld } from '../helpers/ecs-document';
import { Snapshot } from '../../packages/ecs/src/history/Snapshot';

it('keeps versionless edits finite and reuses an unchanged owned snapshot', async () => {
  const world = await createDocumentWorld();
  const api = world.apis[0];
  const disposers: (() => void)[] = [];
  await world.reset(api, [
    {
      id: 'a',
      type: 'rect',
      x: 10,
      y: 20,
      width: 40,
      height: 30,
      zIndex: 0,
      fills: [{ type: 'solid', value: 'red' }],
    },
  ]);
  try {
    let stable = false;
    let nextVersion = NaN;
    let expectedVersion = NaN;
    await world.edit(api, (editor) => {
      const node = editor.getNodeById('a');
      expectedVersion = (node.version || 0) + 1;
      editor.updateNode(node, { x: 35 });
      nextVersion = node.version;
      const first = Snapshot.empty().maybeClone(
        new Map([[node.id, node]]),
        undefined,
      );
      stable =
        first.maybeClone(new Map([[node.id, node]]), undefined) === first;
    });
    expect(nextVersion).toBe(expectedVersion);
    expect(Number.isFinite(nextVersion)).toBe(true);
    expect(stable).toBe(true);
    const node = api.getNodeById('a');
    expect(JSON.parse(JSON.stringify(node)).version).toBe(node.version);
    const beforeNoop = {
      version: node.version,
      versionNonce: node.versionNonce,
      updated: node.updated,
    };
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('a'), {}),
    );
    expect(api.getNodeById('a')).toMatchObject(beforeNoop);
    // Capture derived layout metadata from the preceding real edit first.
    await world.edit(api, () => {}, 'NEVER');
    const subscriber = jest.fn();
    disposers.push(api.subscribe(subscriber));
    await world.edit(api, () => {}, 'NEVER');
    expect(subscriber).not.toHaveBeenCalled();
    await world.history(api, 'undo');
    expect(api.getNodeById('a').x).toBe(10);
    expect(Number.isFinite(api.getNodeById('a').version)).toBe(true);
    await world.history(api, 'redo');
    expect(api.getNodeById('a').x).toBe(35);
    expect(Number.isFinite(api.getNodeById('a').version)).toBe(true);
  } finally {
    disposers.forEach((dispose) => dispose());
    await world.dispose();
  }
});
