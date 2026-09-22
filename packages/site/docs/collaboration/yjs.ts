import * as Y from 'yjs';
import {
  diffNodes,
  orderedNodes,
  demoNodes,
  type DocumentAdapter,
} from './document';

/** Versioned schema: stable node IDs own attribute maps; array positions are only ordering metadata. */
export function yjsDocument(doc: Y.Doc): DocumentAdapter {
  const nodes = doc.getMap<Y.Map<unknown>>('nodes-v2');
  const origin = {};
  // One-time import of older tutorial rooms. New writes only use the versioned schema.
  if (!nodes.size && !doc.getMap('canvas-schema').get('version')) {
    const legacy = doc
      .getArray<Y.Map<unknown>>('nodes')
      .toArray()
      .map((node) => node.toJSON());
    if (legacy.length) {
      doc.transact(() => {
        legacy.forEach((node, index) =>
          nodes.set(
            node.id,
            new Y.Map(Object.entries({ ...node, __order: index })),
          ),
        );
        doc.getMap('canvas-schema').set('version', 2);
      }, origin);
    }
  }
  return {
    read: () => orderedNodes([...nodes.values()].map((node) => node.toJSON())),
    write(previous, next) {
      const patches = diffNodes(previous, next);
      if (!patches.length) return;
      doc.transact(() => {
        doc.getMap('canvas-schema').set('version', 2);
        patches.forEach((patch) => {
          if (patch.remove) {
            nodes.delete(patch.id);
            return;
          }
          let node = nodes.get(patch.id);
          if (!node) {
            // An unseen remote deletion wins over edits to a previously existing node.
            if (previous.some((node) => node.id === patch.id)) return;
            node = new Y.Map();
            nodes.set(patch.id, node);
          }
          Object.entries(patch.set).forEach(([key, value]) =>
            node.set(key, structuredClone(value)),
          );
          patch.unset.forEach((key) => node.delete(key));
        });
      }, origin);
    },
    subscribe(refresh) {
      const onUpdate = (_: Uint8Array, updateOrigin: unknown) => {
        if (updateOrigin !== origin) refresh();
      };
      doc.on('update', onUpdate);
      return () => doc.off('update', onUpdate);
    },
  };
}

/** Use the same seed operations in every tab so joining cannot resurrect a deleted demo node. */
export function createYjsDemoDocument(): Y.Doc {
  const seed = new Y.Doc();
  seed.clientID = 1; // Reserved actor for the immutable v2 demo seed only.
  yjsDocument(seed).write([], demoNodes);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed));
  seed.destroy();
  return doc;
}
