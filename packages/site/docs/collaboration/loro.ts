import { LoroDoc, LoroMap } from 'loro-crdt';
import {
  diffNodes,
  orderedNodes,
  demoNodes,
  type DocumentAdapter,
} from './document';

export function loroDocument(doc: LoroDoc): DocumentAdapter {
  const nodes = doc.getMap('nodes-v2');
  return {
    read: () => orderedNodes(Object.values(nodes.toJSON())),
    write(previous, next) {
      const patches = diffNodes(previous, next);
      if (!patches.length) return;
      patches.forEach((patch) => {
        if (patch.remove) {
          nodes.delete(patch.id);
          return;
        }
        let node = nodes.get(patch.id) as LoroMap;
        if (!node) {
          if (previous.some((node) => node.id === patch.id)) return;
          node = nodes.setContainer(patch.id, new LoroMap());
        }
        Object.entries(patch.set).forEach(([key, value]) =>
          node.set(key, value as any),
        );
        patch.unset.forEach((key) => node.delete(key));
      });
      doc.commit();
    },
    subscribe(refresh) {
      return doc.subscribe((event) => {
        if (event.by !== 'local') refresh();
      });
    },
  };
}

export function createLoroDemoDocument(): LoroDoc {
  const seed = new LoroDoc();
  seed.setPeerId('1'); // Reserved actor for the immutable v2 demo seed only.
  loroDocument(seed).write([], demoNodes);
  const doc = new LoroDoc();
  doc.import(seed.export({ mode: 'snapshot' }));
  seed.free();
  return doc;
}
